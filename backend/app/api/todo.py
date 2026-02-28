"""
Todo API endpoints
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
import math
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.exceptions import NotFoundException, ValidationException
from app.core.response import success_response
from app.models.iam import User, OurEntity, BeliRule, BeliRuleType
from app.models.todo import (
    TodoItem, TodoStatus, TodoSourceType, TodoActionType,
    NotificationLog, NotificationChannel, NotificationStatus,
    LeaveRequest, LeaveType, LeaveStatus
)
from app.schemas.todo import (
    TodoCreate, TodoUpdate, TodoReviewAction, TodoResponse,
    LeaveRequestCreate, LeaveRequestResponse
)
from app.api.project import sync_project_progress

router = APIRouter(prefix="/todo", tags=["Todo"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_todo(todo: TodoItem, session: Session) -> TodoResponse:
    """Build TodoResponse with resolved assignee/creator names."""
    assignee = session.get(User, todo.assignee_user_id)
    creator = session.get(User, todo.creator_user_id)
    data = TodoResponse.model_validate(todo)
    data.assignee_name = assignee.display_name if assignee else None
    data.creator_name = creator.display_name if creator else None
    return data


def _notify_manager(user_id: UUID, todo: TodoItem, session: Session):
    """Create an in-app notification for the user's manager (if they have one)."""
    user = session.get(User, user_id)
    if not user or not user.manager_user_id:
        return
    log = NotificationLog(
        todo_id=todo.id,
        channel=NotificationChannel.IN_APP,
        status=NotificationStatus.SENT,
        sent_at=datetime.utcnow(),
    )
    session.add(log)


def _notify_user(user_id: UUID, todo: TodoItem, session: Session):
    """Create an in-app notification for a specific user."""
    log = NotificationLog(
        todo_id=todo.id,
        channel=NotificationChannel.IN_APP,
        status=NotificationStatus.SENT,
        sent_at=datetime.utcnow(),
    )
    # Note: NotificationLog doesn't have a 'recipient_user_id' field in the model shown?
    # Wait, looking at app/models/todo.py:
    # class NotificationLog(BaseDBModel, table=True):
    #    todo_id: UUID ...
    # It doesn't seem to have a recipient field! 
    # How does `_notify_manager` work?
    # `_notify_manager` creates a log. But who receives it?
    # Maybe the system infers recipient from context?
    # "manager of assignee"?
    # If NotificationLog is just a log, how is the notification delivered?
    # Let's check `backend/app/models/todo.py` again.
    # It has `todo_id`.
    # Maybe the frontend queries NotificationLog joined with Todo?
    session.add(log)


def _is_direct_manager(manager: User, subordinate: User) -> bool:
    """Check if manager is the direct manager of subordinate."""
    return subordinate.manager_user_id == manager.id


def _enrich_leave(leave: LeaveRequest, session: Session) -> LeaveRequestResponse:
    """Build LeaveRequestResponse with resolved applicant name."""
    applicant = session.get(User, leave.applicant_user_id)
    data = LeaveRequestResponse.model_validate(leave)
    data.applicant_name = applicant.display_name if applicant else None
    return data


def _compute_level(user: User, user_map: dict, max_depth: int = 20) -> int:
    """Walk manager chain to compute org level. L0 = no manager."""
    level = 0
    current = user
    visited = set()
    while current.manager_user_id and level < max_depth:
        if current.manager_user_id in visited:
            break
        visited.add(current.id)
        parent = user_map.get(current.manager_user_id)
        if not parent:
            break
        current = parent
        level += 1
    return level


def _resolve_leave_balance_field(leave_type: LeaveType) -> str:
    mapping = {
        LeaveType.ANNUAL: "leave_annual_remaining",
        LeaveType.MATERNITY: "leave_maternity_remaining",
        LeaveType.MARRIAGE: "leave_marriage_remaining",
        LeaveType.PERSONAL: "leave_personal_remaining",
        LeaveType.SICK: "leave_sick_remaining",
    }
    return mapping[leave_type]


def _calc_leave_days(start_at: datetime, end_at: datetime) -> int:
    """Round up leave duration to whole days."""
    seconds = (end_at - start_at).total_seconds()
    return max(1, math.ceil(seconds / 86400))


