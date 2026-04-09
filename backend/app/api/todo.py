"""
Todo API endpoints
"""
from typing import Optional, Any
from app.models.base import now_cn
from uuid import UUID, uuid4
from datetime import datetime, time, timedelta
import math
from pathlib import Path
from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import require_permission
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
from app.core.storage import save_file, get_file, delete_file, get_download_url

router = APIRouter(prefix="/todo", tags=["Todo"])
TODO_IMAGE_DIR = Path(__file__).resolve().parents[2] / "uploads" / "todo-images"
MAX_TODO_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB per image


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_todo(todo: TodoItem, session: Session) -> TodoResponse:
    """Build TodoResponse with resolved assignee/creator names."""
    assignee = session.get(User, todo.assignee_user_id)
    creator = session.get(User, todo.creator_user_id)
    data = TodoResponse.model_validate(todo)
    data.assignee_name = assignee.display_name if assignee else None
    data.creator_name = creator.display_name if creator else None
    if todo.reviewed_by_user_id:
        reviewer = session.get(User, todo.reviewed_by_user_id)
        data.reviewer_name = reviewer.display_name if reviewer else None
    return data


def _can_access_todo(todo: TodoItem, current_user: User, session: Session) -> bool:
    if todo.assignee_user_id == current_user.id or todo.creator_user_id == current_user.id:
        return True
    assignee = session.get(User, todo.assignee_user_id)
    return bool(assignee and assignee.manager_user_id == current_user.id)


EVENT_LABELS = {
    "todo_assigned": "新任务分配",
    "todo_created_notify_manager": "下属收到新任务",
    "todo_submitted": "任务提交审核",
    "todo_approved": "任务审核通过",
    "todo_rejected": "任务被退回",
    "todo_reassigned": "任务转派",
    "todo_reopened": "任务被重新打开",
    "todo_blocked": "任务被阻塞",
    "todo_done_direct": "任务已完成",
}


def _send_wechat_for_todo(recipient_user_id: UUID, todo: TodoItem, session: Session, event_type: str):
    """Send WeChat notification for a todo event if user has active binding and preference enabled."""
    from app.models.shared import WeChatNotifyBinding
    from app.core.config import settings

    if not settings.WECHAT_MSG_SERVICE_URL:
        return

    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == recipient_user_id,
            WeChatNotifyBinding.is_active == True,
        )
    ).first()
    if not binding:
        return

    # Check preference: None means all enabled (backward compatible)
    if binding.preferences is not None:
        if not binding.preferences.get(event_type, True):
            return

    label = EVENT_LABELS.get(event_type, "待办通知")
    assignee = session.get(User, todo.assignee_user_id)
    text = f"📋 {label}\n标题: {todo.title}\n优先级: {todo.priority.value.upper()}\n状态: {todo.status.value}"
    if assignee:
        text += f"\n负责人: {assignee.display_name}"

    import httpx
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                f"{settings.WECHAT_MSG_SERVICE_URL}/api/send",
                json={"key": binding.msg_service_key, "text": text},
                headers={"Authorization": f"Bearer {settings.WECHAT_MSG_SERVICE_API_KEY}"}
                if settings.WECHAT_MSG_SERVICE_API_KEY else {},
            )
            status = NotificationStatus.SENT if resp.status_code == 200 else NotificationStatus.FAILED
            error_msg = None if resp.status_code == 200 else resp.text
    except Exception as e:
        status = NotificationStatus.FAILED
        error_msg = str(e)

    wechat_log = NotificationLog(
        todo_id=todo.id,
        recipient_user_id=recipient_user_id,
        channel=NotificationChannel.WECHAT,
        status=status,
        sent_at=now_cn(),
        error_message=error_msg,
    )
    session.add(wechat_log)


def _notify_manager(user_id: UUID, todo: TodoItem, session: Session, event_type: str = "todo_created_notify_manager"):
    """Create an in-app notification for the user's manager (if they have one)."""
    user = session.get(User, user_id)
    if not user or not user.manager_user_id:
        return
    log = NotificationLog(
        todo_id=todo.id,
        recipient_user_id=user.manager_user_id,
        channel=NotificationChannel.IN_APP,
        status=NotificationStatus.SENT,
        sent_at=now_cn(),
    )
    session.add(log)
    _send_wechat_for_todo(user.manager_user_id, todo, session, event_type)


