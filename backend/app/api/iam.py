"""
IAM API endpoints (Users, Roles, Entities, Departments, Job Titles, Org Chart)
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.iam import User, OurEntity, Role, UserStatus, JobTitle, OrgUnit
from app.schemas import (
    UserCreate, UserUpdate, UserResponse,
    OurEntityCreate, OurEntityResponse,
    JobTitleCreate, JobTitleUpdate, JobTitleResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    OrgChartNode,
)

router = APIRouter(prefix="/iam", tags=["IAM"])


# ─── Helpers ────────────────────────────────────────────────────────────────

def _compute_level(user: User, user_map: dict, max_depth: int = 20) -> int:
    """Walk the manager chain to compute org level. L0 = no manager (top)."""
    level = 0
    current = user
    visited = set()
    while current.manager_user_id and level < max_depth:
        if current.manager_user_id in visited:
            break  # Circular reference guard
        visited.add(current.id)
        parent = user_map.get(current.manager_user_id)
        if not parent:
            break
        current = parent
        level += 1
    return level


def _enrich_user(user: User, session: Session, user_map: dict = None) -> UserResponse:
    """Build UserResponse with resolved names for manager, job title, department."""
    manager_name = None
    if user.manager_user_id:
        mgr = session.get(User, user.manager_user_id)
        if mgr:
            manager_name = mgr.display_name

    job_title_name = None
    if user.job_title_id:
        jt = session.get(JobTitle, user.job_title_id)
        if jt:
            job_title_name = jt.name

    department_name = None
    if user.department_id:
        dept = session.get(OrgUnit, user.department_id)
        if dept:
            department_name = dept.name

    # Compute level from manager chain
    if user_map is None:
        all_users = session.exec(select(User)).all()
        user_map = {u.id: u for u in all_users}
    level = _compute_level(user, user_map)

    return UserResponse(
        id=user.id,
        display_name=user.display_name,
        username=user.username,
        email=user.email,
        phone=user.phone,
        status=user.status,
        is_shareholder=user.is_shareholder,
        level=level,
        manager_user_id=user.manager_user_id,
        manager_name=manager_name,
        job_title_id=user.job_title_id,
        job_title_name=job_title_name,
        department_id=user.department_id,
        department_name=department_name,
        created_at=user.created_at,
    )


def _build_dept_tree(dept: OrgUnit, all_depts: list[OrgUnit], member_counts: dict) -> DepartmentResponse:
    """Recursively build department tree."""
    children = [
        _build_dept_tree(d, all_depts, member_counts)
        for d in all_depts
        if d.parent_org_unit_id == dept.id
    ]
    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        parent_org_unit_id=dept.parent_org_unit_id,
        member_count=member_counts.get(dept.id, 0),
        children=children,
        created_at=dept.created_at,
    )


def _build_org_chart(user: User, all_users: list[User], job_titles: dict, departments: dict, level: int = 0) -> OrgChartNode:
    """Recursively build org chart node with explicit level."""
    children = [
        _build_org_chart(u, all_users, job_titles, departments, level + 1)
        for u in all_users
        if u.manager_user_id == user.id
    ]
    return OrgChartNode(
        id=user.id,
        display_name=user.display_name,
        job_title_name=job_titles.get(user.job_title_id),
        department_name=departments.get(user.department_id),
        is_shareholder=user.is_shareholder,
        level=level,
        children=children,
    )


# ─── Job Title endpoints ─────────────────────────────────────────────────────

@router.get("/job-titles", response_model=dict)
async def list_job_titles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all job titles ordered by name"""
    titles = session.exec(select(JobTitle).order_by(JobTitle.name)).all()
    return success_response([JobTitleResponse.model_validate(t) for t in titles])