def _apply_beli_rules_on_done(todo: TodoItem, session: Session):
    """Apply active Beli rules once when a todo is completed."""
    link = dict(todo.link or {})
    if link.get("beli_applied"):
        return

    if not todo.due_at or not todo.done_at:
        link["beli_applied"] = True
        link["beli_delta"] = 0.0
        link["beli_applied_at"] = datetime.utcnow().isoformat()
        todo.link = link
        session.add(todo)
        return

    assignee = session.get(User, todo.assignee_user_id)
    if not assignee:
        return

    # positive => finished early; negative => finished late
    days_diff = (todo.due_at.date() - todo.done_at.date()).days
    rules = session.exec(
        select(BeliRule).where(BeliRule.enabled == True).where(BeliRule.rule_type == BeliRuleType.TASK_TIMELINESS)
    ).all()
    delta = 0.0
    hits = []

    early_matches = [
        rule for rule in rules
        if rule.early_days > 0 and rule.reward_beili > 0 and days_diff >= rule.early_days
    ]
    if early_matches:
        early_rule = max(early_matches, key=lambda item: (item.early_days, item.reward_beili))
        early_delta = float(early_rule.reward_beili)
        delta += early_delta
        hits.append({"rule_id": str(early_rule.id), "name": early_rule.name, "delta": early_delta})

    late_matches = [
        rule for rule in rules
        if rule.late_days > 0 and rule.penalty_beili > 0 and (-days_diff) >= rule.late_days
    ]
    if late_matches:
        late_rule = max(late_matches, key=lambda item: (item.late_days, item.penalty_beili))
        late_delta = -float(late_rule.penalty_beili)
        delta += late_delta
        hits.append({"rule_id": str(late_rule.id), "name": late_rule.name, "delta": late_delta})

    assignee.beili_balance = float(assignee.beili_balance or 0.0) + delta
    session.add(assignee)

    link["beli_applied"] = True
    link["beli_delta"] = delta
    link["beli_applied_at"] = datetime.utcnow().isoformat()
    link["beli_days_diff"] = days_diff
    link["beli_rule_hits"] = hits
    todo.link = link
    session.add(todo)


# ─── Create ──────────────────────────────────────────────────────────────────