def _notify_user(user_id: UUID, todo: TodoItem, session: Session, event_type: str = "todo_submitted"):
    """Create an in-app notification for a specific user."""
    log = NotificationLog(
        todo_id=todo.id,
        recipient_user_id=user_id,
        channel=NotificationChannel.IN_APP,
        status=NotificationStatus.SENT,
        sent_at=now_cn(),
    )
    session.add(log)
    _send_wechat_for_todo(user_id, todo, session, event_type)


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


def _calc_leave_days(start_at: datetime, end_at: datetime) -> float:
    """基于工作时间计算请假天数，精度 0.5 天。
    工作时间：周一至周五，上午 10:00-12:00，下午 14:00-19:00。
    每个半天算 0.5 天，全天算 1.0 天。
    """
    total = 0.0
    current_date = start_at.date()
    end_date = end_at.date()
    while current_date <= end_date:
        if current_date.weekday() < 5:  # 工作日 Mon-Fri
            day_start_bound = datetime.combine(current_date, time(0, 0))
            day_end_bound = datetime.combine(current_date, time(23, 59, 59))
            actual_start = max(start_at, day_start_bound)
            actual_end = min(end_at, day_end_bound)
            # 上午 10:00-12:00
            morning_s = datetime.combine(current_date, time(10, 0))
            morning_e = datetime.combine(current_date, time(12, 0))
            if actual_start < morning_e and actual_end > morning_s:
                total += 0.5
            # 下午 14:00-19:00
            afternoon_s = datetime.combine(current_date, time(14, 0))
            afternoon_e = datetime.combine(current_date, time(19, 0))
            if actual_start < afternoon_e and actual_end > afternoon_s:
                total += 0.5
        current_date += timedelta(days=1)
    return max(0.5, total)


def _apply_beli_rules_on_done(todo: TodoItem, session: Session):
    """Apply active Beli rules once when a todo is completed."""
    link = dict(todo.link or {})
    if link.get("beli_applied"):
        return

    if not todo.due_at or not todo.done_at:
        link["beli_applied"] = True
        link["beli_delta"] = 0.0
        link["beli_applied_at"] = now_cn().isoformat()
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
    link["beli_applied_at"] = now_cn().isoformat()
    link["beli_days_diff"] = days_diff
    link["beli_rule_hits"] = hits
    todo.link = link
    session.add(todo)


# ─── Create ──────────────────────────────────────────────────────────────────

@router.post("", response_model=dict)
async def create_todo(
    todo_data: TodoCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Create new todo item. Notifies the assignee's manager."""
    import uuid as _uuid
    source_id = todo_data.source_id or str(_uuid.uuid4())

    our_entity_id = todo_data.our_entity_id
    if not our_entity_id:
        default_entity = session.exec(select(OurEntity)).first()
        if default_entity:
            our_entity_id = default_entity.id
    if not our_entity_id:
        raise ValidationException("未找到可用主体，无法创建任务")

    # Extract reviewed_by_user_id from link if provided
    reviewed_by = None
    if todo_data.link and todo_data.link.get("reviewer_user_id"):
        try:
            reviewed_by = _uuid.UUID(str(todo_data.link["reviewer_user_id"]))
        except (ValueError, TypeError):
            pass

    new_todo = TodoItem(
        our_entity_id=our_entity_id,
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
        link=todo_data.link,
        reviewed_by_user_id=reviewed_by,
    )

    session.add(new_todo)
    session.commit()
    session.refresh(new_todo)

    # Notify the assignee and their manager (non-critical, don't fail the request)
    try:
        _notify_user(todo_data.assignee_user_id, new_todo, session, "todo_assigned")
        _notify_manager(todo_data.assignee_user_id, new_todo, session, "todo_created_notify_manager")
        session.commit()
    except Exception:
        session.rollback()

    return success_response(_enrich_todo(new_todo, session))


# ─── My todos ────────────────────────────────────────────────────────────────

@router.get("/my", response_model=dict)
async def get_my_todos(
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.read"))
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
    reviewed_by_user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.read"))
):
    """Get todos where assignee is not current user, with optional reviewer filter."""
    query = select(TodoItem).where(
        TodoItem.assignee_user_id != current_user.id
    )

    if reviewed_by_user_id:
        try:
            query = query.where(TodoItem.reviewed_by_user_id == UUID(reviewed_by_user_id))
        except ValueError:
            pass

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
    })


