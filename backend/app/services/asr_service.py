"""
Volcengine (豆包) ASR service wrapper.
Uses the v3 BigModel recording recognition API (submit + query pattern)
with speaker diarization support.

Audio is sent via base64-encoded data.
Large files (> MAX_CHUNK_SIZE_MB) are automatically split into chunks
and submitted sequentially. Speaker IDs are namespaced per chunk
(e.g. chunk1_speaker_0) so users can manually merge via speaker mapping.

Submit: POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit
Query:  POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query
"""
import asyncio
import base64
from difflib import SequenceMatcher
import json
import logging
import math
import os
import re
import subprocess
import uuid
from pathlib import Path
from typing import List, NamedTuple, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
RESOURCE_ID = "volc.bigasr.auc"

POLL_INTERVAL = 3   # seconds
MAX_POLL_TIME = 1200  # 20 minutes per chunk
MAX_CHUNK_SIZE_MB = 300  # split threshold (300MB file -> ~400MB base64, within API limit)
MAX_CHUNK_DURATION_SECONDS = 25 * 60  # Long recordings are split even when compressed below size limit.
CHUNK_OVERLAP_SECONDS = 5.0  # Keep boundary speech from being clipped by ASR.

# Formats natively supported by Volcengine ASR
ASR_SUPPORTED_FORMATS = {"wav", "mp3", "ogg", "raw"}


class AudioChunk(NamedTuple):
    path: str
    time_offset: float
    nominal_start: float
    nominal_end: float
    audio_format: str
    is_temp: bool


def _build_headers(request_id: str) -> dict:
    """Build headers using X-Api authentication."""
    return {
        "Content-Type": "application/json",
        "X-Api-App-Key": settings.VOLC_ASR_APP_KEY,
        "X-Api-Access-Key": settings.VOLC_ASR_ACCESS_KEY,
        "X-Api-Resource-Id": RESOURCE_ID,
        "X-Api-Request-Id": request_id,
        "X-Api-Sequence": "-1",
    }


def _get_local_path(stored_name: str) -> str:
    """Get the local filesystem path for an audio file."""
    from app.core.storage import get_file
    _, local_path = get_file("meeting-audio", stored_name)
    return str(local_path)


def _get_audio_format(content_type: str, local_path: str) -> str:
    """Resolve ASR format from content type first, then file extension."""
    format_map = {
        "audio/mpeg": "mp3", "audio/mp3": "mp3",
        "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
        "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/mp4": "m4a",
        "audio/ogg": "ogg", "audio/flac": "flac",
        "audio/aac": "aac", "audio/x-ms-wma": "wma", "audio/amr": "amr",
    }
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    audio_format = format_map.get(normalized_type)
    if audio_format:
        return audio_format

    suffix = Path(local_path).suffix.lower().lstrip(".")
    ext_map = {"mpga": "mp3", "mpeg": "mp3", "wave": "wav", "mp4": "m4a"}
    return ext_map.get(suffix, suffix or "mp3")


def _transcode_to_mp3(local_path: str) -> str:
    """
    Transcode an unsupported audio file to a normalized mp3 for ASR.
    Returns the path to the transcoded mp3 file.
    """
    source = Path(local_path)
    mp3_path = str(source.with_name(f"{source.stem}_asr.mp3"))
    if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
        logger.info("Transcoded file already exists: %s", mp3_path)
        return mp3_path

    logger.info("Transcoding %s -> %s", local_path, mp3_path)
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", local_path,
            "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000",
            "-acodec", "libmp3lame", "-q:a", "4", mp3_path,
        ],
        capture_output=True, text=True, timeout=600,
    )
    if result.returncode != 0:
        logger.error("ffmpeg failed: %s", result.stderr[-500:])
        raise RuntimeError(f"Audio transcode failed: {result.stderr[-200:]}")

    logger.info("Transcode done: %s (%.1f KB)", mp3_path, os.path.getsize(mp3_path) / 1024)
    return mp3_path


def _get_audio_duration(local_path: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", local_path],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr[:200]}")
    duration_text = result.stdout.strip()
    if not duration_text:
        raise RuntimeError("ffprobe returned empty duration")
    return float(duration_text)


