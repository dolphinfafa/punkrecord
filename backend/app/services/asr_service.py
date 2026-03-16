"""
Volcengine (豆包) ASR service wrapper.
App key: 7858270680
Uses the large-model ASR HTTP API with speaker diarization.
"""
import gzip
import json
import logging
import uuid
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ASR_API_URL = "https://openspeech.bytedance.com/api/v3/sauc/bigmodel"


def _build_request_payload(audio_data: bytes, audio_format: str = "mp3") -> dict:
    """Build the request payload for Volcengine ASR API."""
    return {
        "app": {
            "appid": settings.VOLC_ASR_APP_KEY,
            "token": settings.VOLC_ASR_ACCESS_KEY,
            "cluster": "volcengine_streaming_common",
        },
        "user": {
            "uid": "punkrecord-user",
        },
        "request": {
            "reqid": str(uuid.uuid4()),
            "sequence": 1,
            "nbest": 1,
            "show_utterances": True,
        },
        "audio": {
            "format": audio_format,
            "codec": "raw",
            "rate": 16000,
            "language": "zh-CN",
            "bits": 16,
            "channel": 1,
        },
    }


async def submit_asr_task(audio_data: bytes, content_type: str = "audio/mpeg") -> dict:
    """
    Submit audio for ASR processing.
    Returns dict with segments and full text.

    For the streaming big-model ASR, we send the audio in one shot
    and parse the response.
    """
    # Determine audio format from content type
    format_map = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/wave": "wav",
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/flac": "flac",
    }
    audio_format = format_map.get(content_type, "mp3")

    payload = _build_request_payload(audio_data, audio_format)
    payload_bytes = json.dumps(payload).encode()

    # Compress payload
    compressed_payload = gzip.compress(payload_bytes)

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, */*",
        "Authorization": f"Bearer; {settings.VOLC_ASR_ACCESS_KEY}",
    }

    try:
        async with httpx.AsyncClient(verify=False, timeout=300.0) as client:
            # Step 1: Submit the full audio for recognition
            # For large files, we use the non-streaming endpoint
            submit_url = "https://openspeech.bytedance.com/api/v3/sauc/bigmodel"

            # Build multipart or direct request
            full_payload = {
                **payload,
                "audio": {
                    **payload["audio"],
                    "data": __import__("base64").b64encode(audio_data).decode(),
                },
            }

            resp = await client.post(
                submit_url,
                json=full_payload,
                headers=headers,
            )

            if resp.status_code != 200:
                logger.error("ASR API error: %s %s", resp.status_code, resp.text)
                return {"error": f"ASR API returned {resp.status_code}", "segments": [], "text": ""}

            result = resp.json()
            return _parse_asr_response(result)

    except Exception as e:
        logger.exception("ASR submission failed: %s", e)
        return {"error": str(e), "segments": [], "text": ""}


def _parse_asr_response(response: dict) -> dict:
    """Parse the Volcengine ASR response into structured segments."""
    segments = []
    full_text_parts = []

    # Handle different response formats
    utterances = response.get("result", {}).get("utterances", [])
    if not utterances:
        # Try alternative response structure
        text = response.get("result", {}).get("text", "")
        if text:
            segments.append({
                "segment_index": 0,
                "speaker_id": "speaker_0",
                "start_time": 0.0,
                "end_time": 0.0,
                "content": text,
            })
            return {"segments": segments, "text": text}
        return {"segments": [], "text": "", "raw": response}

    for idx, utt in enumerate(utterances):
        speaker = utt.get("speaker", f"speaker_{idx % 4}")
        start = utt.get("start_time", 0) / 1000.0  # ms → seconds
        end = utt.get("end_time", 0) / 1000.0
        text = utt.get("text", "")

        if text.strip():
            segments.append({
                "segment_index": idx,
                "speaker_id": str(speaker),
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "content": text.strip(),
            })
            full_text_parts.append(text.strip())

    return {
        "segments": segments,
        "text": "\n".join(full_text_parts),
    }


async def poll_asr_status(task_id: str) -> dict:
    """
    Poll ASR task status.
    Returns {"status": "processing"/"completed"/"failed", ...}
    """
    # For the synchronous API, this is a no-op placeholder.
    # If we switch to async task-based ASR, implement polling here.
    return {"status": "completed", "task_id": task_id}
