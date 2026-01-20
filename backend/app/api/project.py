"""
Project API endpoints
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.iam import User
from app.models.project import Project, ProjectStage, ProjectType, ProjectStatus, StageStatus
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectStageResponse, StageStatusUpdate
)

router = APIRouter(prefix="/project", tags=["Project"])


# Standard stages for B2B projects
B2B_STAGES = [
    ("requirement_alignment", "需求对齐"),
    ("quotation", "报价"),
    ("contract_signed", "合同签署"),
    ("prototype_confirmed", "原型确认"),
    ("design", "设计"),
    ("development", "开发"),
    ("testing", "测试"),
    ("delivery", "交付")
]

# Standard stages for B2C projects
B2C_STAGES = [
    ("requirement_analysis", "需求分析"),
    ("project_initiation", "项目立项"),
    ("prototype_confirmed", "原型确认"),
    ("design", "设计"),
    ("development", "开发"),
    ("testing", "测试"),
    ("launch", "上线"),
    ("operation", "运营"),
    ("iteration", "迭代")
]


@router.post("/projects", response_model=dict)
async def create_project(
    data: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create project with automatic stage generation"""
    project = Project(
        our_entity_id=data.our_entity_id,
        project_no=data.project_no,
        name=data.name,
        project_type=ProjectType(data.project_type),
        status=ProjectStatus.DRAFT,
        owner_user_id=current_user.id,
        pm_user_id=data.pm_user_id,
        customer_id=data.customer_id,
        contract_id=data.contract_id,
        start_at=data.start_at,
        due_at=data.due_at,
        current_stage_code="",
        progress=0.0,
        description=data.description
    )
    
    session.add(project)
    session.commit()
    session.refresh(project)
    
    # Generate stages based on project type
    stages = B2B_STAGES if project.project_type == ProjectType.B2B else B2C_STAGES
    
    for idx, (code, name) in enumerate(stages, 1):
        stage = ProjectStage(
            project_id=project.id,
            stage_code=code,
            stage_name=name,
            sequence_no=idx,
            status=StageStatus.NOT_STARTED
        )
        session.add(stage)
    
    # Set current stage to first stage
    project.current_stage_code = stages[0][0]
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return success_response(ProjectResponse.model_validate(project))


@router.get("/projects", response_model=dict)
async def list_projects(
    status: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List projects"""
    query = select(Project)
    
    if status:
        query = query.where(Project.status == status)
    if project_type:
        query = query.where(Project.project_type == project_type)
    
    query = query.order_by(Project.created_at.desc())
    
    offset = (page - 1) * page_size
    projects = session.exec(query.offset(offset).limit(page_size)).all()
    
    count_query = select(Project)
    if status:
        count_query = count_query.where(Project.status == status)
    if project_type:
        count_query = count_query.where(Project.project_type == project_type)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [ProjectResponse.model_validate(p) for p in projects],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/projects/{project_id}", response_model=dict)
async def get_project(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get project by ID"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("Project not found")
    
    return success_response(ProjectResponse.model_validate(project))


@router.patch("/projects/{project_id}", response_model=dict)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update project"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("Project not found")
    
    if data.name is not None:
        project.name = data.name
    if data.status is not None:
        project.status = ProjectStatus(data.status)
    if data.pm_user_id is not None:
        project.pm_user_id = data.pm_user_id
    if data.description is not None:
        project.description = data.description
    if data.due_at is not None:
        project.due_at = data.due_at
    
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return success_response(ProjectResponse.model_validate(project))


@router.get("/projects/{project_id}/stages", response_model=dict)
async def get_project_stages(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get project stages"""
    project = session.get(Project, project_id)
    if not project:
        raise NotFoundException("Project not found")
    
    stages = session.exec(
        select(ProjectStage)
        .where(ProjectStage.project_id == project_id)
        .order_by(ProjectStage.sequence_no)
    ).all()
    
    return success_response([ProjectStageResponse.model_validate(s) for s in stages])


@router.patch("/stages/{stage_id}", response_model=dict)
async def update_stage_status(
    stage_id: UUID,
    data: StageStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update project stage status"""
    stage = session.get(ProjectStage, stage_id)
    if not stage:
        raise NotFoundException("Stage not found")
    
    stage.status = StageStatus(data.status)
    if data.blocked_reason:
        stage.blocked_reason = data.blocked_reason
    if data.skip_reason:
        stage.skip_reason = data.skip_reason
    
    if stage.status == StageStatus.IN_PROGRESS and not stage.actual_start_at:
        stage.actual_start_at = datetime.utcnow().date()
    elif stage.status == StageStatus.DONE and not stage.actual_end_at:
        stage.actual_end_at = datetime.utcnow().date()
    
    stage.updated_at = datetime.utcnow()
    session.add(stage)
    session.commit()
    session.refresh(stage)
    
    return success_response(ProjectStageResponse.model_validate(stage))
