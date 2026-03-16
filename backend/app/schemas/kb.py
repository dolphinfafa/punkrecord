"""
Knowledge Base schemas
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    id: UUID
    title: str
    file_name: str
    content_type: str
    file_size: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: UUID
    title: str
    file_name: str
    content_type: str
    file_size: int
    status: str
    tags: list = []
    summary: Optional[str] = None
    description: Optional[str] = None
    chunk_count: int = 0
    uploaded_by: UUID
    uploader_name: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list] = None


class DocumentListResponse(BaseModel):
    items: List[DocumentResponse]
    total: int
    skip: int
    limit: int


class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: UUID
    title: Optional[str] = None
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    references: list = []
    attached_document_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[UUID] = None
    document_ids: Optional[List[UUID]] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    tags: Optional[List[str]] = None


class SearchResult(BaseModel):
    chunk_content: str
    document_id: UUID
    document_title: str
    chunk_index: int
    score: float


class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