@router.post("/job-titles", response_model=dict)
async def create_job_title(
    data: JobTitleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new job title"""
    jt = JobTitle(name=data.name, description=data.description)
    session.add(jt)
    session.commit()
    session.refresh(jt)
    return success_response(JobTitleResponse.model_validate(jt))


@router.patch("/job-titles/{job_title_id}", response_model=dict)
async def update_job_title(
    job_title_id: UUID,
    data: JobTitleUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a job title"""
    jt = session.get(JobTitle, job_title_id)
    if not jt:
        raise NotFoundException("未找到职位")
    if data.name is not None:
        jt.name = data.name
    if data.description is not None:
        jt.description = data.description
    session.add(jt)
    session.commit()
    session.refresh(jt)
    return success_response(JobTitleResponse.model_validate(jt))


@router.delete("/job-titles/{job_title_id}", response_model=dict)
async def delete_job_title(
    job_title_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a job title"""
    jt = session.get(JobTitle, job_title_id)
    if not jt:
        raise NotFoundException("未找到职位")
    # Check if any user has this job title
    users = session.exec(select(User).where(User.job_title_id == job_title_id)).all()
    if users:
        raise HTTPException(status_code=400, detail="该职位下还有员工，无法删除")
    session.delete(jt)
    session.commit()
    return success_response({"message": "删除成功"})


# ─── Department endpoints ────────────────────────────────────────────────────

@router.get("/departments", response_model=dict)
async def list_departments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List departments as a tree"""
    all_depts = session.exec(select(OrgUnit)).all()
    all_users = session.exec(select(User)).all()

    # Count members per department
    member_counts = {}
    for u in all_users:
        if u.department_id:
            member_counts[u.department_id] = member_counts.get(u.department_id, 0) + 1

    # Build tree from root nodes (no parent)
    roots = [d for d in all_depts if d.parent_org_unit_id is None]
    tree = [_build_dept_tree(d, list(all_depts), member_counts) for d in roots]
    return success_response(tree)


@router.post("/departments", response_model=dict)
async def create_department(
    data: DepartmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new department"""
    if data.parent_org_unit_id:
        parent = session.get(OrgUnit, data.parent_org_unit_id)
        if not parent:
            raise NotFoundException("未找到父部门")
    dept = OrgUnit(
        name=data.name,
        description=data.description,
        parent_org_unit_id=data.parent_org_unit_id,
    )
    session.add(dept)
    session.commit()
    session.refresh(dept)
    return success_response(DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        parent_org_unit_id=dept.parent_org_unit_id,
        member_count=0,
        children=[],
        created_at=dept.created_at,
    ))


@router.patch("/departments/{dept_id}", response_model=dict)
async def update_department(
    dept_id: UUID,
    data: DepartmentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a department"""
    dept = session.get(OrgUnit, dept_id)
    if not dept:
        raise NotFoundException("未找到部门")
    if data.name is not None:
        dept.name = data.name
    if data.description is not None:
        dept.description = data.description
    if data.parent_org_unit_id is not None:
        dept.parent_org_unit_id = data.parent_org_unit_id
    session.add(dept)
    session.commit()
    session.refresh(dept)
    return success_response(DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        parent_org_unit_id=dept.parent_org_unit_id,
        member_count=0,
        children=[],
        created_at=dept.created_at,
    ))


@router.delete("/departments/{dept_id}", response_model=dict)
async def delete_department(
    dept_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a department"""
    dept = session.get(OrgUnit, dept_id)
    if not dept:
        raise NotFoundException("未找到部门")
    # Check for sub-departments
    children = session.exec(select(OrgUnit).where(OrgUnit.parent_org_unit_id == dept_id)).all()
    if children:
        raise HTTPException(status_code=400, detail="该部门下还有子部门，无法删除")
    # Check for members
    members = session.exec(select(User).where(User.department_id == dept_id)).all()
    if members:
        raise HTTPException(status_code=400, detail="该部门下还有员工，无法删除")
    session.delete(dept)
    session.commit()
    return success_response({"message": "删除成功"})


# ─── Org Chart endpoint ──────────────────────────────────────────────────────

@router.get("/org-chart", response_model=dict)
async def get_org_chart(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get organization chart as a tree"""
    all_users = session.exec(select(User).where(User.status == "active")).all()
    all_job_titles = session.exec(select(JobTitle)).all()
    all_depts = session.exec(select(OrgUnit)).all()

    job_title_map = {jt.id: jt.name for jt in all_job_titles}
    dept_map = {d.id: d.name for d in all_depts}

    # Root nodes: shareholders or users with no manager
    roots = [u for u in all_users if u.is_shareholder or u.manager_user_id is None]
    # Deduplicate
    seen = set()
    unique_roots = []
    for u in roots:
        if u.id not in seen:
            seen.add(u.id)
            unique_roots.append(u)

    tree = [_build_org_chart(u, list(all_users), job_title_map, dept_map) for u in unique_roots]
    return success_response(tree)


# ─── User endpoints ──────────────────────────────────────────────────────────

@router.post("/users", response_model=dict)
async def create_user(
    user_data: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new user"""
    new_user = User(
        display_name=user_data.display_name,
        username=user_data.username,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        is_shareholder=user_data.is_shareholder,
        status=UserStatus.ACTIVE,
        manager_user_id=user_data.manager_user_id,
        job_title_id=user_data.job_title_id,
        department_id=user_data.department_id,
    )
    
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    return success_response(_enrich_user(new_user, session))


@router.get("/users", response_model=dict)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department_id: Optional[UUID] = Query(None),
    job_title_id: Optional[UUID] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List users with pagination and optional filters"""
    query = select(User)
    if department_id:
        query = query.where(User.department_id == department_id)
    if job_title_id:
        query = query.where(User.job_title_id == job_title_id)

    total_users = session.exec(query).all()
    total = len(total_users)

    # Build a shared user_map for efficient level computation
    all_users_for_map = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users_for_map}

    offset = (page - 1) * page_size
    users = session.exec(query.offset(offset).limit(page_size)).all()
    
    return success_response({
        "items": [_enrich_user(u, session, user_map) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/users/{user_id}", response_model=dict)
async def get_user(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get user by ID"""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    
    return success_response(_enrich_user(user, session))


@router.patch("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update user"""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    
    if user_data.display_name is not None:
        user.display_name = user_data.display_name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.is_shareholder is not None:
        user.is_shareholder = user_data.is_shareholder
    if user_data.status is not None:
        user.status = UserStatus(user_data.status)
    if user_data.manager_user_id is not None:
        user.manager_user_id = user_data.manager_user_id
    if user_data.job_title_id is not None:
        user.job_title_id = user_data.job_title_id
    if user_data.department_id is not None:
        user.department_id = user_data.department_id
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return success_response(_enrich_user(user, session))


# ─── OurEntity endpoints ─────────────────────────────────────────────────────

@router.post("/our-entities", response_model=dict)
async def create_our_entity(
    entity_data: OurEntityCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create our entity"""
    from app.models.iam import OurEntityType, OurEntityStatus
    
    new_entity = OurEntity(
        name=entity_data.name,
        type=OurEntityType(entity_data.type),
        legal_name=entity_data.legal_name,
        uscc=entity_data.uscc,
        address=entity_data.address,
        default_currency=entity_data.default_currency,
        status=OurEntityStatus.ACTIVE
    )
    
    session.add(new_entity)
    session.commit()
    session.refresh(new_entity)
    
    return success_response(OurEntityResponse.model_validate(new_entity))


@router.get("/our-entities", response_model=dict)
async def list_our_entities(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List our entities"""
    entities = session.exec(select(OurEntity)).all()
    return success_response([OurEntityResponse.model_validate(e) for e in entities])
