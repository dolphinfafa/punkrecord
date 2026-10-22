"""Employee Beli accounts, independent task review and redemption."""
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Literal, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator
from sqlmodel import Session, select
from sqlalchemy import func
from app.core.auth import get_current_user
from app.core.database import get_session
from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.core.response import success_response
from app.schemas.text import NonBlankText, PlainText
from app.core.storage import save_file, get_file
from app.models.base import now_cn
from app.models.iam import User, UserStatus
from app.models.todo import TodoItem, TodoStatus
from app.models.meeting import MeetingRecord, MeetingStatus
from app.models.beli import (BeliLedger, TaskReward, WorkdayOverride, MorningAttendance,
                            BeliProduct, BeliOrder)
from app.services.beli import (LEAVE_FIELDS, require_l0, account_for, post_entry, change_leave,
    approve_reward, reconcile_attendance, order_action, create_order, money, lock_todo, reward_for,
    validate_plan)

router = APIRouter(prefix="/beli", tags=["Beli"])


def page_data(session, query, page, serialize=lambda row: row):
    total = session.exec(select(func.count()).select_from(query.order_by(None).subquery())).one()
    rows = session.exec(query.offset((page - 1) * 30).limit(30)).all()
    return {"items": [serialize(row) for row in rows], "total": total, "page": page, "page_size": 30}


def check_employee(session, user_id, viewer):
    user = session.get(User, user_id)
    if not user or (viewer.manager_user_id is not None and viewer.id != user_id):
        raise NotFoundException("未找到员工")
    if viewer.manager_user_id is None and user.manager_user_id is None and user.id != viewer.id:
        raise ForbiddenException("仅可管理 L0 以下员工")
    return user


def safe_reward(reward, session):
    todo = session.get(TodoItem, reward.todo_id)
    user = session.get(User, reward.user_id)
    # Never serialize the internal snapshot: it contains compensation data.
    return {"id": reward.id, "todo_id": reward.todo_id, "user_id": reward.user_id,
            "user_name": user.display_name if user else "", "title": todo.title if todo else "任务已删除",
            "status": reward.status, "amount": reward.amount, "comment": reward.comment,
            "reviewed_at": reward.reviewed_at, "priority": todo.priority if todo else None,
            "estimated_hours": todo.estimated_hours if todo else None,
            "due_at": todo.due_at if todo else None,
            "submitted_at": todo.submitted_at if todo else None}


