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
import json
import logging
import math
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import List, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
RESOURCE_ID = "volc.bigasr.auc"

POLL_INTERVAL = 3   # seconds
MAX_POLL_TIME = 1200  # 20 minutes per chunk
MAX_CHUNK_SIZE_MB = 300  # split threshold (300MB file → ~400MB base64, within API limit)

# Formats natively supported by Volcengine ASR
ASR_SUPPORTED_FORMATS = {"wav", "mp3", "ogg", "raw"}


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


def _transcode_to_mp3(local_path: str) -> str:
    """
    Transcode an unsupported audio file to mp3 using ffmpeg.
    Returns the path to the transcoded mp3 file.
    """
    mp3_path = str(Path(local_path).with_suffix(".mp3"))
    if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
        logger.info("Transcoded file already exists: %s", mp3_path)
        return mp3_path

    logger.info("Transcoding %s -> %s", local_path, mp3_path)
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", local_path, "-acodec", "libmp3lame", "-q:a", "2", mp3_path],
        capture_output=True, text=True, timeout=300,
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
    return float(result.stdout.strip())


def _split_audio(local_path: str, max_size_mb: int = MAX_CHUNK_SIZE_MB) -> List[Tuple[str, float]]:
    """
    Split audio file into chunks if it exceeds max_size_mb.

    Returns list of (chunk_path, time_offset_seconds).
    For files within limit, returns [(original_path, 0.0)].
    Temporary chunk files are created in the same directory.
    """
    file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
    if file_size_mb <= max_size_mb:
        return [(local_path, 0.0)]

    duration = _get_audio_duration(local_path)
    num_chunks = math.ceil(file_size_mb / max_size_mb)
    chunk_duration = duration / num_chunks

    logger.info("Splitting %.1fMB audio (%.0fs) into %d chunks of ~%.0fs each",
                file_size_mb, duration, num_chunks, chunk_duration)

    chunks = []
    parent_dir = str(Path(local_path).parent)
    stem = Path(local_path).stem
    suffix = Path(local_path).suffix

    for i in range(num_chunks):
        offset = i * chunk_duration
        chunk_path = os.path.join(parent_dir, f"{stem}_chunk{i+1}{suffix}")

        result = subprocess.run(
            ["ffmpeg", "-y", "-ss", str(offset), "-t", str(chunk_duration),
             "-i", local_path, "-acodec", "libmp3lame", "-q:a", "2", chunk_path],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            logger.error("ffmpeg split chunk %d failed: %s", i+1, result.stderr[-300:])
            raise RuntimeError(f"Audio split failed at chunk {i+1}")

        chunk_size = os.path.getsize(chunk_path) / (1024 * 1024)
        logger.info("Chunk %d: offset=%.1fs, size=%.1fMB, path=%s",
                     i+1, offset, chunk_size, chunk_path)
        chunks.append((chunk_path, offset))

    return chunks


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
    Submit audio for ASR processing. Large files are automatically split
    into chunks (≤ MAX_CHUNK_SIZE_MB each) and submitted sequentially.

    Speaker IDs are namespaced per chunk for multi-chunk files:
    - Single chunk: speaker_0, speaker_1 (unchanged)
    - Multi chunk: chunk1_speaker_0, chunk2_speaker_0 etc.

    Returns dict with segments and full text.
    """
    format_map = {
        "audio/mpeg": "mp3", "audio/mp3": "mp3",
        "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
        "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/mp4": "m4a",
        "audio/ogg": "ogg", "audio/flac": "flac",
        "audio/aac": "aac", "audio/x-ms-wma": "wma", "audio/amr": "amr",
    }
    audio_format = format_map.get(content_type, "mp3")

    local_path = _get_local_path(stored_name)

    # Transcode unsupported formats
    if audio_format not in ASR_SUPPORTED_FORMATS:
        try:
            local_path = _transcode_to_mp3(local_path)
            audio_format = "mp3"
            logger.info("Using transcoded file: %s", local_path)
        except Exception as e:
            logger.error("Transcode failed: %s, trying original", e)

    # Split if needed
    try:
        chunks = _split_audio(local_path)
    except Exception as e:
        logger.error("Audio split failed: %s", e)
        return {"error": f"Audio split failed: {e}", "segments": [], "text": ""}

    is_multi_chunk = len(chunks) > 1
    all_segments = []
    all_text_parts = []
    global_seg_index = 0

    for chunk_idx, (chunk_path, time_offset) in enumerate(chunks):
        chunk_num = chunk_idx + 1
        logger.info("Processing chunk %d/%d (offset=%.1fs)", chunk_num, len(chunks), time_offset)

        result = await _submit_single_chunk(chunk_path, audio_format)

        if result.get("error"):
            logger.error("Chunk %d failed: %s", chunk_num, result["error"])
            # Clean up temp chunk files
            _cleanup_chunks(chunks, local_path)
            return result  # Propagate error

        for seg in result.get("segments", []):
            # Namespace speaker_id for multi-chunk
            speaker_id = seg["speaker_id"]
            if is_multi_chunk:
                speaker_id = f"chunk{chunk_num}_{speaker_id}"

            all_segments.append({
                "segment_index": global_seg_index,
                "speaker_id": speaker_id,
                "start_time": round(seg["start_time"] + time_offset, 2),
                "end_time": round(seg["end_time"] + time_offset, 2),
                "content": seg["content"],
            })
            global_seg_index += 1

        chunk_text = result.get("text", "")
        if chunk_text:
            all_text_parts.append(chunk_text)

    # Clean up temp chunk files
    _cleanup_chunks(chunks, local_path)

    return {
        "segments": all_segments,
        "text": "\n".join(all_text_parts),
    }


def _cleanup_chunks(chunks: List[Tuple[str, float]], original_path: str):
    """Remove temporary chunk files (not the original)."""
    for chunk_path, _ in chunks:
        if chunk_path != original_path and os.path.exists(chunk_path):
            try:
                os.remove(chunk_path)
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
