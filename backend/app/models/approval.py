"""
Approval Engine Models
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Column, JSON, SQLModel
from app.models.base import BaseDBModel


class ApprovalObjectType(str, Enum):
    """Approval object type"""
    CONTRACT = "contract"
    INVOICE_REQUEST = "invoice_request"
    REIMBURSEMENT = "reimbursement"
    CUSTOM = "custom"


class ApprovalStatus(str, Enum):
    """Approval status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalStepStatus(str, Enum):
    """Approval step status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class ApprovalFlow(BaseDBModel, table=True):
    """Approval flow configuration"""
    __tablename__ = "approval_flow"
    
    flow_code: str = Field(nullable=False, unique=True, index=True)
    name: str = Field(nullable=False)
    object_type: ApprovalObjectType = Field(nullable=False)
    steps: list = Field(sa_column=Column(JSON))  # Array of step configs
    is_active: bool = Field(default=True, nullable=False)


class ApprovalInstance(BaseDBModel, table=True):
    """Approval instance"""
    __tablename__ = "approval_instance"
    
    object_type: ApprovalObjectType = Field(nullable=False)
    object_id: UUID = Field(nullable=False, index=True)
    flow_code: str = Field(nullable=False)
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING, nullable=False)
    current_step_no: int = Field(nullable=False)
    created_by_user_id: UUID = Field(foreign_key="user.id", nullable=False)


class ApprovalStep(BaseDBModel, table=True):
    """Approval step"""
    __tablename__ = "approval_step"
    
    approval_id: UUID = Field(foreign_key="approval_instance.id", nullable=False, index=True)
    step_no: int = Field(nullable=False)
    step_name: str = Field(nullable=False)
    approver_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    status: ApprovalStepStatus = Field(default=ApprovalStepStatus.PENDING, nullable=False)
    acted_at: Optional[datetime] = None
    comment: Optional[str] = None
