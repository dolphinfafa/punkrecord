"""
Knowledge Base models — documents, chunks, conversations, messages
"""
import enum
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from sqlmodel import Field, SQLModel, Column, JSON, TEXT

from app.models.base import BaseDBModel


class KBDocumentStatus(str, enum.Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class KBDocument(BaseDBModel, table=True):
    """Knowledge base document"""
    __tablename__ = "kb_document"

    title: str = Field(nullable=False)
    file_name: str = Field(nullable=False)
    stored_name: str = Field(nullable=False)
    content_type: str = Field(nullable=False)
    file_size: int = Field(nullable=False)
    storage_directory: str = Field(default="kb-documents")
    extracted_text: Optional[str] = Field(default=None, sa_column=Column(TEXT))
    summary: Optional[str] = Field(default=None, sa_column=Column(TEXT))
    tags: list = Field(default=[], sa_column=Column(JSON))
    description: Optional[str] = Field(default=None)
    status: KBDocumentStatus = Field(default=KBDocumentStatus.PROCESSING, index=True)
    chunk_count: int = Field(default=0)
    uploaded_by: UUID = Field(foreign_key="users.id")
    source_type: Optional[str] = Field(default=None)
    source_id: Optional[UUID] = Field(default=None)


class KBDocumentChunk(BaseDBModel, table=True):
    """Document text chunk for embedding"""
    __tablename__ = "kb_document_chunk"

    document_id: UUID = Field(foreign_key="kb_document.id", index=True)
    chunk_index: int = Field(default=0)
    content: str = Field(sa_column=Column(TEXT))
    token_count: int = Field(default=0)
    chromadb_id: Optional[str] = Field(default=None)


class KBConversation(BaseDBModel, table=True):
    """RAG conversation session"""
    __tablename__ = "kb_conversation"

    title: Optional[str] = Field(default=None)
    user_id: UUID = Field(foreign_key="users.id", index=True)


class KBMessage(BaseDBModel, table=True):
    """Conversation message"""
    __tablename__ = "kb_message"

    conversation_id: UUID = Field(foreign_key="kb_conversation.id", index=True)
    role: str = Field(nullable=False)  # "user" / "assistant"
    content: str = Field(sa_column=Column(TEXT))
    references: list = Field(default=[], sa_column=Column(JSON))
    attached_document_id: Optional[UUID] = Field(default=None, foreign_key="kb_document.id")
