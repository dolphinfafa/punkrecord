"""
Todo module Pydantic schemas
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class TodoCreate(BaseModel):
    """Todo creation schema"""
    our_entity_id: UUID
    assignee_user_id: UUID
    title: str
    description: Optional[str] = None
    source_type: str
    source_id: str
    action_type: str
    priority: str = "p2"
    due_at: Optional[datetime] = None
    start_at: Optional[datetime] = None
    tags: list[str] = []
    link: Optional[dict] = None


class TodoUpdate(BaseModel):
    """Todo update schema"""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[datetime] = None
    start_at: Optional[datetime] = None
    tags: Optional[list[str]] = None


class TodoStatusUpdate(BaseModel):
    """Todo status update schema"""
    status: str
    blocked_reason: Optional[str] = None
    dismiss_reason: Optional[str] = None


class TodoResponse(BaseModel):
    """Todo response schema"""
    id: UUID
    our_entity_id: UUID
    assignee_user_id: UUID
    creator_user_id: UUID
    title: str
    description: Optional[str] = None
    source_type: str
    source_id: str
    action_type: str
    priority: str
    status: str
    due_at: Optional[datetime] = None
    start_at: Optional[datetime] = None
    tags: list
    link: Optional[dict] = None
    blocked_reason: Optional[str] = None
    done_at: Optional[datetime] = None
    done_by_user_id: Optional[UUID] = None
    dismiss_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