def _split_audio(
    local_path: str,
    audio_format: str,
    max_size_mb: int = MAX_CHUNK_SIZE_MB,
    max_duration_seconds: int = MAX_CHUNK_DURATION_SECONDS,
) -> List[AudioChunk]:
    """
    Split audio into normalized mp3 chunks when size or duration is too large.

    Returns chunks with exact original-audio offsets. Each generated chunk has a
    small overlap around boundaries, then merge logic removes duplicate text.
    """
    file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
    try:
        duration = _get_audio_duration(local_path)
    except Exception:
        if file_size_mb <= max_size_mb:
            logger.warning("Could not read audio duration; submitting original file without splitting")
            return [AudioChunk(local_path, 0.0, 0.0, 0.0, audio_format, False)]
        raise

    chunks_by_size = max(1, math.ceil(file_size_mb / max_size_mb))
    chunks_by_duration = max(1, math.ceil(duration / max_duration_seconds)) if duration > 0 else 1
    num_chunks = max(chunks_by_size, chunks_by_duration)

    if num_chunks <= 1:
        return [AudioChunk(local_path, 0.0, 0.0, duration, audio_format, False)]

    nominal_duration = duration / num_chunks
    logger.info(
        "Splitting %.1fMB audio (%.1fs) into %d chunks of ~%.1fs each",
        file_size_mb, duration, num_chunks, nominal_duration,
    )

    chunks = []
    parent_dir = str(Path(local_path).parent)
    stem = Path(local_path).stem

    for i in range(num_chunks):
        nominal_start = i * nominal_duration
        nominal_end = duration if i == num_chunks - 1 else (i + 1) * nominal_duration
        actual_start = max(0.0, nominal_start - (CHUNK_OVERLAP_SECONDS if i > 0 else 0.0))
        actual_end = min(duration, nominal_end + (CHUNK_OVERLAP_SECONDS if i < num_chunks - 1 else 0.0))
        actual_duration = max(0.1, actual_end - actual_start)
        chunk_path = os.path.join(parent_dir, f"{stem}_chunk{i + 1}.mp3")

        # Put -ss after -i for accurate timestamps. Fast input seeking can land
        # on a nearby keyframe and causes transcript/audio mismatch at boundaries.
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", local_path,
                "-ss", f"{actual_start:.3f}", "-t", f"{actual_duration:.3f}",
                "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000",
                "-acodec", "libmp3lame", "-q:a", "4", chunk_path,
            ],
            capture_output=True, text=True, timeout=900,
        )
        if result.returncode != 0:
            logger.error("ffmpeg split chunk %d failed: %s", i + 1, result.stderr[-300:])
            raise RuntimeError(f"Audio split failed at chunk {i + 1}")
        if not os.path.exists(chunk_path) or os.path.getsize(chunk_path) <= 0:
            raise RuntimeError(f"Audio split produced empty chunk at chunk {i + 1}")

        chunk_size = os.path.getsize(chunk_path) / (1024 * 1024)
        logger.info(
            "Chunk %d: nominal=%.1f-%.1fs actual=%.1f-%.1fs size=%.1fMB path=%s",
            i + 1, nominal_start, nominal_end, actual_start, actual_end, chunk_size, chunk_path,
        )
        chunks.append(AudioChunk(chunk_path, actual_start, nominal_start, nominal_end, "mp3", True))

    return chunks


def _normalize_text_for_dedupe(text: str) -> str:
    """Normalize ASR text for comparing overlapped chunk duplicates."""
    lowered = (text or "").lower()
    return re.sub(r"[\s，。！？、,.!?;；:：\"'“”‘’（）()\[\]{}<>《》\-—_…]+", "", lowered)


def _text_similarity(left: str, right: str) -> float:
    left_norm = _normalize_text_for_dedupe(left)
    right_norm = _normalize_text_for_dedupe(right)
    if not left_norm or not right_norm:
        return 0.0
    if left_norm == right_norm:
        return 1.0
    shorter, longer = sorted((left_norm, right_norm), key=len)
    if len(shorter) >= 4 and shorter in longer:
        return len(shorter) / len(longer)
    return SequenceMatcher(None, left_norm, right_norm).ratio()


def _is_near_or_overlapping(candidate: dict, existing: dict) -> bool:
    c_start = float(candidate.get("start_time") or 0.0)
    c_end = float(candidate.get("end_time") or c_start)
    e_start = float(existing.get("start_time") or 0.0)
    e_end = float(existing.get("end_time") or e_start)
    if c_end < c_start:
        c_end = c_start
    if e_end < e_start:
        e_end = e_start
    tolerance = CHUNK_OVERLAP_SECONDS + 2.0
    return c_start <= e_end + tolerance and e_start <= c_end + tolerance


def _is_duplicate_segment(candidate: dict, existing_segments: List[dict]) -> bool:
    for existing in reversed(existing_segments[-12:]):
        if not _is_near_or_overlapping(candidate, existing):
            continue
        if _text_similarity(candidate.get("content", ""), existing.get("content", "")) >= 0.92:
            return True
    return False


