"""
ChromaDB vector store wrapper.
Persistent embedded mode — data stored on disk.
"""
import logging
from typing import List, Optional
from uuid import uuid4

import chromadb

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Optional[chromadb.ClientAPI] = None
COLLECTION_NAME = "kb_documents"


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
        logger.info("ChromaDB initialized at %s", settings.CHROMADB_PATH)
    return _client


def _get_collection() -> chromadb.Collection:
    client = _get_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def add_embeddings(
    ids: List[str],
    embeddings: List[List[float]],
    documents: List[str],
    metadatas: Optional[List[dict]] = None,
) -> None:
    """Add vectors to the collection."""
    collection = _get_collection()
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )
    logger.info("Added %d embeddings to ChromaDB", len(ids))


def search(
    query_embedding: List[float],
    top_k: int = 5,
    where: Optional[dict] = None,
) -> dict:
    """
    Search similar vectors.
    Returns ChromaDB query result dict with keys:
        ids, documents, metadatas, distances
    """
    collection = _get_collection()
    kwargs = {
        "query_embeddings": [query_embedding],
        "n_results": top_k,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where

    return collection.query(**kwargs)


def delete_by_document_id(document_id: str) -> None:
    """Delete all chunks belonging to a document."""
    collection = _get_collection()
    collection.delete(where={"document_id": document_id})
    logger.info("Deleted embeddings for document %s", document_id)


def generate_chromadb_id() -> str:
    return str(uuid4())
