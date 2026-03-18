"""
Volcengine (豆包) ASR service wrapper.
Uses the v3 BigModel recording recognition API (submit + query pattern)
with speaker diarization support.

Audio is sent via base64-encoded data to avoid public URL callback issues.

Submit: POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit
Query:  POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query
"""
import asyncio
import base64
import json
import logging
import os
import subprocess
import uuid
from pathlib import Path

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
RESOURCE_ID = "volc.bigasr.auc"

POLL_INTERVAL = 3   # seconds
MAX_POLL_TIME = 600  # 10 minutes

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


async def submit_asr_task(stored_name: str, content_type: str = "audio/mpeg") -> dict:
    """
    Submit audio for ASR processing using the v3 BigModel API.
    Audio is sent as base64-encoded data to avoid URL callback issues.

    Args:
        stored_name: The stored filename in meeting-audio directory
        content_type: MIME type of the audio

    Returns dict with segments and full text.
    """
    format_map = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/wave": "wav",
        "audio/m4a": "m4a",
        "audio/x-m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/flac": "flac",
        "audio/aac": "aac",
        "audio/x-ms-wma": "wma",
        "audio/amr": "amr",
    }
    audio_format = format_map.get(content_type, "mp3")

    # Get local file path
    local_path = _get_local_path(stored_name)

    # Transcode unsupported formats to mp3
    if audio_format not in ASR_SUPPORTED_FORMATS:
        try:
            local_path = _transcode_to_mp3(local_path)
            audio_format = "mp3"
            logger.info("Using transcoded file: %s", local_path)
        except Exception as e:
            logger.error("Transcode failed: %s, trying original", e)

    # Read file and encode as base64
    with open(local_path, "rb") as f:
        audio_data = base64.b64encode(f.read()).decode("utf-8")
    file_size_kb = len(audio_data) * 3 / 4 / 1024  # approximate original size
    logger.info("Audio loaded: format=%s, ~%.1f KB", audio_format, file_size_kb)

    request_id = str(uuid.uuid4())
    headers = _build_headers(request_id)

    body = {
        "user": {
            "uid": "punkrecord-user",
        },
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
            # Step 1: Submit task
            logger.info("Submitting ASR task (base64 data), request_id=%s", request_id)
            resp = await client.post(SUBMIT_URL, json=body, headers=headers)

            # v3 API returns status in response header
            status_code = resp.headers.get("X-Api-Status-Code", "")
            message = resp.headers.get("X-Api-Message", "")

            if status_code != "20000000":
                logger.error("ASR submit error: status=%s, message=%s, body=%s",
                             status_code, message, resp.text[:500])
                return {
                    "error": f"ASR submit failed: status={status_code}, message={message}",
                    "segments": [], "text": "",
                }

            logger.info("ASR task submitted successfully, request_id=%s, polling...", request_id)

            # Step 2: Poll for result using the same request_id
            elapsed = 0
            while elapsed < MAX_POLL_TIME:
                await asyncio.sleep(POLL_INTERVAL)
                elapsed += POLL_INTERVAL

                # Query uses same headers (same request_id)
                query_resp = await client.post(QUERY_URL, json={}, headers=headers)
                q_status = query_resp.headers.get("X-Api-Status-Code", "")
                q_message = query_resp.headers.get("X-Api-Message", "")

                if q_status == "20000000":
                    # Success
                    logger.info("ASR task completed after %ds", elapsed)
                    result = query_resp.json()
                    return _parse_asr_response(result)

                elif q_status in ("20000001", "20000002"):
                    # 20000001 = processing, 20000002 = queued
                    if elapsed % 15 == 0:
                        label = "processing" if q_status == "20000001" else "queued"
                        logger.info("ASR task %s, elapsed %ds...", label, elapsed)
                    continue

                elif q_status == "20000003":
                    # Silent audio
                    logger.warning("ASR: silent audio detected")
                    return {"segments": [], "text": ""}

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
        return {"error": str(e), "segments": [], "text": ""}


def _parse_asr_response(response: dict) -> dict:
    """Parse the v3 BigModel ASR response into structured segments."""
    segments = []
    full_text_parts = []

    # v3 API: result.utterances[]
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
        # Speaker info can be in additions.speaker or direct speaker field
        additions = utt.get("additions", {})
        speaker = additions.get("speaker") or utt.get("speaker", str(idx % 4))
        speaker_id = f"speaker_{speaker}"

        start = utt.get("start_time", 0) / 1000.0  # ms -> seconds
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