def _merge_chunk_segments(chunks: List[AudioChunk], chunk_results: List[dict]) -> tuple:
    """Merge chunk-relative ASR segments into original-audio timestamps."""
    is_multi_chunk = len(chunks) > 1
    merged = []
    warnings = []

    for chunk_idx, (chunk, result) in enumerate(zip(chunks, chunk_results)):
        chunk_segments = result.get("segments", []) or []
        if not chunk_segments and not (result.get("text") or "").strip():
            warnings.append(f"chunk {chunk_idx + 1} returned no transcript segments")
            logger.warning("ASR chunk %d returned no transcript segments", chunk_idx + 1)

        for seg in chunk_segments:
            content = (seg.get("content") or "").strip()
            if not content:
                continue
            rel_start = float(seg.get("start_time") or 0.0)
            rel_end = float(seg.get("end_time") or rel_start)
            start_time = max(0.0, rel_start + chunk.time_offset)
            end_time = max(start_time, rel_end + chunk.time_offset)

            candidate = {
                "speaker_id": seg.get("speaker_id", ""),
                "start_time": round(start_time, 2),
                "end_time": round(end_time, 2),
                "content": content,
            }

            if is_multi_chunk and _is_duplicate_segment(candidate, merged):
                logger.info(
                    "Dropping duplicate overlap segment at %.2f-%.2fs: %s",
                    candidate["start_time"], candidate["end_time"], content[:50],
                )
                continue

            if is_multi_chunk:
                candidate["speaker_id"] = f"chunk{chunk_idx + 1}_{candidate['speaker_id']}"
            merged.append(candidate)

    merged.sort(key=lambda item: (item["start_time"], item["end_time"]))
    for index, segment in enumerate(merged):
        segment["segment_index"] = index

    text = "\n".join(segment["content"] for segment in merged)
    return merged, text, warnings


async def _submit_single_chunk(local_path: str, audio_format: str) -> dict:
    """
    Submit a single audio chunk for ASR processing.
    Audio is sent as base64-encoded data.

    Returns dict with segments and full text, or error.
    """
    with open(local_path, "rb") as f:
        audio_data = base64.b64encode(f.read()).decode("utf-8")
    file_size_kb = os.path.getsize(local_path) / 1024
    logger.info("Submitting chunk: format=%s, %.1f KB, path=%s", audio_format, file_size_kb, local_path)

    request_id = str(uuid.uuid4())
    headers = _build_headers(request_id)

    body = {
        "user": {"uid": "punkrecord-user"},
        "audio": {
            "data": audio_data,
            "format": audio_format,
            "codec": "raw",
            "rate": 16000,
            "bits": 16,
            "channel": 1,
        },
        "request": {
            "model_name": "bigmodel",
            "enable_itn": True,
            "enable_punc": True,
            "enable_speaker_info": True,
            "enable_emotion_detection": False,
            "enable_gender_detection": False,
        },
    }

    try:
        async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
            logger.info("Submitting ASR task, request_id=%s", request_id)
            resp = await client.post(SUBMIT_URL, json=body, headers=headers)

            status_code = resp.headers.get("X-Api-Status-Code", "")
            message = resp.headers.get("X-Api-Message", "")

            if status_code != "20000000":
                logger.error("ASR submit error: status=%s, message=%s, body=%s",
                             status_code, message, resp.text[:500])
                return {
                    "error": f"ASR submit failed: status={status_code}, message={message}",
                    "segments": [], "text": "",
                }

            logger.info("ASR task submitted, request_id=%s, polling...", request_id)

            elapsed = 0
            while elapsed < MAX_POLL_TIME:
                await asyncio.sleep(POLL_INTERVAL)
                elapsed += POLL_INTERVAL

                query_resp = await client.post(QUERY_URL, json={}, headers=headers)
                q_status = query_resp.headers.get("X-Api-Status-Code", "")
                q_message = query_resp.headers.get("X-Api-Message", "")

                if q_status == "20000000":
                    logger.info("ASR task completed after %ds", elapsed)
                    result = query_resp.json()
                    return _parse_asr_response(result)

                elif q_status in ("20000001", "20000002"):
                    if elapsed % 15 == 0:
                        label = "processing" if q_status == "20000001" else "queued"
                        logger.info("ASR task %s, elapsed %ds...", label, elapsed)
                    continue

                elif q_status == "20000003":
                    logger.warning("ASR: silent audio detected")
                    return {"segments": [], "text": "", "error": "Silent audio detected"}

                else:
                    logger.error("ASR query error: status=%s, message=%s", q_status, q_message)
                    return {
                        "error": f"ASR query failed: status={q_status}, message={q_message}",
                        "segments": [], "text": "",
                    }

            logger.error("ASR task timed out after %ds", MAX_POLL_TIME)
            return {"error": "ASR task timed out", "segments": [], "text": ""}

    except Exception as e:
        logger.exception("ASR task failed: %s", e)
        error_msg = str(e) or type(e).__name__
        return {"error": error_msg, "segments": [], "text": ""}


