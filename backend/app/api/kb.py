"""
Knowledge Base (企业大脑) API endpoints
"""
import asyncio
from app.models.base import now_cn
import logging
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.auth import require_permission
from app.core.exceptions import NotFoundException, AtlasException
from app.core.response import success_response
from app.core.storage import save_file, get_file, delete_file, get_download_url
from app.models.iam import User
from app.models.kb import (
    KBDocument, KBDocumentChunk, KBConversation, KBMessage, KBDocumentStatus,
)
from app.schemas.kb import (
    DocumentUploadResponse, DocumentResponse, DocumentUpdate,
    DocumentListResponse, ConversationCreate, ConversationResponse,
    MessageResponse, ChatRequest, SearchRequest, SearchResult, SearchResponse,
)
from app.services.kb_pipeline import process_document
from app.services.rag_service import rag_chat_stream, search_documents
from app.services import vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kb", tags=["KnowledgeBase"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_document(doc: KBDocument, session: Session) -> DocumentResponse:
    """Build DocumentResponse with resolved uploader name."""
    uploader = session.get(User, doc.uploaded_by)
    data = DocumentResponse.model_validate(doc)
    data.uploader_name = uploader.display_name if uploader else None
    return data


# ─── Document Upload ─────────────────────────────────────────────────────────