# ─── Leave requests ───────────────────────────────────────────────────────────

@router.post("/leaves", response_model=dict)
async def create_leave_request(
    data: LeaveRequestCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
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

    # Create a TodoItem for the approver (applicant's direct manager)
    manager = session.get(User, current_user.manager_user_id)
    if manager:
        leave_type_labels = {
            LeaveType.ANNUAL: "年假",
            LeaveType.MATERNITY: "产假",
            LeaveType.MARRIAGE: "婚假",
            LeaveType.PERSONAL: "事假",
            LeaveType.SICK: "病假",
        }
        leave_label = leave_type_labels.get(leave_type, str(leave_type))
        today_end = datetime.now().replace(hour=23, minute=59, second=59, microsecond=0)
        def _fmt_half(dt: datetime) -> str:
            return f"{dt.strftime('%Y-%m-%d')} {'上午' if dt.hour < 13 else '下午'}"
        days_str = f"{leave_days:g}"  # 0.5 -> "0.5", 1.0 -> "1"
        leave_desc = (
            f"请假类型：{leave_label}\n"
            f"请假时间：{_fmt_half(data.start_at)} 至 {_fmt_half(data.end_at)}（{days_str}天）\n"
            f"请假原因：{data.reason or '未填写'}"
        )
        approval_todo = TodoItem(
            our_entity_id=our_entity_id,
            assignee_user_id=current_user.id,
            creator_user_id=current_user.id,
            reviewed_by_user_id=manager.id,
            title=f"{current_user.display_name} - 请假申请",
            description=leave_desc,
            source_type=TodoSourceType.APPROVAL_STEP,
            source_id=str(leave.id),
            action_type=TodoActionType.APPROVE,
            priority="p1",
            status=TodoStatus.PENDING_REVIEW,
            due_at=today_end,
            tags=["leave_approval"],
            link={"leave_id": str(leave.id), "leave_type": data.leave_type},
        )
        session.add(approval_todo)
        session.commit()

    return success_response(_enrich_leave(leave, session))


@router.get("/leaves/my", response_model=dict)
async def list_my_leave_requests(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.read"))
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
    current_user: User = Depends(require_permission("todo.read"))
):
    """List pending leave requests where current user is the applicant's direct manager."""
    # Only find direct subordinates (users whose manager_user_id == current_user.id)
    all_users = session.exec(select(User)).all()
    managed_user_ids = [u.id for u in all_users if u.manager_user_id == current_user.id]

    if not managed_user_ids:
        return success_response([])

    from sqlmodel import col
    requests = session.exec(
        select(LeaveRequest)
        .where(col(LeaveRequest.applicant_user_id).in_(managed_user_ids))
        .where(LeaveRequest.status == LeaveStatus.PENDING)
        .order_by(LeaveRequest.created_at.desc())
    ).all()
    return success_response([_enrich_leave(item, session) for item in requests])


@router.post("/leaves/{leave_id}/approve", response_model=dict)
async def approve_leave_request(
    leave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Approve leave request by manager in the applicant's manager chain and deduct leave balance."""
    leave = session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException("未找到请假申请")
    if leave.status != LeaveStatus.PENDING:
        raise ValidationException("仅待审批的请假可通过")

    applicant = session.get(User, leave.applicant_user_id)
    if not applicant:
        raise NotFoundException("未找到请假申请人")

    # Check if current_user is in the applicant's manager chain
    all_users = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users}
    is_manager = False
    current = applicant
    visited = set()
    while current.manager_user_id and current.manager_user_id not in visited:
        if current.manager_user_id == current_user.id:
            is_manager = True
            break
        visited.add(current.id)
        current = user_map.get(current.manager_user_id)
        if not current:
            break
    if not is_manager:
        raise ValidationException("仅上级主管可审批此请假申请")

    leave_days = _calc_leave_days(leave.start_at, leave.end_at)
    balance_field = _resolve_leave_balance_field(leave.leave_type)
    current_balance = float(getattr(applicant, balance_field, 0.0) or 0.0)
    if leave_days > current_balance:
        raise ValidationException(f"请假申请人剩余假期不足（剩余 {current_balance:.1f} 天）")

    setattr(applicant, balance_field, current_balance - leave_days)
    leave.status = LeaveStatus.APPROVED
    leave.approved_by_user_id = current_user.id
    leave.approved_at = now_cn()
    leave.review_comment = None
    leave.updated_at = now_cn()
    session.add(applicant)
    session.add(leave)

    # Sync the corresponding TodoItem status
    from sqlmodel import col
    leave_todos = session.exec(
        select(TodoItem)
        .where(TodoItem.source_type == TodoSourceType.APPROVAL_STEP)
        .where(TodoItem.source_id == str(leave.id))
        .where(col(TodoItem.tags).contains("leave_approval"))
    ).all()
    for t in leave_todos:
        t.status = TodoStatus.DONE
        t.done_at = now_cn()
        t.done_by_user_id = current_user.id
        t.review_comment = "请假已批准"
        t.updated_at = now_cn()
        session.add(t)

    session.commit()
    session.refresh(leave)
    return success_response(_enrich_leave(leave, session))


@router.post("/leaves/{leave_id}/reject", response_model=dict)
async def reject_leave_request(
    leave_id: UUID,
    data: TodoReviewAction,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Reject leave request by manager in the applicant's manager chain."""
    leave = session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException("未找到请假申请")
    if leave.status != LeaveStatus.PENDING:
        raise ValidationException("仅待审批的请假可拒绝")

    applicant = session.get(User, leave.applicant_user_id)
    if not applicant:
        raise NotFoundException("未找到请假申请人")

    # Check if current_user is in the applicant's manager chain
    all_users = session.exec(select(User)).all()
    user_map = {u.id: u for u in all_users}
    is_manager = False
    current = applicant
    visited = set()
    while current.manager_user_id and current.manager_user_id not in visited:
        if current.manager_user_id == current_user.id:
            is_manager = True
            break
        visited.add(current.id)
        current = user_map.get(current.manager_user_id)
        if not current:
            break
    if not is_manager:
        raise ValidationException("仅上级主管可审批此请假申请")

    leave.status = LeaveStatus.REJECTED
    leave.approved_by_user_id = current_user.id
    leave.approved_at = now_cn()
    leave.review_comment = data.comment or "请假申请未通过"
    leave.updated_at = now_cn()
    session.add(leave)

    # Sync the corresponding TodoItem status
    from sqlmodel import col
    leave_todos = session.exec(
        select(TodoItem)
        .where(TodoItem.source_type == TodoSourceType.APPROVAL_STEP)
        .where(TodoItem.source_id == str(leave.id))
        .where(col(TodoItem.tags).contains("leave_approval"))
    ).all()
    for t in leave_todos:
        t.status = TodoStatus.DISMISSED
        t.review_comment = data.comment or "请假申请未通过"
        t.updated_at = now_cn()
        session.add(t)

    session.commit()
    session.refresh(leave)
    return success_response(_enrich_leave(leave, session))


# ─── Single todo ─────────────────────────────────────────────────────────────

@router.get("/{todo_id}", response_model=dict)
async def get_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.read"))
):
    """Get todo by ID."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    # Access: assignee, creator, or direct manager of assignee
    if not _can_access_todo(todo, current_user, session):
        raise NotFoundException("未找到待办事项")

    return success_response(_enrich_todo(todo, session))


# ─── Update ──────────────────────────────────────────────────────────────────

@router.patch("/{todo_id}", response_model=dict)
async def update_todo(
    todo_id: UUID,
    todo_data: TodoUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Update todo (assignee, creator, or direct manager of assignee)."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if not _can_access_todo(todo, current_user, session):
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
    if todo_data.link is not None:
        # Merge with existing link to preserve fields not sent
        existing_link = dict(todo.link or {})
        existing_link.update(todo_data.link)
        todo.link = existing_link
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(todo, 'link')
    reassigned_to = None
    if todo_data.assignee_user_id is not None and todo_data.assignee_user_id != todo.assignee_user_id:
        reassigned_to = todo_data.assignee_user_id
        todo.assignee_user_id = todo_data.assignee_user_id

    todo.updated_at = now_cn()
    session.add(todo)
    session.commit()
    session.refresh(todo)

    if reassigned_to:
        try:
            _notify_user(reassigned_to, todo, session, "todo_reassigned")
            session.commit()
        except Exception:
            session.rollback()

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))


@router.post("/{todo_id}/images", response_model=dict)
async def upload_todo_image(
    todo_id: UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Upload one image for a todo item (supports multiple images by repeated upload)."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")
    if not _can_access_todo(todo, current_user, session):
        raise NotFoundException("未找到待办事项")
    if not file.filename:
        raise ValidationException("图片文件名不能为空")

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise ValidationException("仅支持图片文件")

    file_bytes = await file.read()
    if not file_bytes:
        raise ValidationException("图片内容不能为空")
    if len(file_bytes) > MAX_TODO_IMAGE_SIZE:
        raise ValidationException("单张图片大小不能超过 10MB")

    image_id = uuid4().hex
    safe_suffix = Path(file.filename).suffix[:20]
    stored_name = f"{todo.id}_{image_id}{safe_suffix}"
    save_file("todo-images", stored_name, file_bytes, content_type)

    image_meta: dict[str, Any] = {
        "id": image_id,
        "file_name": file.filename,
        "stored_name": stored_name,
        "content_type": content_type,
        "size": len(file_bytes),
        "uploaded_at": now_cn().isoformat(),
        "uploaded_by_user_id": str(current_user.id),
    }

    link = dict(todo.link or {})
    images = list(link.get("todo_images") or [])
    images.append(image_meta)
    link["todo_images"] = images
    todo.link = link
    todo.updated_at = now_cn()
    session.add(todo)
    session.commit()

    return success_response(image_meta)


@router.get("/{todo_id}/images/{image_id}/download")
async def download_todo_image(
    todo_id: UUID,
    image_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.read"))
):
    """Download one uploaded todo image by image_id."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")
    if not _can_access_todo(todo, current_user, session):
        raise NotFoundException("未找到待办事项")

    link = dict(todo.link or {})
    image = next((item for item in list(link.get("todo_images") or []) if item.get("id") == image_id), None)
    if not image:
        raise NotFoundException("未找到任务图片")

    stored_name = image.get("stored_name")
    file_name = image.get("file_name") or "todo-image"
    if not stored_name:
        raise NotFoundException("图片元数据异常")

    url = get_download_url("todo-images", stored_name)
    if url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)

    try:
        _, local_path = get_file("todo-images", stored_name)
    except FileNotFoundError:
        raise NotFoundException("图片文件不存在")

    return FileResponse(
        path=local_path,
        media_type=image.get("content_type") or "application/octet-stream",
        filename=file_name,
    )


