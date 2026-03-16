"""
Gemini Embedding API wrapper.
Uses text-embedding-004 model for generating vector embeddings.
"""
import logging
from typing import List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSION = 768  # text-embedding-004 output dimension


async def embed_single(text: str) -> List[float]:
    """Generate embedding for a single text."""
    results = await embed_batch([text])
    return results[0]


async def embed_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a batch of texts using Gemini Embedding API.
    Splits into sub-batches of 100 if needed.
    """
    if not texts:
        return []

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    model = settings.GEMINI_EMBEDDING_MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents?key={api_key}"

    all_embeddings: List[List[float]] = []
    batch_size = 100

    async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            payload = {
                "requests": [
                    {
                        "model": f"models/{model}",
                        "content": {"parts": [{"text": t}]},
                    }
                    for t in batch
                ]
            }

            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

            for emb in data.get("embeddings", []):
                all_embeddings.append(emb["values"])

    if len(all_embeddings) != len(texts):
        raise RuntimeError(
            f"Embedding count mismatch: expected {len(texts)}, got {len(all_embeddings)}"
        )

    return all_embeddings
