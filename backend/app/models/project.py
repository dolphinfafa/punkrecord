"""
Project Module Models
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, SQLModel
from app.models.base import BaseDBModel


class ProjectType(str, Enum):
    """Project type"""
    B2B = "b2b"
    B2C = "b2c"


class ProjectStatus(str, Enum):
    """Project status"""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class StageStatus(str, Enum):
    """Stage status"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    SKIPPED = "skipped"


class Project(BaseDBModel, table=True):
    """Project model"""
    __tablename__ = "project"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    project_no: str = Field(nullable=False, unique=True, index=True)
    name: str = Field(nullable=False)
    project_type: ProjectType = Field(nullable=False)
    status: ProjectStatus = Field(default=ProjectStatus.DRAFT, nullable=False, index=True)
    
    owner_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    pm_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    
    customer_id: Optional[UUID] = Field(default=None, foreign_key="counterparty.id")
    contract_id: Optional[UUID] = Field(default=None, foreign_key="contract.id")
    
    start_at: Optional[date] = None
    due_at: Optional[date] = None
    
    current_stage_code: str = Field(nullable=False)
    progress: float = Field(default=0.0, nullable=False)  # 0.0 to 1.0
    
    description: Optional[str] = None


class ProjectStage(BaseDBModel, table=True):
    """Project stage"""
    __tablename__ = "project_stage"
    
    project_id: UUID = Field(foreign_key="project.id", nullable=False, index=True)
    stage_code: str = Field(nullable=False)
    stage_name: str = Field(nullable=False)
    sequence_no: int = Field(nullable=False)
    status: StageStatus = Field(default=StageStatus.NOT_STARTED, nullable=False)
    
    planned_start_at: Optional[date] = None
    planned_end_at: Optional[date] = None
    actual_start_at: Optional[date] = None
    actual_end_at: Optional[date] = None
    
    blocked_reason: Optional[str] = None
    skip_reason: Optional[str] = None
    deliverables: Optional[str] = None
    feature_list: Optional[str] = None


class ProjectMember(BaseDBModel, table=True):
    """Project member"""
    __tablename__ = "project_member"
    
    project_id: UUID = Field(foreign_key="project.id", nullable=False, index=True)
    user_id: UUID = Field(foreign_key="user.id", nullable=False)
    role_in_project: Optional[str] = None
