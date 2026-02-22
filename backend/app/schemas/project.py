"""
Project module Pydantic schemas
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    """Project creation schema"""
    our_entity_id: Optional[UUID] = None
    project_no: str
    name: str
    project_type: str  # b2b or b2c
    pm_user_id: UUID
    customer_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    start_at: Optional[date] = None
    due_at: Optional[date] = None
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Project update schema"""
    name: Optional[str] = None
    status: Optional[str] = None
    pm_user_id: Optional[UUID] = None
    our_entity_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    start_at: Optional[date] = None
    due_at: Optional[date] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    """Project response schema"""
    id: UUID
    our_entity_id: UUID
    project_no: str
    name: str
    project_type: str
    status: str
    owner_user_id: UUID
    pm_user_id: UUID
    pm_name: Optional[str] = None
    customer_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    start_at: Optional[date] = None
    due_at: Optional[date] = None
    current_stage_code: str
    progress: float
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectStageResponse(BaseModel):
    """Project stage response schema"""
    id: UUID
    project_id: UUID
    stage_code: str
    stage_name: str
    sequence_no: int
    status: str
    planned_start_at: Optional[date] = None
    planned_end_at: Optional[date] = None
    actual_start_at: Optional[date] = None
    actual_end_at: Optional[date] = None
    blocked_reason: Optional[str] = None
    skip_reason: Optional[str] = None
    deliverables: Optional[str] = None
    feature_list: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProjectStageUpdate(BaseModel):
    """Project stage update schema"""
    status: Optional[str] = None
    planned_end_at: Optional[date] = None
    actual_end_at: Optional[date] = None
    blocked_reason: Optional[str] = None
    skip_reason: Optional[str] = None
    deliverables: Optional[str] = None
    feature_list: Optional[str] = None

class StageStatusUpdate(BaseModel):
    """Stage status update schema"""
    status: str
    blocked_reason: Optional[str] = None
    skip_reason: Optional[str] = None



class ProjectMemberCreate(BaseModel):
    """Add a single member to a project"""
    user_id: UUID
    role_in_project: Optional[str] = None


class ProjectMemberBatchCreate(BaseModel):
    """Project member batch creation schema"""
    user_ids: list[UUID]
    role_in_project: Optional[str] = None



class ProjectMemberResponse(BaseModel):
    """Project member response schema"""
    id: UUID
    project_id: UUID
    user_id: UUID
    role_in_project: Optional[str] = None
    created_at: datetime
    
    # Joined fields
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    
    class Config:
        from_attributes = True


class ProjectTaskResponse(BaseModel):
    """Project task response schema"""
    id: UUID
    title: str
    status: str
    priority: str
    assignee_user_id: UUID
    assignee_name: Optional[str] = None
    due_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