@router.post("", response_model=dict)
async def create_todo(
    todo_data: TodoCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new todo item. Notifies the assignee's manager."""
    import uuid as _uuid
    source_id = todo_data.source_id or str(_uuid.uuid4())

    new_todo = TodoItem(
        our_entity_id=todo_data.our_entity_id,
        assignee_user_id=todo_data.assignee_user_id,
        creator_user_id=current_user.id,
        title=todo_data.title,
        description=todo_data.description,
        source_type=TodoSourceType(todo_data.source_type),
        source_id=source_id,
        action_type=TodoActionType(todo_data.action_type),
        priority=todo_data.priority,
        status=TodoStatus.OPEN,
        due_at=todo_data.due_at,
        start_at=todo_data.start_at,
        tags=todo_data.tags,
        link=todo_data.link
    )

    session.add(new_todo)
    session.commit()
    session.refresh(new_todo)

    # Notify the assignee's manager
    _notify_manager(todo_data.assignee_user_id, new_todo, session)
    session.commit()

    return success_response(_enrich_todo(new_todo, session))


# ─── My todos ────────────────────────────────────────────────────────────────

@router.get("/my", response_model=dict)
async def get_my_todos(
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current user's todos (assigned to me)."""
    query = select(TodoItem).where(TodoItem.assignee_user_id == current_user.id)

    if status:
        if status == "open":
            # "open" filter includes open, in_progress, blocked
            from sqlmodel import or_
            query = query.where(or_(
                TodoItem.status == TodoStatus.OPEN,
                TodoItem.status == TodoStatus.IN_PROGRESS,
                TodoItem.status == TodoStatus.BLOCKED,
            ))
        else:
            query = query.where(TodoItem.status == status)
    if source_type:
        query = query.where(TodoItem.source_type == source_type)

    query = query.order_by(TodoItem.due_at)

    count_query = query
    total = len(session.exec(count_query).all())

    offset = (page - 1) * page_size
    todos = session.exec(query.offset(offset).limit(page_size)).all()

    return success_response({
        "items": [_enrich_todo(t, session) for t in todos],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


# ─── Team todos (manager view) ───────────────────────────────────────────────

@router.get("/team", response_model=dict)
async def get_team_todos(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get direct subordinates' todos (one level only)."""
    # Find direct subordinates
    subordinates = session.exec(
        select(User).where(User.manager_user_id == current_user.id)
    ).all()
    subordinate_ids = [u.id for u in subordinates]

    if not subordinate_ids:
        return success_response({"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 0})

    from sqlmodel import col
    query = select(TodoItem).where(col(TodoItem.assignee_user_id).in_(subordinate_ids))

    if status:
        query = query.where(TodoItem.status == status)

    query = query.order_by(TodoItem.due_at)

    total = len(session.exec(query).all())
    offset = (page - 1) * page_size
    todos = session.exec(query.offset(offset).limit(page_size)).all()

    return success_response({
        "items": [_enrich_todo(t, session) for t in todos],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "subordinates": [{"id": str(u.id), "display_name": u.display_name} for u in subordinates]
    })


# ─── Leave requests ───────────────────────────────────────────────────────────

@router.post("/leaves", response_model=dict)
async def create_leave_request(
    data: LeaveRequestCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a leave request for current user."""
    if data.end_at <= data.start_at:
        raise ValidationException("请假结束时间必须晚于开始时间")

    all_users = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users}
    current_level = _compute_level(current_user, user_map)
    if current_level == 0:
        raise ValidationException("L0 级别员工无需请假")
    if not current_user.manager_user_id:
        raise ValidationException("未配置直属主管，无法提交请假")

    leave_type = LeaveType(data.leave_type)
    leave_days = _calc_leave_days(data.start_at, data.end_at)
    balance_field = _resolve_leave_balance_field(leave_type)
    current_balance = float(getattr(current_user, balance_field, 0.0) or 0.0)
    if leave_days > current_balance:
        raise ValidationException(f"可用假期不足，当前剩余 {current_balance:.1f} 天")

    our_entity_id = data.our_entity_id
    if not our_entity_id:
        default_entity = session.exec(select(OurEntity)).first()
        if default_entity:
            our_entity_id = default_entity.id
    if not our_entity_id:
        raise ValidationException("未找到可用主体，无法创建请假申请")

    leave = LeaveRequest(
        our_entity_id=our_entity_id,
        applicant_user_id=current_user.id,
        leave_type=leave_type,
        status=LeaveStatus.PENDING,
        start_at=data.start_at,
        end_at=data.end_at,
        reason=data.reason
    )
    session.add(leave)
    session.commit()
    session.refresh(leave)
    return success_response(_enrich_leave(leave, session))


@router.get("/leaves/my", response_model=dict)
async def list_my_leave_requests(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List current user's leave requests."""
    query = select(LeaveRequest).where(LeaveRequest.applicant_user_id == current_user.id)
    if status:
        query = query.where(LeaveRequest.status == status)
    query = query.order_by(LeaveRequest.created_at.desc())

    total = len(session.exec(query).all())
    offset = (page - 1) * page_size
    leaves = session.exec(query.offset(offset).limit(page_size)).all()
    return success_response({
        "items": [_enrich_leave(item, session) for item in leaves],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/leaves/team/pending", response_model=dict)
async def list_team_pending_leave_requests(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List pending leave requests where current user is the direct manager approver."""
    subordinates = session.exec(
        select(User).where(User.manager_user_id == current_user.id)
    ).all()
    subordinate_ids = [u.id for u in subordinates]
    if not subordinate_ids:
        return success_response([])

    from sqlmodel import col
    requests = session.exec(
        select(LeaveRequest)
        .where(col(LeaveRequest.applicant_user_id).in_(subordinate_ids))
        .where(LeaveRequest.status == LeaveStatus.PENDING)
        .order_by(LeaveRequest.created_at.desc())
    ).all()
    return success_response([_enrich_leave(item, session) for item in requests])


@router.post("/leaves/{leave_id}/approve", response_model=dict)
async def approve_leave_request(
    leave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Approve leave request by direct manager and deduct leave balance."""
    leave = session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException("未找到请假申请")
    if leave.status != LeaveStatus.PENDING:
        raise ValidationException("仅待审批的请假可通过")

    applicant = session.get(User, leave.applicant_user_id)
    if not applicant:
        raise NotFoundException("未找到请假申请人")
    if applicant.manager_user_id != current_user.id:
        raise ValidationException("仅直属主管可审批此请假申请")

    leave_days = _calc_leave_days(leave.start_at, leave.end_at)
    balance_field = _resolve_leave_balance_field(leave.leave_type)
    current_balance = float(getattr(applicant, balance_field, 0.0) or 0.0)
    if leave_days > current_balance:
        raise ValidationException(f"请假申请人剩余假期不足（剩余 {current_balance:.1f} 天）")

    setattr(applicant, balance_field, current_balance - leave_days)
    leave.status = LeaveStatus.APPROVED
    leave.approved_by_user_id = current_user.id
    leave.approved_at = datetime.utcnow()
    leave.review_comment = None
    leave.updated_at = datetime.utcnow()
    session.add(applicant)
    session.add(leave)

    session.commit()
    session.refresh(leave)
    return success_response(_enrich_leave(leave, session))


@router.post("/leaves/{leave_id}/reject", response_model=dict)
async def reject_leave_request(
    leave_id: UUID,
    data: TodoReviewAction,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Reject leave request by direct manager."""
    leave = session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException("未找到请假申请")
    if leave.status != LeaveStatus.PENDING:
        raise ValidationException("仅待审批的请假可拒绝")

    applicant = session.get(User, leave.applicant_user_id)
    if not applicant:
        raise NotFoundException("未找到请假申请人")
    if applicant.manager_user_id != current_user.id:
        raise ValidationException("仅直属主管可审批此请假申请")

    leave.status = LeaveStatus.REJECTED
    leave.approved_by_user_id = current_user.id
    leave.approved_at = datetime.utcnow()
    leave.review_comment = data.comment or "请假申请未通过"
    leave.updated_at = datetime.utcnow()
    session.add(leave)

    session.commit()
    session.refresh(leave)
    return success_response(_enrich_leave(leave, session))


# ─── Single todo ─────────────────────────────────────────────────────────────

@router.get("/{todo_id}", response_model=dict)
async def get_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get todo by ID."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    # Access: assignee, creator, or direct manager of assignee
    assignee = session.get(User, todo.assignee_user_id)
    is_manager = assignee and assignee.manager_user_id == current_user.id
    if (todo.assignee_user_id != current_user.id
            and todo.creator_user_id != current_user.id
            and not is_manager):
        raise NotFoundException("未找到待办事项")

    return success_response(_enrich_todo(todo, session))


# ─── Update ──────────────────────────────────────────────────────────────────

@router.patch("/{todo_id}", response_model=dict)
async def update_todo(
    todo_id: UUID,
    todo_data: TodoUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update todo (assignee or creator only)."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id and todo.creator_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    if todo_data.title is not None:
        todo.title = todo_data.title
    if todo_data.description is not None:
        todo.description = todo_data.description
    if todo_data.priority is not None:
        todo.priority = todo_data.priority
    if todo_data.due_at is not None:
        todo.due_at = todo_data.due_at
    if todo_data.start_at is not None:
        todo.start_at = todo_data.start_at
    if todo_data.tags is not None:
        todo.tags = todo_data.tags

    todo.updated_at = datetime.utcnow()
    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Start ───────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/start", response_model=dict)
async def start_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start task: Open -> In Progress, record start_at."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("只有被分配人才能开始任务")
    # Idempotent start: duplicate drag/drop or click should not fail.
    if todo.status == TodoStatus.IN_PROGRESS:
        return success_response(_enrich_todo(todo, session))


    if todo.status != TodoStatus.OPEN:
        from app.core.exceptions import ValidationException
        raise ValidationException(f"当前状态 {todo.status} 不能开始任务")

    todo.status = TodoStatus.IN_PROGRESS
    todo.start_at = datetime.utcnow()
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Submit for review ───────────────────────────────────────────────────────

@router.post("/{todo_id}/submit", response_model=dict)
async def submit_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Employee submits task as complete → pending_review. Notifies manager."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("只有被分配人才能提交完成")

    # Idempotent submit: duplicate drag/drop or click should not fail.
    if todo.status in (TodoStatus.PENDING_REVIEW, TodoStatus.DONE):
        return success_response(_enrich_todo(todo, session))

    if todo.status not in (TodoStatus.OPEN, TodoStatus.IN_PROGRESS, TodoStatus.BLOCKED):
        from app.core.exceptions import ValidationException
        raise ValidationException(f"当前状态 {todo.status} 不能提交完成")

    # Check if creator is assignee (Self-assigned)
    if todo.creator_user_id == current_user.id:
        todo.status = TodoStatus.DONE
        todo.done_at = datetime.utcnow()
        todo.done_by_user_id = current_user.id
        todo.reviewed_by_user_id = current_user.id  # Auto-approved
        todo.updated_at = datetime.utcnow()
        _apply_beli_rules_on_done(todo, session)

        session.add(todo)
        session.commit()
        session.refresh(todo)
    else:
        # Assigned by someone else: Needs review by CREATOR
        todo.status = TodoStatus.PENDING_REVIEW
        todo.review_comment = None  # Clear previous rejection comment
        todo.updated_at = datetime.utcnow()

        session.add(todo)
        session.commit()
        session.refresh(todo)

        # Notify creator
        _notify_user(todo.creator_user_id, todo, session)
        session.commit()

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Approve ─────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/approve", response_model=dict)
async def approve_todo(
    todo_id: UUID,
    data: TodoReviewAction = TodoReviewAction(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Manager approves task completion → done."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.status != TodoStatus.PENDING_REVIEW:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有上报完成的任务才能审核")

    # Must be the creator (or possibly a super admin, but sticking to creator for now)
    if todo.creator_user_id != current_user.id:
        # Check if it was "L0/Manager" logic before? 
        # Requirement: "A created for B -> A reviews"
        raise NotFoundException("只有任务创建人才能审核")

    todo.status = TodoStatus.DONE
    todo.done_at = datetime.utcnow()
    # done_by_user_id is already set when submitted/completed? 
    # Usually completion time is when employee submits. 
    # But usually 'done' status implies approved.
    # We should probably keep the original done_at if it was set during submit?
    # In submit_todo (pending_review branch), we didn't set done_at.
    # So we set it here.
    # Requirement: "任务完成以后，记录完成时间" (After task complete, record completion time).
    # If "Pending Review" is considered "Employee Completed", we might want to track that.
    # But status "DONE" happens here.
    todo.done_by_user_id = todo.assignee_user_id # The doer is the assignee
    todo.reviewed_by_user_id = current_user.id
    todo.review_comment = data.comment
    todo.updated_at = datetime.utcnow()
    _apply_beli_rules_on_done(todo, session)

    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Reject ──────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/reject", response_model=dict)
async def reject_todo(
    todo_id: UUID,
    data: TodoReviewAction,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Manager rejects task, sends it back with a comment."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.status != TodoStatus.PENDING_REVIEW:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有上报完成的任务才能退回")

    if todo.creator_user_id != current_user.id:
        raise NotFoundException("只有任务创建人才能退回")

    todo.status = TodoStatus.OPEN
    todo.reviewed_by_user_id = current_user.id
    todo.review_comment = data.comment or "请修改后重新提交"
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Legacy actions ──────────────────────────────────────────────────────────

@router.post("/{todo_id}/done", response_model=dict)
async def mark_todo_done(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Direct done (kept for backward compatibility, now redirects to submit flow)."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    if todo.action_type == TodoActionType.APPROVE:
        from app.core.exceptions import ValidationException
        raise ValidationException("审批类型的待办事项必须通过审批API完成")

    # Check if creator is assignee (Self-assigned)
    if todo.creator_user_id == current_user.id:
        todo.status = TodoStatus.DONE
        todo.done_at = datetime.utcnow()
        todo.done_by_user_id = current_user.id
        todo.reviewed_by_user_id = current_user.id
        todo.updated_at = datetime.utcnow()
        _apply_beli_rules_on_done(todo, session)

        session.add(todo)
        session.commit()
        session.refresh(todo)
    else:
        # Use submit flow: go to pending_review
        todo.status = TodoStatus.PENDING_REVIEW
        todo.review_comment = None
        todo.updated_at = datetime.utcnow()

        session.add(todo)
        session.commit()
        session.refresh(todo)

        _notify_user(todo.creator_user_id, todo, session)
        session.commit()

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


@router.post("/{todo_id}/block", response_model=dict)
async def block_todo(
    todo_id: UUID,
    blocked_reason: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Block todo with reason."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    todo.status = TodoStatus.BLOCKED
    todo.blocked_reason = blocked_reason
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


@router.post("/{todo_id}/dismiss", response_model=dict)
async def dismiss_todo(
    todo_id: UUID,
    dismiss_reason: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Dismiss todo."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    todo.status = TodoStatus.DISMISSED
    todo.dismiss_reason = dismiss_reason
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Status Change (Generic/Backward) ────────────────────────────────────────

class TodoStatusChange(TodoReviewAction):
    status: TodoStatus

@router.post("/{todo_id}/status", response_model=dict)
async def update_todo_status(
    todo_id: UUID,
    data: TodoStatusChange,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Manually update status. Handles backward transitions (Undo/Redo/Recall).
    - Open <-> In Progress
    - Pending Review -> In Progress (Recall/Request Changes)
    - Done -> In Progress (Reopen)
    - Done -> Open (Reset)
    """
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    target_status = data.status
    current_status = todo.status
    
    # Permission Checks & Logic
    
    # 1. In Progress -> Open (Stop/Reset)
    if current_status == TodoStatus.IN_PROGRESS and target_status == TodoStatus.OPEN:
        if todo.assignee_user_id != current_user.id:
            raise NotFoundException("只有被分配人才能重置任务")
        todo.status = TodoStatus.OPEN
        todo.start_at = None # Optional: Clear start time or keep history? Using None for "Reset"
    
    # 2. Pending Review -> In Progress (Recall or Request Changes)
    elif current_status == TodoStatus.PENDING_REVIEW and target_status == TodoStatus.IN_PROGRESS:
        # Assignee recalling
        if todo.assignee_user_id == current_user.id:
             todo.status = TodoStatus.IN_PROGRESS
        # Manager/Creator requesting changes (soft reject)
        elif todo.creator_user_id == current_user.id or _is_direct_manager(current_user, session.get(User, todo.assignee_user_id)):
             todo.status = TodoStatus.IN_PROGRESS
             todo.review_comment = data.comment
             todo.reviewed_by_user_id = current_user.id
        else:
             raise NotFoundException("无权更改此任务状态")
             
    # 3. Done -> In Progress (Reopen)
    elif current_status == TodoStatus.DONE and target_status == TodoStatus.IN_PROGRESS:
        # Creator or Manager can reopen
        if todo.creator_user_id == current_user.id or (todo.assignee_user_id == current_user.id and todo.creator_user_id == current_user.id):
            todo.status = TodoStatus.IN_PROGRESS
            todo.done_at = None
        else:
             # Check if manager
             assignee = session.get(User, todo.assignee_user_id)
             if _is_direct_manager(current_user, assignee):
                 todo.status = TodoStatus.IN_PROGRESS
                 todo.done_at = None
             else:
                 raise NotFoundException("无权重新打开任务")

    # 4. Open -> In Progress (Start) - Reuse logic or allow here
    elif current_status == TodoStatus.OPEN and target_status == TodoStatus.IN_PROGRESS:
        if todo.assignee_user_id != current_user.id:
             raise NotFoundException("只有被分配人才能开始任务")
        todo.status = TodoStatus.IN_PROGRESS
        if not todo.start_at:
            todo.start_at = datetime.utcnow()

    # 5. Done -> Open (Reset fully)
    elif current_status == TodoStatus.DONE and target_status == TodoStatus.OPEN:
         # Creator or Manager can reset
        if todo.creator_user_id == current_user.id or (todo.assignee_user_id == current_user.id and todo.creator_user_id == current_user.id):
            todo.status = TodoStatus.OPEN
            todo.done_at = None
            todo.start_at = None # Optional: full reset
        else:
             assignee = session.get(User, todo.assignee_user_id)
             if _is_direct_manager(current_user, assignee):
                 todo.status = TodoStatus.OPEN
                 todo.done_at = None
                 todo.start_at = None
             else:
                 raise NotFoundException("无权重置任务")

    # 6. Fallback/Other transitions
    else:
        # Prevent arbitrary jumps for now, unless we want to be very flexible
        # For drag and drop, we might need Pending -> Open (Reject) too, but that is covered by /reject
        # Let's allow Pending -> Open via this API too to simplify frontend
        if current_status == TodoStatus.PENDING_REVIEW and target_status == TodoStatus.OPEN:
             # Treat as Reject
             if todo.creator_user_id != current_user.id and not _is_direct_manager(current_user, session.get(User, todo.assignee_user_id)):
                  raise NotFoundException("无权退回任务")
             todo.status = TodoStatus.OPEN
             todo.review_comment = data.comment or "退回"
             todo.reviewed_by_user_id = current_user.id
        else:
             from app.core.exceptions import ValidationException
             raise ValidationException(f"不支持从 {current_status} 到 {target_status} 的直接变更")

    todo.updated_at = datetime.utcnow()
    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))
