"""
RAG conversation service:
  Embed query → ChromaDB search → build context → Gemini stream response
"""
import json
import logging
from typing import AsyncGenerator, List, Optional
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models.kb import KBDocument, KBDocumentChunk, KBConversation, KBMessage
from app.services import embedding_service, vector_store

logger = logging.getLogger(__name__)


async def search_documents(
    query: str,
    top_k: int = 5,
    tags: Optional[List[str]] = None,
    session: Optional[Session] = None,
) -> list[dict]:
    """Semantic search over knowledge base. Returns list of result dicts."""
    query_emb = await embedding_service.embed_single(query)

    results = vector_store.search(query_emb, top_k=top_k)

    items = []
    ids_list = results.get("ids", [[]])[0]
    docs_list = results.get("documents", [[]])[0]
    metas_list = results.get("metadatas", [[]])[0]
    dists_list = results.get("distances", [[]])[0]

    for i, chromadb_id in enumerate(ids_list):
        meta = metas_list[i] if i < len(metas_list) else {}
        doc_id = meta.get("document_id", "")
        chunk_idx = meta.get("chunk_index", 0)
        distance = dists_list[i] if i < len(dists_list) else 1.0
        score = 1.0 - distance  # cosine distance → similarity

        doc_title = ""
        if session and doc_id:
            doc = session.get(KBDocument, UUID(doc_id))
            if doc:
                doc_title = doc.title
                # Filter by tags if requested
                if tags and not any(t in (doc.tags or []) for t in tags):
                    continue

        items.append({
            "chunk_content": docs_list[i] if i < len(docs_list) else "",
            "document_id": doc_id,
            "document_title": doc_title,
            "chunk_index": chunk_idx,
            "score": round(score, 4),
        })

    return items


async def rag_chat_stream(
    user_message: str,
    conversation: KBConversation,
    session: Session,
    document_ids: Optional[List[UUID]] = None,
) -> AsyncGenerator[str, None]:
    """
    RAG chat with SSE streaming.
    Yields SSE-formatted data lines.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        yield f"data: {json.dumps({'error': 'GEMINI_API_KEY not configured'})}\n\n"
        return

    # 1. Retrieve relevant context
    try:
        search_results = await search_documents(
            user_message, top_k=settings.KB_RAG_TOP_K, session=session
        )
    except RuntimeError as e:
        logger.warning("RAG retrieval unavailable: %s", e)
        yield f"data: {json.dumps({'error': '知识库检索服务暂不可用（嵌入服务未配置），请联系管理员。'})}\n\n"
        return

    # Build context from search results
    context_parts = []
    references = []
    for r in search_results:
        if r["score"] > 0.3:  # relevance threshold
            context_parts.append(
                f"[来源: {r['document_title']}]\n{r['chunk_content']}"
            )
            references.append({
                "document_id": r["document_id"],
                "document_title": r["document_title"],
                "chunk_index": r["chunk_index"],
                "score": r["score"],
            })

    context_text = "\n\n---\n\n".join(context_parts) if context_parts else "未找到相关文档内容。"

    # 2. Build conversation history
    history_messages = session.exec(
        select(KBMessage)
        .where(KBMessage.conversation_id == conversation.id)
        .order_by(KBMessage.created_at)
    ).all()

    gemini_contents = []
    for msg in history_messages[-10:]:  # Keep last 10 messages for context
        role = "user" if msg.role == "user" else "model"
        gemini_contents.append({
            "role": role,
            "parts": [{"text": msg.content}],
        })

    # Add current user message with context
    augmented_message = f"""请根据以下企业知识库中的参考资料回答用户的问题。如果参考资料中没有相关信息，请如实说明。

参考资料：
{context_text}

用户问题：{user_message}"""

    gemini_contents.append({
        "role": "user",
        "parts": [{"text": augmented_message}],
    })

    # 3. Save user message
    user_msg = KBMessage(
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    session.add(user_msg)
    session.commit()

    # 4. Stream response from Gemini
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key={api_key}"

    payload = {
        "contents": gemini_contents,
        "systemInstruction": {
            "role": "user",
            "parts": [{"text": "你是企业知识库AI助手，基于提供的参考资料准确回答问题。回答要专业、简洁、有条理。如果资料不足以回答，请如实说明。"}],
        },
    }

    full_response = ""

    try:
        async with httpx.AsyncClient(verify=False, timeout=300.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"data: {json.dumps({'error': f'API Error {response.status_code}'})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        raw = line[6:]
                        try:
                            chunk_data = json.loads(raw)
                            text = (
                                chunk_data.get("candidates", [{}])[0]
                                .get("content", {})
                                .get("parts", [{}])[0]
                                .get("text", "")
                            )
                            if text:
                                full_response += text
                                yield f"data: {json.dumps({'text': text})}\n\n"
                        except json.JSONDecodeError:
                            pass

        # Send references at the end
        if references:
            yield f"data: {json.dumps({'references': references})}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.exception("RAG stream error: %s", e)
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        return

    # 5. Save assistant message
    assistant_msg = KBMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=full_response,
        references=references,
    )
    session.add(assistant_msg)

    # Update conversation title if first exchange
    if not conversation.title and full_response:
        conversation.title = user_message[:50]
        session.add(conversation)

    session.commit()
