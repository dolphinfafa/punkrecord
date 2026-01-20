"""
Todo Module Models
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Column, JSON, SQLModel
from app.models.base import BaseDBModel


class TodoSourceType(str, Enum):
    """Todo source type"""
    PROJECT_TASK = "project_task"
    APPROVAL_STEP = "approval_step"
    CONTRACT_REMINDER = "contract_reminder"
    FINANCE_ACTION = "finance_action"
    CUSTOM = "custom"


class TodoActionType(str, Enum):
    """Todo action type"""
    DO = "do"
    APPROVE = "approve"
    REVIEW = "review"
    ACK = "ack"


class TodoPriority(str, Enum):
    """Todo priority"""
    P0 = "p0"
    P1 = "p1"
    P2 = "p2"
    P3 = "p3"


class TodoStatus(str, Enum):
    """Todo status"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    DISMISSED = "dismissed"


class TodoItem(BaseDBModel, table=True):
    """Todo item model"""
    __tablename__ = "todo_item"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False)
    assignee_user_id: UUID = Field(foreign_key="user.id", nullable=False, index=True)
    creator_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    
    title: str = Field(nullable=False)
    description: Optional[str] = None
    
    source_type: TodoSourceType = Field(nullable=False, index=True)
    source_id: str = Field(nullable=False, index=True)  # Unique constraint with source_type
    action_type: TodoActionType = Field(nullable=False)
    
    priority: TodoPriority = Field(default=TodoPriority.P2, nullable=False)
    status: TodoStatus = Field(default=TodoStatus.OPEN, nullable=False, index=True)
    
    due_at: Optional[datetime] = None
    start_at: Optional[datetime] = None
    
    tags: list = Field(default=[], sa_column=Column(JSON))
    link: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    blocked_reason: Optional[str] = None
    done_at: Optional[datetime] = None
    done_by_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    dismiss_reason: Optional[str] = None


class NotificationChannel(str, Enum):
    """Notification channel"""
    IN_APP = "in_app"
    EMAIL = "email"
    WEBHOOK = "webhook"


class NotificationStatus(str, Enum):
    """Notification status"""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class NotificationLog(BaseDBModel, table=True):
    """Notification log"""
    __tablename__ = "notification_log"
    
    todo_id: UUID = Field(foreign_key="todo_item.id", nullable=False, index=True)
    channel: NotificationChannel = Field(nullable=False)
    status: NotificationStatus = Field(default=NotificationStatus.PENDING, nullable=False)
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