@router.get("/accounts")
def accounts(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    query = select(User).order_by(User.id)
    query = query.where(User.manager_user_id.is_not(None)) if user.manager_user_id is None else query.where(User.id == user.id)
    result = []
    for employee in session.exec(query).all():
        _, account = account_for(session, employee.id)
        result.append({"user_id": employee.id, "name": employee.display_name, "status": employee.status,
            "balance": account.balance, "frozen": account.frozen, "available": account.balance - account.frozen,
            "leave": {key: getattr(employee, field) for key, field in LEAVE_FIELDS.items()}})
    session.commit()
    result.sort(key=lambda item: item["name"])
    return success_response({"is_l0": user.manager_user_id is None, "items": result})


@router.get("/ledger")
def ledger(user_id: UUID, page: int = Query(1, ge=1), paginated: bool = False, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    check_employee(session, user_id, user)
    data = page_data(session, select(BeliLedger).where(BeliLedger.user_id == user_id)
                     .order_by(BeliLedger.created_at.desc(), BeliLedger.id), page)
    return success_response(data if paginated else data["items"])


class Adjustment(BaseModel):
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    reason: NonBlankText = Field(min_length=1, max_length=500)
    request_key: UUID
    leave_type: Optional[Literal["annual", "maternity", "marriage", "personal", "sick"]] = None

    @model_validator(mode="after")
    def validate_leave_amount(self):
        if self.leave_type and abs(self.amount) > Decimal("99999999.5"):
            raise ValueError("假期调整天数不能超过 99999999.5")
        return self


@router.post("/accounts/{user_id}/adjust")
def adjust(user_id: UUID, data: Adjustment, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    employee = check_employee(session, user_id, user)
    if not employee.manager_user_id:
        raise ValidationException("请选择非 L0 员工")
    if data.amount == 0:
        raise ValidationException("调整金额不能为 0")
    key = f"adjust:{user_id}:{data.request_key}"
    if data.leave_type:
        if data.amount % Decimal("0.5"):
            raise ValidationException("假期调整以 0.5 天为单位")
        change_leave(session, user_id, data.leave_type, data.amount, key, data.reason, user.id)
    else:
        post_entry(session, user_id, data.amount, key, "manual", data.reason, user.id)
    session.commit()
    return success_response(message="已调整")


@router.get("/rewards")
def rewards(status: Optional[str] = None, page: int = Query(1, ge=1), paginated: bool = False, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    query = select(TaskReward)
    if user.manager_user_id:
        query = query.where(TaskReward.user_id == user.id)
    if status:
        query = query.where(TaskReward.status == status)
    if status in ("pending", "rejected"):
        query = query.join(TodoItem, TodoItem.id == TaskReward.todo_id).where(
            TodoItem.status == TodoStatus.DONE, TodoItem.estimated_hours > 0)
    data = page_data(session, query.order_by(TaskReward.updated_at.desc(), TaskReward.id), page,
                     lambda row: safe_reward(row, session))
    return success_response(data if paginated else data["items"])


class RewardReview(BaseModel):
    action: Literal["approve", "reject"]
    estimated_hours: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    due_at: Optional[date] = None
    priority: Optional[Literal["p0", "p1", "p2", "p3"]] = None
    comment: str = Field(default="", max_length=1000)


@router.post("/rewards/{todo_id}/review")
def review(todo_id: UUID, data: RewardReview, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    if data.action == "approve":
        from datetime import datetime, time
        changes = data.model_dump(exclude_none=True, exclude={"action", "comment"})
        if data.due_at:
            changes["due_at"] = datetime.combine(data.due_at, time(18))
        reward = approve_reward(session, todo_id, user, changes, data.comment)
    else:
        todo = lock_todo(session, todo_id)
        if not todo or todo.status != TodoStatus.DONE:
            raise ValidationException("任务必须先通过待办验收")
        validate_plan(todo, for_reward=True)
        reward = reward_for(session, todo)
        if not reward or reward.status not in ("pending", "rejected") or not data.comment.strip():
            raise ValidationException("奖励不可驳回或未填写原因")
        reward.status, reward.comment = "rejected", data.comment
        reward.reviewer_id, reward.reviewed_at = user.id, now_cn()
        session.add(reward)
    session.commit()
    return success_response(safe_reward(reward, session))


@router.get("/calendar")
def calendar(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return success_response(session.exec(select(WorkdayOverride).order_by(WorkdayOverride.day)).all())


class CalendarEntry(BaseModel):
    is_workday: bool
    reason: str = Field(min_length=1, max_length=200)


@router.put("/calendar/{day}")
def calendar_update(day: date, data: CalendarEntry, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    from app.models.beli import BeliPolicy
    session.exec(select(BeliPolicy).with_for_update()).first()
    row = session.exec(select(WorkdayOverride).where(WorkdayOverride.day == day).with_for_update()).first()
    if not row:
        row = WorkdayOverride(day=day, **data.model_dump())
    else:
        row.is_workday, row.reason = data.is_workday, data.reason
    session.add(row)
    session.flush()
    reconcile_attendance(session, day)
    session.commit()
    return success_response(row)


@router.get("/attendance")
def attendance(day: Optional[date] = None, page: int = Query(1, ge=1), session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    query = select(MorningAttendance)
    if user.manager_user_id:
        query = query.where(MorningAttendance.user_id == user.id)
    if day:
        query = query.where(MorningAttendance.day == day)
    data = page_data(session, query.order_by(MorningAttendance.day.desc(), MorningAttendance.id), page,
                     lambda row: {**row.model_dump(), "name": row.employee_name or session.get(User, row.user_id).display_name})
    unmatched = []
    if not user.manager_user_id and day:
        from app.services.meeting_participants import resolve_participants
        users = session.exec(select(User)).all()
        meetings = session.exec(select(MeetingRecord).where(MeetingRecord.meeting_date == day,
            MeetingRecord.meeting_type == "morning", MeetingRecord.status.in_([
                MeetingStatus.TRANSCRIBED, MeetingStatus.SUMMARIZED, MeetingStatus.ARCHIVED]))).all()
        snapshots = session.exec(select(MorningAttendance).where(MorningAttendance.day == day)).all()
        _, unmatched = resolve_participants(session, meetings,
            [u for u in users if u.created_at.date() <= day],
            {row.user_id: row.employee_name for row in snapshots if row.employee_name})
    from app.models.beli import BeliPolicy
    policy = session.exec(select(BeliPolicy)).first()
    data.update(unmatched_names=unmatched, starts_on=policy.starts_on if policy else None,
                policy_active=bool(policy and (not day or day >= policy.starts_on)))
    return success_response(data)


class Waiver(BaseModel):
    reason: NonBlankText = Field(min_length=1, max_length=500)


@router.post("/attendance/{attendance_id}/void")
def void_attendance(attendance_id: UUID, data: Waiver, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    # Same policy lock order as automatic reconciliation.
    from app.models.beli import BeliPolicy
    session.exec(select(BeliPolicy).with_for_update()).first()
    row = session.get(MorningAttendance, attendance_id)
    if not row or not data.reason.strip():
        raise ValidationException("考勤记录不存在或未填写作废原因")
    row.waived, row.reason = True, data.reason
    session.add(row)
    session.flush()
    reconcile_attendance(session, row.day)
    session.commit()
    return success_response(row)


class ProductInput(BaseModel):
    name: NonBlankText = Field(min_length=1, max_length=150)
    description: PlainText = Field(default="", max_length=2000)
    kind: Literal["leave", "physical"]
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    stock: int = Field(ge=0)
    active: bool = True
    leave_type: Optional[Literal["annual", "maternity", "marriage", "personal", "sick"]] = None
    leave_days: Optional[Decimal] = Field(default=None, gt=0, max_digits=6, decimal_places=1)

    @model_validator(mode="after")
    def validate_leave(self):
        if self.kind == "leave" and (not self.leave_type or self.leave_days is None or self.leave_days % Decimal("0.5")):
            raise ValueError("假期商品需指定假期类型及天数，以 0.5 天为单位")
        return self


@router.get("/products")
def products(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    query = select(BeliProduct).order_by(BeliProduct.created_at.desc())
    if user.manager_user_id:
        query = query.where(BeliProduct.active == True)
    return success_response(session.exec(query).all())


@router.post("/products")
def product_create(data: ProductInput, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    row = BeliProduct(**data.model_dump())
    session.add(row)
    session.commit()
    session.refresh(row)
    return success_response(row)


@router.put("/products/{product_id}")
def product_update(product_id: UUID, data: ProductInput, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    row = session.exec(select(BeliProduct).where(BeliProduct.id == product_id).with_for_update()).first()
    if not row:
        raise NotFoundException("未找到商品")
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return success_response(row)


@router.post("/products/{product_id}/image")
async def product_image(product_id: UUID, file: UploadFile = File(...), session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    require_l0(user)
    product = session.get(BeliProduct, product_id)
    if not product:
        raise NotFoundException("未找到商品")
    content = await file.read(10 * 1024 * 1024 + 1)
    import imghdr
    image_type = imghdr.what(None, content)
    if image_type not in ("jpeg", "png", "webp"):
        raise ValidationException("仅支持有效的 JPG、PNG、WebP 图片")
    suffix, mime = {"jpeg": (".jpg", "image/jpeg"), "png": (".png", "image/png"), "webp": (".webp", "image/webp")}[image_type]
    if len(content) > 10 * 1024 * 1024:
        raise ValidationException("图片不能超过 10MB")
    name = f"{uuid4().hex}{suffix}"
    save_file("beli-products", name, content, mime)
    product.image_name = name
    session.add(product)
    session.commit()
    return success_response(product)


@router.get("/products/{product_id}/image")
def product_image_get(product_id: UUID, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    product = session.get(BeliProduct, product_id)
    if not product or not product.image_name or (user.manager_user_id and not product.active):
        raise NotFoundException("未找到图片")
    content, _ = get_file("beli-products", product.image_name)
    mime = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[Path(product.image_name).suffix]
    return Response(content=content, media_type=mime)


class OrderInput(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=100)
    request_key: UUID
    delivery: str = Field(default="", max_length=1000)


@router.post("/orders")
def order_create(data: OrderInput, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    row = create_order(session, user, data.product_id, data.quantity, str(data.request_key), data.delivery)
    session.commit()
    session.refresh(row)
    return success_response(row)


@router.get("/orders")
def orders(page: int = Query(1, ge=1), paginated: bool = False, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    query = select(BeliOrder).order_by(BeliOrder.created_at.desc())
    if user.manager_user_id:
        query = query.where(BeliOrder.user_id == user.id)
    data = page_data(session, query.order_by(BeliOrder.id), page,
                     lambda r: {**r.model_dump(), "user_name": session.get(User, r.user_id).display_name})
    return success_response(data if paginated else data["items"])


class OrderAction(BaseModel):
    action: Literal["approve", "reject", "cancel", "ship"]
    comment: str = Field(default="", max_length=1000)
    tracking: str = Field(default="", max_length=500)


@router.post("/orders/{order_id}/action")
def order_update(order_id: UUID, data: OrderAction, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    row = order_action(session, order_id, user, data.action, data.comment, data.tracking)
    session.commit()
    session.refresh(row)
    return success_response(row)