@router.delete("/{todo_id}/images/{image_id}", response_model=dict)
async def delete_todo_image(
    todo_id: UUID,
    image_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Delete one uploaded todo image."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")
    if not _can_access_todo(todo, current_user, session):
        raise NotFoundException("未找到待办事项")

    link = dict(todo.link or {})
    images = list(link.get("todo_images") or [])
    target = next((item for item in images if item.get("id") == image_id), None)
    if not target:
        raise NotFoundException("未找到任务图片")

    stored_name = target.get("stored_name")
    if stored_name:
        try:
            delete_file("todo-images", stored_name)
        except Exception:
            pass

    remain = [item for item in images if item.get("id") != image_id]
    link["todo_images"] = remain
    todo.link = link
    todo.updated_at = now_cn()
    session.add(todo)
    session.commit()
    return success_response({"message": "图片已删除"})


# ─── Start ───────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/start", response_model=dict)
async def start_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Start task: Open -> In Progress, record start_at."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    # Allow assignee or creator (for bugs, tester is creator) to start
    if todo.assignee_user_id != current_user.id and todo.creator_user_id != current_user.id:
        raise NotFoundException("只有被分配人或创建人才能开始任务")
    # Idempotent start: duplicate drag/drop or click should not fail.
    if todo.status == TodoStatus.IN_PROGRESS:
        return success_response(_enrich_todo(todo, session))


    if todo.status != TodoStatus.OPEN:
        from app.core.exceptions import ValidationException
        raise ValidationException(f"当前状态 {todo.status} 不能开始任务")

    todo.status = TodoStatus.IN_PROGRESS
    todo.start_at = now_cn()
    todo.updated_at = now_cn()

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
    current_user: User = Depends(require_permission("todo.write"))
):
    """Employee submits task as complete → pending_review. Notifies manager."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    # Allow assignee or creator (for bugs, tester is creator) to submit
    if todo.assignee_user_id != current_user.id and todo.creator_user_id != current_user.id:
        raise NotFoundException("只有被分配人或创建人才能提交完成")

    # Idempotent submit: duplicate drag/drop or click should not fail.
    if todo.status in (TodoStatus.PENDING_REVIEW, TodoStatus.DONE):
        return success_response(_enrich_todo(todo, session))

    if todo.status not in (TodoStatus.OPEN, TodoStatus.IN_PROGRESS, TodoStatus.BLOCKED):
        from app.core.exceptions import ValidationException
        raise ValidationException(f"当前状态 {todo.status} 不能提交完成")

    # Check if creator is assignee (Self-assigned) AND no separate reviewer
    is_self_assigned = (
        todo.creator_user_id == current_user.id
        and todo.assignee_user_id == current_user.id
        and not todo.reviewed_by_user_id
    )
    if is_self_assigned:
        todo.status = TodoStatus.DONE
        todo.done_at = now_cn()
        todo.done_by_user_id = current_user.id
        todo.reviewed_by_user_id = current_user.id  # Auto-approved
        todo.updated_at = now_cn()
        _apply_beli_rules_on_done(todo, session)

        session.add(todo)
        session.commit()
        session.refresh(todo)
    else:
        # Assigned by someone else: Needs review by CREATOR
        todo.status = TodoStatus.PENDING_REVIEW
        todo.review_comment = None  # Clear previous rejection comment
        todo.updated_at = now_cn()

        session.add(todo)
        session.commit()
        session.refresh(todo)

        # Notify creator
        _notify_user(todo.creator_user_id, todo, session, "todo_submitted")
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
    current_user: User = Depends(require_permission("todo.write"))
):
    """Manager approves task completion → done."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.status != TodoStatus.PENDING_REVIEW:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有上报完成的任务才能审核")

    # Reviewer has priority; fall back to creator
    reviewer_id = todo.reviewed_by_user_id or todo.creator_user_id
    if reviewer_id != current_user.id:
        raise NotFoundException("只有审核员才能审核此任务")

    todo.status = TodoStatus.DONE
    todo.done_at = now_cn()
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
    todo.updated_at = now_cn()
    _apply_beli_rules_on_done(todo, session)

    session.add(todo)
    session.commit()
    session.refresh(todo)

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    # Notify assignee that task was approved
    _notify_user(todo.assignee_user_id, todo, session, "todo_approved")
    session.commit()

    # If this is a leave approval todo, sync the LeaveRequest status
    if todo.source_type == TodoSourceType.APPROVAL_STEP and todo.source_id:
        try:
            leave = session.get(LeaveRequest, UUID(todo.source_id))
            if leave and leave.status == LeaveStatus.PENDING:
                applicant = session.get(User, leave.applicant_user_id)
                if applicant:
                    leave_days = _calc_leave_days(leave.start_at, leave.end_at)
                    balance_field = _resolve_leave_balance_field(leave.leave_type)
                    current_balance = float(getattr(applicant, balance_field, 0.0) or 0.0)
                    setattr(applicant, balance_field, max(0, current_balance - leave_days))
                    session.add(applicant)
                leave.status = LeaveStatus.APPROVED
                leave.approved_by_user_id = current_user.id
                leave.approved_at = now_cn()
                leave.updated_at = now_cn()
                session.add(leave)
                session.commit()
        except (ValueError, Exception):
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Reject ──────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/reject", response_model=dict)
async def reject_todo(
    todo_id: UUID,
    data: TodoReviewAction,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
):
    """Manager rejects task, sends it back with a comment."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.status != TodoStatus.PENDING_REVIEW:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有上报完成的任务才能退回")

    reviewer_id = todo.reviewed_by_user_id or todo.creator_user_id
    if reviewer_id != current_user.id:
        raise NotFoundException("只有审核员才能退回此任务")

    todo.status = TodoStatus.OPEN
    todo.reviewed_by_user_id = current_user.id
    todo.review_comment = data.comment or "请修改后重新提交"
    todo.updated_at = now_cn()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    # Notify assignee that task was rejected
    _notify_user(todo.assignee_user_id, todo, session, "todo_rejected")
    session.commit()

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    # If this is a leave approval todo, sync the LeaveRequest status to rejected
    if todo.source_type == TodoSourceType.APPROVAL_STEP and todo.source_id:
        try:
            leave = session.get(LeaveRequest, UUID(todo.source_id))
            if leave and leave.status == LeaveStatus.PENDING:
                leave.status = LeaveStatus.REJECTED
                leave.approved_by_user_id = current_user.id
                leave.approved_at = now_cn()
                leave.review_comment = data.comment or "请假申请未通过"
                leave.updated_at = now_cn()
                session.add(leave)
                session.commit()
        except (ValueError, Exception):
            pass

    return success_response(_enrich_todo(todo, session))


# ─── Legacy actions ──────────────────────────────────────────────────────────

@router.post("/{todo_id}/done", response_model=dict)
async def mark_todo_done(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("todo.write"))
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
        todo.done_at = now_cn()
        todo.done_by_user_id = current_user.id
        todo.reviewed_by_user_id = current_user.id
        todo.updated_at = now_cn()
        _apply_beli_rules_on_done(todo, session)

        session.add(todo)
        session.commit()
        session.refresh(todo)
    else:
        # Use submit flow: go to pending_review
        todo.status = TodoStatus.PENDING_REVIEW
        todo.review_comment = None
        todo.updated_at = now_cn()

        session.add(todo)
        session.commit()
        session.refresh(todo)

        _notify_user(todo.creator_user_id, todo, session, "todo_submitted")
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
    current_user: User = Depends(require_permission("todo.write"))
):
    """Block todo with reason."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    todo.status = TodoStatus.BLOCKED
    todo.blocked_reason = blocked_reason
    todo.updated_at = now_cn()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    # Notify creator that task is blocked
    _notify_user(todo.creator_user_id, todo, session, "todo_blocked")
    session.commit()

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
    current_user: User = Depends(require_permission("todo.write"))
):
    """Dismiss todo."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    todo.status = TodoStatus.DISMISSED
    todo.dismiss_reason = dismiss_reason
    todo.updated_at = now_cn()

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
    current_user: User = Depends(require_permission("todo.write"))
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
    is_reopen = False

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
        is_reopen = True
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
            todo.start_at = now_cn()

    # 5. Done -> Open (Reset fully)
    elif current_status == TodoStatus.DONE and target_status == TodoStatus.OPEN:
        is_reopen = True
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

    # 6. AI workflow transitions — agent_status stored in link, todo.status follows normal flow
    elif target_status == TodoStatus.AI_FIXING and current_status in (TodoStatus.OPEN, TodoStatus.IN_PROGRESS, TodoStatus.BLOCKED):
        # Set todo to in_progress, record agent_status in link
        todo.status = TodoStatus.IN_PROGRESS
        if not todo.start_at:
            todo.start_at = now_cn()
        link = dict(todo.link or {})
        link['agent_status'] = 'ai_fixing'
        todo.link = link
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(todo, 'link')

    elif target_status == TodoStatus.AI_FIXED:
        # AI finished — todo stays in_progress, only agent_status changes
        link = dict(todo.link or {})
        link['agent_status'] = 'ai_fixed'
        todo.link = link
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(todo, 'link')
        # Do NOT change todo.status — employee must submit for review manually

    # 7. Fallback/Other transitions
    else:
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

    todo.updated_at = now_cn()
    session.add(todo)
    session.commit()
    session.refresh(todo)

    if is_reopen:
        _notify_user(todo.assignee_user_id, todo, session, "todo_reopened")
        session.commit()

    if todo.source_type == TodoSourceType.PROJECT_TASK and todo.source_id:
        try:
            sync_project_progress(session, UUID(todo.source_id))
        except ValueError:
            pass

    return success_response(_enrich_todo(todo, session))
