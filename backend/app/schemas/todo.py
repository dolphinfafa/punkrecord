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
    source_type: str = "custom"
    source_id: str = ""
    action_type: str = "do"
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


class TodoReviewAction(BaseModel):
    """Schema for manager review actions (approve/reject)"""
    comment: Optional[str] = None  # Required for reject, optional for approve


class TodoResponse(BaseModel):
    """Todo response schema"""
    id: UUID
    our_entity_id: UUID
    assignee_user_id: UUID
    assignee_name: Optional[str] = None
    creator_user_id: UUID
    creator_name: Optional[str] = None
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
    review_comment: Optional[str] = None
    reviewed_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