@router.post("/documents/upload", response_model=dict)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """Upload a document to the knowledge base."""
    if not file.filename:
        raise AtlasException("文件名不能为空")

    file_bytes = await file.read()
    if not file_bytes:
        raise AtlasException("文件内容不能为空")

    # Generate unique stored name
    ext = Path(file.filename).suffix[:20]
    stored_name = f"{uuid4().hex}{ext}"
    content_type = file.content_type or "application/octet-stream"

    # Save to storage
    save_file("kb-documents", stored_name, file_bytes, content_type)

    # Create DB record
    doc = KBDocument(
        title=title or file.filename,
        file_name=file.filename,
        stored_name=stored_name,
        content_type=content_type,
        file_size=len(file_bytes),
        storage_directory="kb-documents",
        status=KBDocumentStatus.PROCESSING,
        uploaded_by=current_user.id,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    # Kick off background processing
    asyncio.ensure_future(process_document(doc.id))

    resp = DocumentUploadResponse.model_validate(doc)
    return success_response(resp.model_dump())


# ─── Document List ───────────────────────────────────────────────────────────

@router.get("/documents", response_model=dict)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """List knowledge base documents with optional filters."""
    query = select(KBDocument)

    if status:
        query = query.where(KBDocument.status == status)
    if search:
        query = query.where(KBDocument.title.contains(search))

    query = query.order_by(KBDocument.created_at.desc())

    # Get all for total count (and tag filtering)
    all_docs = session.exec(query).all()

    # Filter by tag in-memory (JSON field)
    if tag:
        all_docs = [d for d in all_docs if tag in (d.tags or [])]

    total = len(all_docs)
    items = all_docs[skip : skip + limit]

    return success_response({
        "items": [_enrich_document(d, session).model_dump() for d in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    })


# ─── Document Detail ─────────────────────────────────────────────────────────

@router.get("/documents/{document_id}", response_model=dict)
async def get_document(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """Get a single document's detail."""
    doc = session.get(KBDocument, document_id)
    if not doc:
        raise NotFoundException("未找到文档")

    return success_response(_enrich_document(doc, session).model_dump())


# ─── Document Update ─────────────────────────────────────────────────────────

@router.patch("/documents/{document_id}", response_model=dict)
async def update_document(
    document_id: UUID,
    data: DocumentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """Update document title, description, or tags."""
    doc = session.get(KBDocument, document_id)
    if not doc:
        raise NotFoundException("未找到文档")

    if data.title is not None:
        doc.title = data.title
    if data.description is not None:
        doc.description = data.description
    if data.tags is not None:
        doc.tags = data.tags

    doc.updated_at = now_cn()
    session.add(doc)
    session.commit()
    session.refresh(doc)

    return success_response(_enrich_document(doc, session).model_dump())


# ─── Document Delete ─────────────────────────────────────────────────────────

@router.delete("/documents/{document_id}", response_model=dict)
async def delete_document(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """Delete a document, its chunks, and ChromaDB vectors."""
    doc = session.get(KBDocument, document_id)
    if not doc:
        raise NotFoundException("未找到文档")

    # Delete vectors from ChromaDB
    try:
        vector_store.delete_by_document_id(str(doc.id))
    except Exception as e:
        logger.warning("Failed to delete vectors for document %s: %s", doc.id, e)

    # Delete file from storage
    try:
        delete_file(doc.storage_directory, doc.stored_name)
    except Exception as e:
        logger.warning("Failed to delete file for document %s: %s", doc.id, e)

    # Delete chunks from DB
    chunks = session.exec(
        select(KBDocumentChunk).where(KBDocumentChunk.document_id == doc.id)
    ).all()
    for chunk in chunks:
        session.delete(chunk)

    # Delete the document
    session.delete(doc)
    session.commit()

    return success_response({"message": "文档已删除"})


# ─── Document Download ───────────────────────────────────────────────────────

@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """Download the original document file."""
    doc = session.get(KBDocument, document_id)
    if not doc:
        raise NotFoundException("未找到文档")

    # Check for pre-signed URL (TOS backend)
    url = get_download_url(doc.storage_directory, doc.stored_name)
    if url:
        return RedirectResponse(url)

    # Local storage: return file directly
    try:
        _, local_path = get_file(doc.storage_directory, doc.stored_name)
    except FileNotFoundError:
        raise NotFoundException("文件不存在")

    return FileResponse(
        path=local_path,
        media_type=doc.content_type or "application/octet-stream",
        filename=doc.file_name,
    )


# ─── Document Reprocess ─────────────────────────────────────────────────────

@router.post("/documents/{document_id}/reprocess", response_model=dict)
async def reprocess_document(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """Re-run the processing pipeline for a document."""
    doc = session.get(KBDocument, document_id)
    if not doc:
        raise NotFoundException("未找到文档")

    # Delete existing vectors
    try:
        vector_store.delete_by_document_id(str(doc.id))
    except Exception as e:
        logger.warning("Failed to delete vectors for reprocess %s: %s", doc.id, e)

    # Delete existing chunks
    chunks = session.exec(
        select(KBDocumentChunk).where(KBDocumentChunk.document_id == doc.id)
    ).all()
    for chunk in chunks:
        session.delete(chunk)

    # Reset status
    doc.status = KBDocumentStatus.PROCESSING
    doc.chunk_count = 0
    doc.extracted_text = None
    doc.summary = None
    doc.updated_at = now_cn()
    session.add(doc)
    session.commit()

    # Re-run pipeline
    asyncio.ensure_future(process_document(doc.id))

    return success_response({"message": "文档正在重新处理", "id": str(doc.id)})


# ─── Tags ────────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=dict)
async def list_tags(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """Get all unique tags across knowledge base documents."""
    docs = session.exec(select(KBDocument)).all()
    tag_set: set[str] = set()
    for doc in docs:
        for tag in (doc.tags or []):
            tag_set.add(tag)

    return success_response(sorted(tag_set))


# ─── Conversations ───────────────────────────────────────────────────────────

@router.post("/conversations", response_model=dict)
async def create_conversation(
    data: ConversationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """Create a new RAG conversation."""
    conv = KBConversation(
        title=data.title,
        user_id=current_user.id,
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)

    resp = ConversationResponse.model_validate(conv)
    return success_response(resp.model_dump())


@router.get("/conversations", response_model=dict)
async def list_conversations(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """List current user's conversations, ordered by most recent."""
    convs = session.exec(
        select(KBConversation)
        .where(KBConversation.user_id == current_user.id)
        .order_by(KBConversation.updated_at.desc())
    ).all()

    items = []
    for conv in convs:
        resp = ConversationResponse.model_validate(conv)
        # Get last message preview
        last_msg = session.exec(
            select(KBMessage)
            .where(KBMessage.conversation_id == conv.id)
            .order_by(KBMessage.created_at.desc())
        ).first()
        resp.last_message = last_msg.content[:100] if last_msg else None
        items.append(resp.model_dump())

    return success_response(items)


@router.get("/conversations/{conversation_id}/messages", response_model=dict)
async def list_messages(
    conversation_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """Get all messages for a conversation."""
    conv = session.get(KBConversation, conversation_id)
    if not conv:
        raise NotFoundException("未找到对话")
    if conv.user_id != current_user.id:
        raise NotFoundException("未找到对话")

    messages = session.exec(
        select(KBMessage)
        .where(KBMessage.conversation_id == conversation_id)
        .order_by(KBMessage.created_at)
    ).all()

    items = [MessageResponse.model_validate(m).model_dump() for m in messages]
    return success_response(items)


@router.delete("/conversations/{conversation_id}", response_model=dict)
async def delete_conversation(
    conversation_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """Delete a conversation and all its messages."""
    conv = session.get(KBConversation, conversation_id)
    if not conv:
        raise NotFoundException("未找到对话")
    if conv.user_id != current_user.id:
        raise NotFoundException("未找到对话")

    # Delete messages
    messages = session.exec(
        select(KBMessage).where(KBMessage.conversation_id == conv.id)
    ).all()
    for msg in messages:
        session.delete(msg)

    session.delete(conv)
    session.commit()

    return success_response({"message": "对话已删除"})


# ─── RAG Chat ────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    data: ChatRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.write")),
):
    """RAG chat with SSE streaming response."""
    # Get or create conversation
    if data.conversation_id:
        conv = session.get(KBConversation, data.conversation_id)
        if not conv:
            raise NotFoundException("未找到对话")
        if conv.user_id != current_user.id:
            raise NotFoundException("未找到对话")
    else:
        conv = KBConversation(
            user_id=current_user.id,
        )
        session.add(conv)
        session.commit()
        session.refresh(conv)

    generator = rag_chat_stream(
        user_message=data.message,
        conversation=conv,
        session=session,
        document_ids=data.document_ids,
    )

    return StreamingResponse(generator, media_type="text/event-stream")


# ─── Semantic Search ─────────────────────────────────────────────────────────

@router.post("/search", response_model=dict)
async def semantic_search(
    data: SearchRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("kb.read")),
):
    """Semantic search over the knowledge base."""
    results = await search_documents(
        query=data.query,
        top_k=data.top_k,
        tags=data.tags,
        session=session,
    )

    return success_response({
        "results": results,
        "query": data.query,
    })
