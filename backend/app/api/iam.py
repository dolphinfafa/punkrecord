"""
IAM API endpoints (Users, Roles, Entities, Departments, Job Titles, Org Chart)
"""
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import require_permission, get_current_user
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException
from app.core.response import success_response
from app.core.storage import save_file, get_file, delete_file, get_download_url
from app.models.iam import User, OurEntity, Role, UserStatus, JobTitle, OrgUnit, BeliRule, BeliRuleType, Permission, JobTitlePermission, EducationLevel
from app.schemas import (
    UserCreate, UserUpdate, UserResponse,
    OurEntityCreate, OurEntityResponse,
    JobTitleCreate, JobTitleUpdate, JobTitleResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    OrgChartNode,
    BeliRuleCreate, BeliRuleUpdate, BeliRuleResponse,
)

USER_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "user-files"
USER_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/iam", tags=["IAM"])
_BELI_RULE_TYPES = {item.value for item in BeliRuleType}


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


def _require_l0(current_user: User, session: Session):
    all_users = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users}
    current_level = _compute_level(current_user, user_map)
    if current_level != 0:
        raise ForbiddenException("仅 L0 级别员工可操作")


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
        birthday=user.birthday,
        id_number=user.id_number,
        home_address=user.home_address,
        graduation_school=user.graduation_school,
        education_level=user.education_level.value if user.education_level else None,
        id_card_image=user.id_card_image,
        resume_file=user.resume_file,
        profile_completed=user.profile_completed,
        must_change_password=user.must_change_password,
        leave_annual_remaining=user.leave_annual_remaining,
        leave_maternity_remaining=user.leave_maternity_remaining,
        leave_marriage_remaining=user.leave_marriage_remaining,
        leave_personal_remaining=user.leave_personal_remaining,
        leave_sick_remaining=user.leave_sick_remaining,
        beili_balance=user.beili_balance,
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
    current_user: User = Depends(require_permission("iam.read"))
):
    """List all job titles ordered by name"""
    titles = session.exec(select(JobTitle).order_by(JobTitle.name)).all()
    return success_response([JobTitleResponse.model_validate(t) for t in titles])


