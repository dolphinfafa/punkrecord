"""
Meeting Record API endpoints
"""
import asyncio
from app.models.base import now_cn
import json
import logging
from typing import Optional
from uuid import UUID, uuid4
from datetime import date, datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session, engine
from app.core.auth import require_permission
from app.core.exceptions import NotFoundException, AtlasException
from app.core.response import success_response
from app.core.config import settings
from app.core.storage import save_file, get_file, delete_file, get_download_url
from app.models.iam import User
from app.models.meeting import MeetingRecord, MeetingTranscriptSegment, MeetingStatus, MeetingType
from app.models.kb import KBDocument, KBDocumentStatus
from app.schemas.meeting import (
    MeetingCreateResponse, MeetingResponse, MeetingListResponse,
    MeetingStatusResponse, TranscriptSegmentResponse,
    TranscriptBatchUpdate, SpeakerMappingUpdate, SummarizeRequest,
)
from app.services.asr_service import submit_asr_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meeting", tags=["Meeting"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_meeting(meeting: MeetingRecord, session: Session) -> MeetingResponse:
    """Build MeetingResponse with resolved creator name."""
    creator = session.get(User, meeting.created_by)
    data = MeetingResponse.model_validate(meeting)
    data.creator_name = creator.display_name if creator else None
    return data


async def _run_asr(meeting_id: UUID):
    """Background task: run ASR on uploaded audio, save transcript segments."""
    try:
        with Session(engine) as session:
            meeting = session.get(MeetingRecord, meeting_id)
            if not meeting:
                logger.error("Meeting %s not found for ASR", meeting_id)
                return

            # Call ASR service with stored filename (it will construct the public URL)
            result = await submit_asr_task(meeting.audio_stored_name, meeting.audio_content_type)

            if result.get("error"):
                logger.error("ASR failed for meeting %s: %s", meeting_id, result["error"])
                meeting.status = MeetingStatus.FAILED
                session.add(meeting)
                session.commit()
                return

            # Parse segments and create records
            segments = result.get("segments", [])
            for seg in segments:
                segment = MeetingTranscriptSegment(
                    meeting_id=meeting.id,
                    segment_index=seg.get("segment_index", 0),
                    speaker_id=seg.get("speaker_id", ""),
                    start_time=seg.get("start_time", 0.0),
                    end_time=seg.get("end_time", 0.0),
                    content=seg.get("content", ""),
                )
                session.add(segment)

            meeting.status = MeetingStatus.TRANSCRIBED
            session.add(meeting)
            session.commit()
            logger.info("ASR completed for meeting %s, %d segments", meeting_id, len(segments))

    except Exception as e:
        logger.exception("ASR background task failed for meeting %s: %s", meeting_id, e)
        try:
            with Session(engine) as session:
                meeting = session.get(MeetingRecord, meeting_id)
                if meeting:
                    meeting.status = MeetingStatus.FAILED
                    session.add(meeting)
                    session.commit()
        except Exception:
            pass


# ─── 1. Upload audio & create meeting ────────────────────────────────────────

@router.post("/records", response_model=dict)
async def create_meeting(
    file: UploadFile = File(...),
    title: str = Form(...),
    meeting_type: str = Form(default="morning"),
    meeting_date: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.write")),
):
    """Upload audio file and create a new meeting record."""
    file_data = await file.read()
    if not file_data:
        raise AtlasException("音频文件不能为空")

    # Validate meeting_type
    valid_types = [t.value for t in MeetingType]
    if meeting_type not in valid_types:
        meeting_type = MeetingType.MORNING.value

    # Parse meeting_date
    parsed_date = date.today()
    if meeting_date:
        try:
            parsed_date = date.fromisoformat(meeting_date)
        except ValueError:
            parsed_date = date.today()

    original_name = file.filename or "audio"
    content_type = file.content_type or "audio/mpeg"
    ext = Path(original_name).suffix or ".mp3"
    stored_name = f"{uuid4().hex}{ext}"

    save_file("meeting-audio", stored_name, file_data, content_type)

    meeting = MeetingRecord(
        title=title,
        meeting_type=meeting_type,
        meeting_date=parsed_date,
        audio_file_name=original_name,
        audio_stored_name=stored_name,
        audio_content_type=content_type,
        audio_file_size=len(file_data),
        status=MeetingStatus.UPLOADING,
        created_by=current_user.id,
    )
    session.add(meeting)
    session.commit()
    session.refresh(meeting)

    # Transition to TRANSCRIBING and kick off ASR
    meeting.status = MeetingStatus.TRANSCRIBING
    session.add(meeting)
    session.commit()
    session.refresh(meeting)

    asyncio.ensure_future(_run_asr(meeting.id))

    resp = MeetingCreateResponse.model_validate(meeting)
    return success_response(resp.model_dump())


# ─── 2. List meetings (paginated) ────────────────────────────────────────────

