"""
Storage abstraction layer — supports local filesystem and Volcengine TOS.
"""
import io
import logging
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy-init TOS client
_tos_client = None


def _get_tos_client():
    global _tos_client
    if _tos_client is not None:
        return _tos_client

    import tos
    _tos_client = tos.TosClientV2(
        ak=settings.TOS_ACCESS_KEY,
        sk=settings.TOS_SECRET_KEY,
        endpoint=settings.TOS_ENDPOINT,
        region=settings.TOS_REGION,
    )
    return _tos_client


def _tos_key(directory: str, filename: str) -> str:
    """Build TOS object key: directory/filename."""
    return f"{directory.strip('/')}/{filename}"


def save_file(directory: str, filename: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """
    Save file to configured storage backend.

    Args:
        directory: logical sub-directory, e.g. "project-attachments"
        filename: stored filename (already unique)
        data: file bytes
        content_type: MIME type

    Returns:
        storage path/key for later retrieval
    """
    if settings.STORAGE_BACKEND == "tos":
        client = _get_tos_client()
        key = _tos_key(directory, filename)
        client.put_object(
            settings.TOS_BUCKET,
            key,
            content=io.BytesIO(data),
            content_type=content_type,
        )
        logger.info("Uploaded to TOS: %s", key)
        return key
    else:
        base = Path(__file__).resolve().parents[2] / "uploads" / directory
        base.mkdir(parents=True, exist_ok=True)
        file_path = base / filename
        file_path.write_bytes(data)
        return str(file_path)


def get_file(directory: str, filename: str) -> tuple[bytes, str]:
    """
    Retrieve file content from storage.

    Returns:
        (file_bytes, local_path_or_empty)
        For TOS backend, local_path is empty string.
    """
    if settings.STORAGE_BACKEND == "tos":
        client = _get_tos_client()
        key = _tos_key(directory, filename)
        resp = client.get_object(settings.TOS_BUCKET, key)
        data = resp.read()
        return data, ""
    else:
        base = Path(__file__).resolve().parents[2] / "uploads" / directory
        file_path = base / filename
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return file_path.read_bytes(), str(file_path)


def delete_file(directory: str, filename: str) -> None:
    """Delete file from storage."""
    if settings.STORAGE_BACKEND == "tos":
        client = _get_tos_client()
        key = _tos_key(directory, filename)
        client.delete_object(settings.TOS_BUCKET, key)
        logger.info("Deleted from TOS: %s", key)
    else:
        base = Path(__file__).resolve().parents[2] / "uploads" / directory
        file_path = base / filename
        if file_path.exists():
            file_path.unlink()


def get_download_url(directory: str, filename: str, expires: int = 3600) -> Optional[str]:
    """
    Generate a pre-signed download URL (TOS only).
    For local backend returns None — caller should fall back to FileResponse.
    """
    if settings.STORAGE_BACKEND != "tos":
        return None
    client = _get_tos_client()
    key = _tos_key(directory, filename)
    url = client.pre_signed_url("GET", settings.TOS_BUCKET, key, expires=expires)
    return url.signed_url
