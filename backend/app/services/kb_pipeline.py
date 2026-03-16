"""
Document processing pipeline:
  save file → extract text → chunk → embed → store in ChromaDB → AI tags & summary
Runs as a BackgroundTask.
"""
import json
import logging
from uuid import UUID

import httpx
from sqlmodel import Session

from app.core.config import settings
from app.core.database import engine
from app.models.kb import KBDocument, KBDocumentChunk, KBDocumentStatus
from app.core.storage import get_file
from app.services.document_parser import extract_text, chunk_text
from app.services import embedding_service, vector_store

logger = logging.getLogger(__name__)


async def process_document(document_id: UUID) -> None:
    """Full pipeline for a single document. Called via BackgroundTasks."""
    try:
        with Session(engine) as session:
            doc = session.get(KBDocument, document_id)
            if not doc:
                logger.error("Document %s not found", document_id)
                return

            # 1. Read file
            file_bytes, _ = get_file(doc.storage_directory, doc.stored_name)

            # 2. Extract text
            text = extract_text(file_bytes, doc.content_type, doc.file_name)
            if not text.strip():
                doc.status = KBDocumentStatus.FAILED
                doc.extracted_text = ""
                session.add(doc)
                session.commit()
                logger.warning("No text extracted from %s", doc.file_name)
                return

            doc.extracted_text = text

            # 3. Chunk
            chunks = chunk_text(text)
            doc.chunk_count = len(chunks)

            # 4. Save chunks to DB
            chunk_models = []
            for idx, (content, token_count) in enumerate(chunks):
                cid = vector_store.generate_chromadb_id()
                chunk_model = KBDocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=content,
                    token_count=token_count,
                    chromadb_id=cid,
                )
                session.add(chunk_model)
                chunk_models.append((cid, content))

            session.commit()

            # 5. Embed & store in ChromaDB
            texts_to_embed = [c[1] for c in chunk_models]
            ids = [c[0] for c in chunk_models]

            embeddings = await embedding_service.embed_batch(texts_to_embed)

            metadatas = [
                {"document_id": str(doc.id), "chunk_index": i}
                for i in range(len(ids))
            ]
            vector_store.add_embeddings(ids, embeddings, texts_to_embed, metadatas)

            # 6. AI generate tags & summary
            summary, tags = await _generate_summary_and_tags(text, doc.title)
            doc.summary = summary
            doc.tags = tags

            doc.status = KBDocumentStatus.READY
            session.add(doc)
            session.commit()
            logger.info("Document %s processed successfully", doc.id)

    except Exception as e:
        logger.exception("Pipeline failed for document %s: %s", document_id, e)
        try:
            with Session(engine) as session:
                doc = session.get(KBDocument, document_id)
                if doc:
                    doc.status = KBDocumentStatus.FAILED
                    session.add(doc)
                    session.commit()
        except Exception:
            pass


async def _generate_summary_and_tags(text: str, title: str) -> tuple[str, list]:
    """Use Gemini to produce a summary and auto-classification tags."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return "", []

    # Truncate text to avoid exceeding context
    truncated = text[:8000]

    prompt = f"""请分析以下文档并输出 JSON，格式为：
{{"summary": "200字以内的中文摘要", "tags": ["标签1", "标签2", ...]}}

标签要求：3-6个，反映文档主题和类型（如：技术文档、会议纪要、财务报告等）。

文档标题：{title}
文档内容：
{truncated}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    try:
        async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw = data["candidates"][0]["content"]["parts"][0]["text"]
            result = json.loads(raw)
            return result.get("summary", ""), result.get("tags", [])
    except Exception as e:
        logger.error("AI summary/tags failed: %s", e)
        return "", []