@router.post("/job-titles", response_model=dict)
async def create_job_title(
    data: JobTitleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
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
    current_user: User = Depends(require_permission("iam.write"))
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
    current_user: User = Depends(require_permission("iam.write"))
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


# ─── Job Title Permission endpoints ──────────────────────────────────────────

@router.get("/permissions", response_model=dict)
async def list_permissions(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.read"))
):
    """List all available permissions grouped by module"""
    perms = session.exec(select(Permission).order_by(Permission.module, Permission.code)).all()
    return success_response([
        {"id": str(p.id), "code": p.code, "name": p.name, "module": p.module, "description": p.description}
        for p in perms
    ])


@router.get("/job-titles/{job_title_id}/permissions", response_model=dict)
async def get_job_title_permissions(
    job_title_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.read"))
):
    """Get permission codes assigned to a job title"""
    jt = session.get(JobTitle, job_title_id)
    if not jt:
        raise NotFoundException("未找到职位")
    perm_codes = session.exec(
        select(Permission.code)
        .select_from(JobTitlePermission)
        .join(Permission, Permission.id == JobTitlePermission.permission_id)
        .where(JobTitlePermission.job_title_id == job_title_id)
    ).all()
    return success_response(perm_codes)


@router.put("/job-titles/{job_title_id}/permissions", response_model=dict)
async def set_job_title_permissions(
    job_title_id: UUID,
    data: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    """Set permissions for a job title. Body: { "permission_codes": ["iam.read", ...] }"""
    jt = session.get(JobTitle, job_title_id)
    if not jt:
        raise NotFoundException("未找到职位")

    codes = data.get("permission_codes", [])

    # Resolve permission IDs
    all_perms = session.exec(select(Permission)).all()
    perm_map = {p.code: p.id for p in all_perms}
    valid_ids = []
    for code in codes:
        if code in perm_map:
            valid_ids.append(perm_map[code])

    # Clear existing and re-create
    existing = session.exec(
        select(JobTitlePermission).where(JobTitlePermission.job_title_id == job_title_id)
    ).all()
    for e in existing:
        session.delete(e)

    for pid in valid_ids:
        session.add(JobTitlePermission(job_title_id=job_title_id, permission_id=pid))

    session.commit()
    return success_response({"message": "权限更新成功", "count": len(valid_ids)})


# ─── Department endpoints ────────────────────────────────────────────────────

@router.get("/departments", response_model=dict)
async def list_departments(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.read"))
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
    current_user: User = Depends(require_permission("iam.write"))
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
    current_user: User = Depends(require_permission("iam.write"))
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
    current_user: User = Depends(require_permission("iam.write"))
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


# ─── OurEntity endpoints ─────────────────────────────────────────────────────

@router.get("/entities", response_model=dict)
async def list_entities(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.read"))
):
    """List all our entities (company / branches)"""
    entities = session.exec(select(OurEntity).order_by(OurEntity.name)).all()
    return success_response({
        "items": [{"id": str(e.id), "name": e.name, "type": e.type, "status": e.status} for e in entities],
        "total": len(entities),
    })


# ─── Org Chart endpoint ──────────────────────────────────────────────────────

@router.get("/org-chart", response_model=dict)
async def get_org_chart(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.read"))
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


# 鈹€鈹€鈹€ Beli Rule endpoints 鈹€鈹€鈹€

@router.get("/beli-rules", response_model=dict)
async def list_beli_rules(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.read"))
):
    rules = session.exec(select(BeliRule).order_by(BeliRule.created_at.desc())).all()
    return success_response([BeliRuleResponse.model_validate(r) for r in rules])


@router.post("/beli-rules", response_model=dict)
async def create_beli_rule(
    data: BeliRuleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    _require_l0(current_user, session)
    rule_type = (data.rule_type or "").strip()
    if rule_type not in _BELI_RULE_TYPES:
        raise ValidationException("invalid rule_type")
    if data.early_days < 0 or data.late_days < 0:
        raise ValidationException("天数阈值不能小于 0")
    if data.reward_beili < 0 or data.penalty_beili < 0:
        raise ValidationException("贝利数值不能小于 0")
    rule = BeliRule(
        name=data.name.strip(),
        rule_type=BeliRuleType(rule_type),
        enabled=data.enabled,
        early_days=data.early_days,
        reward_beili=float(data.reward_beili),
        late_days=data.late_days,
        penalty_beili=float(data.penalty_beili),
        note=data.note,
    )
    if not rule.name:
        raise ValidationException("规则名称不能为空")
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return success_response(BeliRuleResponse.model_validate(rule))


@router.patch("/beli-rules/{rule_id}", response_model=dict)
async def update_beli_rule(
    rule_id: UUID,
    data: BeliRuleUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    _require_l0(current_user, session)
    rule = session.get(BeliRule, rule_id)
    if not rule:
        raise NotFoundException("未找到贝利规则")
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise ValidationException("规则名称不能为空")
        rule.name = name
    if data.rule_type is not None:
        rule_type = data.rule_type.strip()
        if rule_type not in _BELI_RULE_TYPES:
            raise ValidationException("invalid rule_type")
        rule.rule_type = BeliRuleType(rule_type)
    if data.enabled is not None:
        rule.enabled = data.enabled
    if data.early_days is not None:
        if data.early_days < 0:
            raise ValidationException("提前天数不能小于 0")
        rule.early_days = data.early_days
    if data.reward_beili is not None:
        if data.reward_beili < 0:
            raise ValidationException("奖励贝利不能小于 0")
        rule.reward_beili = float(data.reward_beili)
    if data.late_days is not None:
        if data.late_days < 0:
            raise ValidationException("延迟天数不能小于 0")
        rule.late_days = data.late_days
    if data.penalty_beili is not None:
        if data.penalty_beili < 0:
            raise ValidationException("扣除贝利不能小于 0")
        rule.penalty_beili = float(data.penalty_beili)
    if data.note is not None:
        rule.note = data.note
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return success_response(BeliRuleResponse.model_validate(rule))


@router.delete("/beli-rules/{rule_id}", response_model=dict)
async def delete_beli_rule(
    rule_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    _require_l0(current_user, session)
    rule = session.get(BeliRule, rule_id)
    if not rule:
        raise NotFoundException("未找到贝利规则")
    session.delete(rule)
    session.commit()
    return success_response({"message": "规则已删除"})


# ─── User endpoints ──────────────────────────────────────────────────────────

@router.post("/users", response_model=dict)
async def create_user(
    user_data: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
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
    current_user: User = Depends(require_permission("iam.read"))
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
    current_user: User = Depends(require_permission("iam.read"))
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
    current_user: User = Depends(require_permission("iam.write"))
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
    if user_data.birthday is not None:
        user.birthday = user_data.birthday or None
    if user_data.id_number is not None:
        user.id_number = user_data.id_number or None
    if user_data.home_address is not None:
        user.home_address = user_data.home_address or None
    if user_data.graduation_school is not None:
        user.graduation_school = user_data.graduation_school or None
    if user_data.education_level is not None:
        user.education_level = EducationLevel(user_data.education_level) if user_data.education_level else None

    leave_fields = [
        ("leave_annual_remaining", user_data.leave_annual_remaining),
        ("leave_maternity_remaining", user_data.leave_maternity_remaining),
        ("leave_marriage_remaining", user_data.leave_marriage_remaining),
        ("leave_personal_remaining", user_data.leave_personal_remaining),
        ("leave_sick_remaining", user_data.leave_sick_remaining),
    ]
    beili_adjust_requested = user_data.beili_adjust_amount is not None or user_data.beili_adjust_action is not None
    if any(value is not None for _, value in leave_fields) or beili_adjust_requested:
        all_users = session.exec(select(User)).all()
        user_map = {u.id: u for u in all_users}
        current_level = _compute_level(current_user, user_map)
        if current_level != 0:
            raise ForbiddenException("仅 L0 级别员工可调整假期余额和贝利")
        for field_name, field_value in leave_fields:
            if field_value is not None:
                if field_value < 0:
                    raise ValidationException("假期余额不能小于 0")
                setattr(user, field_name, float(field_value))
        if beili_adjust_requested:
            if user_data.beili_adjust_action not in ("add", "subtract"):
                raise ValidationException("beili_adjust_action must be add or subtract")
            if user_data.beili_adjust_amount is None or float(user_data.beili_adjust_amount) <= 0:
                raise ValidationException("beili_adjust_amount must be > 0")
            adjust_amount = float(user_data.beili_adjust_amount)
            if user_data.beili_adjust_action == "add":
                user.beili_balance = float(user.beili_balance or 0.0) + adjust_amount
            else:
                user.beili_balance = float(user.beili_balance or 0.0) - adjust_amount
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return success_response(_enrich_user(user, session))


@router.post("/users/{user_id}/reset-leave-balances", response_model=dict)
async def reset_user_leave_balances(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    """Manually reset leave balances for a user. Only L0 can perform."""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")

    all_users = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users}
    current_level = _compute_level(current_user, user_map)
    if current_level != 0:
        raise ForbiddenException("仅 L0 级别员工可重置假期余额")

    user.leave_annual_remaining = 5.0
    user.leave_maternity_remaining = 15.0
    user.leave_marriage_remaining = 3.0
    user.leave_personal_remaining = 3.0
    user.leave_sick_remaining = 3.0
    user.leave_balance_reset_year = datetime.utcnow().year

    session.add(user)
    session.commit()
    session.refresh(user)
    return success_response(_enrich_user(user, session, user_map))


@router.post("/users/reset-leave-balances", response_model=dict)
async def reset_all_users_leave_balances(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    """Manually reset leave balances for all users. Only L0 can perform."""
    all_users = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users}
    current_level = _compute_level(current_user, user_map)
    if current_level != 0:
        raise ForbiddenException("仅 L0 级别员工可重置假期余额")

    current_year = datetime.utcnow().year
    for user in all_users:
        user.leave_annual_remaining = 5.0
        user.leave_maternity_remaining = 15.0
        user.leave_marriage_remaining = 3.0
        user.leave_personal_remaining = 3.0
        user.leave_sick_remaining = 3.0
        user.leave_balance_reset_year = current_year
        session.add(user)
    session.commit()
    return success_response({"message": "已重置所有员工假期余额", "count": len(all_users)})


# ─── User password reset (admin) ─────────────────────────────────────────────

@router.post("/users/{user_id}/reset-password", response_model=dict)
async def admin_reset_user_password(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
):
    """Admin resets a user's password to a default value and forces password change on next login."""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    default_password = "punkrecord123"
    user.hashed_password = get_password_hash(default_password)
    user.must_change_password = True
    session.add(user)
    session.commit()
    return success_response({"message": f"密码已重置为 {default_password}，用户下次登录需修改密码"})


# ─── User file upload/download ───────────────────────────────────────────────

@router.post("/users/{user_id}/id-card-image", response_model=dict)
async def upload_id_card_image(
    user_id: UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload ID card image for a user. User can upload their own, admin can upload for anyone."""
    if str(current_user.id) != str(user_id):
        # Check admin permission
        try:
            require_permission("iam.write")
        except Exception:
            raise ForbiddenException("只能上传自己的身份证图片")
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise ValidationException("仅支持 JPG/PNG/WebP 图片格式")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{user_id}_idcard_{uuid4().hex[:8]}.{ext}"
    content = await file.read()
    save_file("user-files", filename, content, file.content_type or "image/jpeg")
    user.id_card_image = filename
    session.add(user)
    session.commit()
    return success_response({"filename": filename})


@router.post("/users/{user_id}/resume", response_model=dict)
async def upload_resume(
    user_id: UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload resume PDF for a user."""
    if str(current_user.id) != str(user_id):
        try:
            require_permission("iam.write")
        except Exception:
            raise ForbiddenException("只能上传自己的简历")
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    if file.content_type != "application/pdf":
        raise ValidationException("仅支持 PDF 格式简历")
    filename = f"{user_id}_resume_{uuid4().hex[:8]}.pdf"
    content = await file.read()
    save_file("user-files", filename, content, "application/pdf")
    user.resume_file = filename
    session.add(user)
    session.commit()
    return success_response({"filename": filename})


@router.get("/users/{user_id}/files/{filename}")
async def download_user_file(
    user_id: UUID,
    filename: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Download a user's uploaded file (ID card image or resume)."""
    url = get_download_url("user-files", filename)
    if url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)

    try:
        _, local_path = get_file("user-files", filename)
    except FileNotFoundError:
        raise NotFoundException("文件不存在")
    return FileResponse(local_path, filename=filename)


# ─── OurEntity endpoints ─────────────────────────────────────────────────────

@router.post("/our-entities", response_model=dict)
async def create_our_entity(
    entity_data: OurEntityCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("iam.write"))
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
    current_user: User = Depends(require_permission("iam.read"))
):
    """List our entities"""
    entities = session.exec(select(OurEntity)).all()
    return success_response([OurEntityResponse.model_validate(e) for e in entities])