@router.get("/records", response_model=dict)
async def list_meetings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    meeting_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.read")),
):
    """Get paginated list of meeting records."""
    query = select(MeetingRecord)
    if status:
        query = query.where(MeetingRecord.status == status)
    if meeting_type:
        query = query.where(MeetingRecord.meeting_type == meeting_type)
    if search:
        search_pattern = f"%{search}%"
        from sqlalchemy import or_, cast, String, func, text
        query = query.where(
            or_(
                MeetingRecord.title.ilike(search_pattern),
                cast(MeetingRecord.meeting_date, String).ilike(search_pattern),
                func.json_search(MeetingRecord.attendees, "one", search_pattern) != None,
            )
        )
    query = query.order_by(MeetingRecord.created_at.desc())

    total = len(session.exec(query).all())
    meetings = session.exec(query.offset(skip).limit(limit)).all()

    items = [_enrich_meeting(m, session).model_dump() for m in meetings]
    return success_response({"items": items, "total": total, "skip": skip, "limit": limit})


# ─── 3. Meeting detail ───────────────────────────────────────────────────────

@router.get("/records/{meeting_id}", response_model=dict)
async def get_meeting(
    meeting_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.read")),
):
    """Get meeting record by ID."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")
    return success_response(_enrich_meeting(meeting, session).model_dump())


# ─── 4. Delete meeting ───────────────────────────────────────────────────────

@router.delete("/records/{meeting_id}", response_model=dict)
async def delete_meeting(
    meeting_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.write")),
):
    """Delete meeting record, its transcript segments, and audio file."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    # Delete transcript segments
    segments = session.exec(
        select(MeetingTranscriptSegment).where(MeetingTranscriptSegment.meeting_id == meeting_id)
    ).all()
    for seg in segments:
        session.delete(seg)

    # Delete audio file
    if meeting.audio_stored_name:
        try:
            delete_file("meeting-audio", meeting.audio_stored_name)
        except Exception:
            pass

    session.delete(meeting)
    session.commit()
    return success_response({"message": "会议记录已删除"})


# ─── 5. Meeting status ───────────────────────────────────────────────────────

@router.get("/records/{meeting_id}/status", response_model=dict)
async def get_meeting_status(
    meeting_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.read")),
):
    """Get current status of a meeting record."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")
    return success_response(MeetingStatusResponse(
        id=meeting.id,
        status=meeting.status,
        asr_task_id=meeting.asr_task_id,
    ).model_dump())


# ─── 6. Get transcript ───────────────────────────────────────────────────────

@router.get("/records/{meeting_id}/transcript", response_model=dict)
async def get_transcript(
    meeting_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.read")),
):
    """Get transcript segments for a meeting, ordered by segment index."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    segments = session.exec(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.segment_index)
    ).all()

    items = [TranscriptSegmentResponse.model_validate(s).model_dump() for s in segments]
    return success_response(items)


# ─── 7. Batch update transcript segments ─────────────────────────────────────

@router.patch("/records/{meeting_id}/transcript", response_model=dict)
async def update_transcript(
    meeting_id: UUID,
    data: TranscriptBatchUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.write")),
):
    """Batch update transcript segment contents."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    for update in data.segments:
        segment = session.get(MeetingTranscriptSegment, update.id)
        if segment and segment.meeting_id == meeting_id:
            segment.content = update.content
            if update.speaker_id is not None:
                segment.speaker_id = update.speaker_id
            session.add(segment)

    session.commit()
    return success_response({"message": "转写内容已更新"})


# ─── 8. Update speaker mapping ───────────────────────────────────────────────

@router.put("/records/{meeting_id}/speakers", response_model=dict)
async def update_speakers(
    meeting_id: UUID,
    data: SpeakerMappingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.write")),
):
    """Update speaker ID to name mapping."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    meeting.speaker_mapping = data.speaker_mapping
    meeting.updated_at = now_cn()
    session.add(meeting)
    session.commit()
    session.refresh(meeting)
    return success_response(_enrich_meeting(meeting, session).model_dump())


# ─── 9. AI summarize (SSE) ───────────────────────────────────────────────────