async def submit_asr_task(stored_name: str, content_type: str = "audio/mpeg") -> dict:
    """
    Submit audio for ASR processing. Large or long files are split into
    normalized chunks and submitted sequentially.

    Speaker IDs are namespaced per chunk for multi-chunk files:
    - Single chunk: speaker_0, speaker_1 (unchanged)
    - Multi chunk: chunk1_speaker_0, chunk2_speaker_0 etc.

    Returns dict with segments and full text.
    """
    original_path = _get_local_path(stored_name)
    local_path = original_path
    audio_format = _get_audio_format(content_type, local_path)
    temp_original_path: Optional[str] = None

    # Transcode unsupported formats before splitting so chunk output format and
    # ASR-declared format always match.
    if audio_format not in ASR_SUPPORTED_FORMATS:
        try:
            local_path = _transcode_to_mp3(local_path)
            temp_original_path = local_path
            audio_format = "mp3"
            logger.info("Using transcoded file: %s", local_path)
        except Exception as e:
            logger.error("Transcode failed: %s", e)
            return {"error": f"Audio transcode failed: {e}", "segments": [], "text": ""}

    chunks: List[AudioChunk] = []
    chunk_results = []
    try:
        chunks = _split_audio(local_path, audio_format)

        for chunk_idx, chunk in enumerate(chunks):
            chunk_num = chunk_idx + 1
            logger.info(
                "Processing chunk %d/%d (offset=%.1fs, format=%s)",
                chunk_num, len(chunks), chunk.time_offset, chunk.audio_format,
            )

            result = await _submit_single_chunk(chunk.path, chunk.audio_format)
            if result.get("error"):
                logger.error("Chunk %d failed: %s", chunk_num, result["error"])
                return result
            chunk_results.append(result)

        all_segments, full_text, warnings = _merge_chunk_segments(chunks, chunk_results)
        duration = max((chunk.nominal_end for chunk in chunks), default=None)
        response = {
            "segments": all_segments,
            "text": full_text,
            "duration_seconds": round(duration) if duration is not None else None,
        }
        if warnings:
            response["warnings"] = warnings
        return response
    except Exception as e:
        logger.exception("ASR processing failed: %s", e)
        error_msg = str(e) or type(e).__name__
        return {"error": error_msg, "segments": [], "text": ""}
    finally:
        _cleanup_chunks(chunks, local_path)
        if temp_original_path and temp_original_path != original_path:
            try:
                os.remove(temp_original_path)
            except OSError:
                pass


def _cleanup_chunks(chunks: List[AudioChunk], original_path: str):
    """Remove temporary chunk files (not the submitted original)."""
    for chunk in chunks:
        if chunk.is_temp and chunk.path != original_path and os.path.exists(chunk.path):
            try:
                os.remove(chunk.path)
            except OSError:
                pass


def _parse_asr_response(response: dict) -> dict:
    """Parse the v3 BigModel ASR response into structured segments."""
    segments = []
    full_text_parts = []

    result = response.get("result", response)
    utterances = result.get("utterances", [])

    if not utterances:
        text = result.get("text", "")
        if text:
            segments.append({
                "segment_index": 0,
                "speaker_id": "speaker_0",
                "start_time": 0.0,
                "end_time": 0.0,
                "content": text,
            })
            return {"segments": segments, "text": text}
        return {"segments": [], "text": ""}

    for idx, utt in enumerate(utterances):
        additions = utt.get("additions", {})
        speaker = additions.get("speaker") or utt.get("speaker", str(idx % 4))
        speaker_id = f"speaker_{speaker}"

        start = utt.get("start_time", 0) / 1000.0
        end = utt.get("end_time", 0) / 1000.0
        text = utt.get("text", "")

        if text.strip():
            segments.append({
                "segment_index": idx,
                "speaker_id": speaker_id,
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "content": text.strip(),
            })
            full_text_parts.append(text.strip())

    return {
        "segments": segments,
        "text": "\n".join(full_text_parts),
    }
