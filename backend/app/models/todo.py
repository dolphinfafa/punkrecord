"""
Todo Module Models
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Column, JSON, SQLModel
from sqlalchemy import Text
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
    PENDING_REVIEW = "pending_review"  # Employee submitted, waiting for manager approval
    DONE = "done"
    DISMISSED = "dismissed"
    AI_FIXING = "ai_fixing"    # AI agent is working on the fix
    AI_FIXED = "ai_fixed"      # AI agent has completed the fix, awaiting human review


class TodoItem(BaseDBModel, table=True):
    """Todo item model"""
    __tablename__ = "todo_item"
    
    our_entity_id: UUID = Field(nullable=False)
    assignee_user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    creator_user_id: UUID = Field(foreign_key="users.id", nullable=False)
    
    title: str = Field(nullable=False)
    # TEXT 列：描述上限 1 万字符（varchar(255) 容不下），备注同用 TEXT。
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))

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
    done_by_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    dismiss_reason: Optional[str] = None
    review_comment: Optional[str] = None  # Manager's feedback when rejecting
    reviewed_by_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")


class NotificationChannel(str, Enum):
    """Notification channel"""
    IN_APP = "in_app"
    EMAIL = "email"
    WEBHOOK = "webhook"
    WECHAT = "wechat"


class NotificationStatus(str, Enum):
    """Notification status"""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class NotificationLog(BaseDBModel, table=True):
    """Notification log"""
    __tablename__ = "notification_log"

    todo_id: UUID = Field(foreign_key="todo_item.id", nullable=False, index=True)
    recipient_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)
    channel: NotificationChannel = Field(nullable=False)
    status: NotificationStatus = Field(default=NotificationStatus.PENDING, nullable=False)
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None


class LeaveType(str, Enum):
    """Leave type"""
    ANNUAL = "annual"
    MATERNITY = "maternity"
    MARRIAGE = "marriage"
    PERSONAL = "personal"
    SICK = "sick"


class LeaveStatus(str, Enum):
    """Leave status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveRequest(BaseDBModel, table=True):
    """Leave request model"""
    __tablename__ = "leave_request"

    our_entity_id: Optional[UUID] = Field(default=None, index=True)
    applicant_user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    leave_type: LeaveType = Field(nullable=False, index=True)
    status: LeaveStatus = Field(default=LeaveStatus.PENDING, nullable=False, index=True)
    start_at: datetime = Field(nullable=False)
    end_at: datetime = Field(nullable=False)
    reason: Optional[str] = None
    approved_by_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    approved_at: Optional[datetime] = None
    review_comment: Optional[str] = None