@router.post("/records/{meeting_id}/summarize", response_model=None)
async def summarize_meeting(
    meeting_id: UUID,
    body: Optional[SummarizeRequest] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.write")),
):
    """Generate AI meeting summary via SSE streaming."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    # Build full transcript text
    segments = session.exec(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.segment_index)
    ).all()

    if not segments:
        raise AtlasException("会议尚无转写内容，无法生成纪要")

    speaker_mapping = meeting.speaker_mapping or {}
    lines = []
    for seg in segments:
        speaker_name = speaker_mapping.get(seg.speaker_id, seg.speaker_id)
        lines.append(f"{speaker_name}: {seg.content}")
    transcript_text = "\n".join(lines)

    # Extract attendees from speaker_mapping
    attendees_list = [name for name in speaker_mapping.values() if name and name.strip()]

    # Store meeting_id for the generator closure
    m_id = meeting.id

    system_prompt = "你是专业的会议纪要生成助手。请根据以下会议转写文稿，生成结构化的会议纪要，包括：会议概要、讨论要点、决策事项、待办事项。"

    # Append custom prompt if provided
    custom_prompt = body.prompt if body and body.prompt else None
    if custom_prompt:
        system_prompt += f"\n\n额外要求：{custom_prompt}"

    # Build user message with optional previous meeting context
    user_message_parts = []
    previous_meeting_id = body.previous_meeting_id if body else None
    if previous_meeting_id:
        prev_meeting = session.get(MeetingRecord, previous_meeting_id)
        if prev_meeting and prev_meeting.summary:
            user_message_parts.append(f"上次会议纪要（供参考对比）：\n{prev_meeting.summary}\n\n---\n")
    user_message_parts.append(f"会议转写文稿：\n{transcript_text}")
    user_message = "\n".join(user_message_parts)

    async def generate():
        full_text = ""
        url = f"{settings.LITELLM_BASE_URL}/chat/completions"
        payload = {
            "model": settings.LITELLM_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": True,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
        }

        try:
            async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as resp:
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(raw)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                full_text += text
                                yield f"data: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"
                        except (json.JSONDecodeError, IndexError, KeyError):
                            continue
        except Exception as e:
            logger.exception("LLM streaming failed: %s", e)
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

        # Save summary + attendees to DB
        try:
            with Session(engine) as db:
                m = db.get(MeetingRecord, m_id)
                if m:
                    m.summary = full_text
                    m.status = MeetingStatus.SUMMARIZED
                    if attendees_list:
                        m.attendees = attendees_list
                    m.updated_at = now_cn()
                    db.add(m)
                    db.commit()
        except Exception as e:
            logger.error("Failed to save summary: %s", e)

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── 10. Archive to KB ───────────────────────────────────────────────────────

@router.post("/records/{meeting_id}/archive", response_model=dict)
async def archive_meeting(
    meeting_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.write")),
):
    """Archive meeting transcript + summary to the knowledge base."""
    from app.services.kb_pipeline import process_document

    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    # Build full transcript text
    segments = session.exec(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.segment_index)
    ).all()

    speaker_mapping = meeting.speaker_mapping or {}
    lines = []
    for seg in segments:
        speaker_name = speaker_mapping.get(seg.speaker_id, seg.speaker_id)
        lines.append(f"{speaker_name}: {seg.content}")
    transcript_text = "\n".join(lines)

    # Combine transcript and summary
    content_parts = [f"会议标题：{meeting.title}\n"]
    if meeting.summary:
        content_parts.append(f"会议纪要：\n{meeting.summary}\n")
    content_parts.append(f"会议转写：\n{transcript_text}")
    full_content = "\n".join(content_parts)

    # Save as a .txt file
    stored_name = f"meeting_{meeting.id.hex}.txt"
    file_bytes = full_content.encode("utf-8")
    save_file("kb-documents", stored_name, file_bytes, "text/plain")

    # Create KBDocument
    kb_doc = KBDocument(
        title=f"会议记录 - {meeting.title}",
        file_name=f"{meeting.title}.txt",
        stored_name=stored_name,
        content_type="text/plain",
        file_size=len(file_bytes),
        storage_directory="kb-documents",
        status=KBDocumentStatus.PROCESSING,
        uploaded_by=current_user.id,
        source_type="meeting_archive",
        source_id=meeting.id,
    )
    session.add(kb_doc)
    session.commit()
    session.refresh(kb_doc)

    # Update meeting
    meeting.status = MeetingStatus.ARCHIVED
    meeting.archived_document_id = kb_doc.id
    meeting.updated_at = now_cn()
    session.add(meeting)
    session.commit()
    session.refresh(meeting)

    # Kick off document processing pipeline in background
    asyncio.ensure_future(process_document(kb_doc.id))

    return success_response(_enrich_meeting(meeting, session).model_dump())


# ─── 11. Temp audio for ASR (no auth, UUID-based access) ─────────────────────

@router.get("/asr-audio/{stored_name}")
async def serve_asr_audio(stored_name: str):
    """Serve audio file for ASR service to fetch. No auth required —
    stored_name is a UUID so it's unguessable."""
    if not stored_name or "/" in stored_name or ".." in stored_name:
        raise NotFoundException("Invalid filename")

    try:
        _, local_path = get_file("meeting-audio", stored_name)
    except FileNotFoundError:
        raise NotFoundException("音频文件不存在")

    return FileResponse(
        path=local_path,
        media_type="application/octet-stream",
    )


# ─── 12. Serve audio file ────────────────────────────────────────────────────

@router.get("/records/{meeting_id}/audio")
async def get_audio(
    meeting_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("meeting.read")),
):
    """Serve audio file or redirect to TOS pre-signed URL."""
    meeting = session.get(MeetingRecord, meeting_id)
    if not meeting:
        raise NotFoundException("未找到会议记录")

    if not meeting.audio_stored_name:
        raise NotFoundException("音频文件不存在")

    # Try TOS pre-signed URL first
    url = get_download_url("meeting-audio", meeting.audio_stored_name)
    if url:
        return RedirectResponse(url)

    # Fall back to local file
    try:
        _, local_path = get_file("meeting-audio", meeting.audio_stored_name)
    except FileNotFoundError:
        raise NotFoundException("音频文件不存在")

    return FileResponse(
        path=local_path,
        media_type=meeting.audio_content_type or "application/octet-stream",
        filename=meeting.audio_file_name,
    )
