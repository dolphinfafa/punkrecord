"""Transactional rewards, attendance, leave balances and store accounting."""
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, uuid4

from sqlmodel import Session, select
from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.models.base import now_cn
from app.models.iam import User, UserStatus
from app.models.todo import TodoItem, TodoStatus, LeaveRequest, LeaveStatus
from app.models.meeting import MeetingRecord, MeetingStatus
from app.models.beli import (BeliAccount, BeliLedger, TaskReward, WorkdayOverride,
                            BeliPolicy, MorningAttendance, BeliOrder, BeliProduct)

LEAVE_FIELDS = {name: f"leave_{name}_remaining" for name in ("annual", "maternity", "marriage", "personal", "sick")}
PRIORITIES = {"p0": Decimal("1.2"), "p1": Decimal("1"), "p2": Decimal("1"), "p3": Decimal("0.8")}


def money(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def require_l0(user):
    if user.manager_user_id is not None:
        raise ForbiddenException("仅 L0 可执行此操作")


def lock_user(session, user_id):
    user = session.exec(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)).first()
    if not user:
        raise NotFoundException("未找到员工")
    return user


def lock_todo(session, todo_id):
    return session.exec(select(TodoItem).where(TodoItem.id == todo_id).with_for_update().execution_options(populate_existing=True)).first()


def account_for(session, user_id):
    user = lock_user(session, user_id)
    account = session.exec(select(BeliAccount).where(BeliAccount.user_id == user_id).with_for_update().execution_options(populate_existing=True)).first()
    if account is None:
        account = BeliAccount(user_id=user_id, balance=money(user.beili_balance))
        session.add(account)
        session.flush()
        session.add(BeliLedger(user_id=user_id, event_key=f"opening:{user_id}", kind="opening",
                               amount=account.balance, balance_after=account.balance, reason="历史余额结转"))
        session.flush()
    return user, account


def post_entry(session, user_id, amount, key, kind, reason, actor_id=None, details=None, leave_type=None, leave_days=None):
    user, account = account_for(session, user_id)
    existing = session.exec(select(BeliLedger).where(BeliLedger.event_key == key)).first()
    if existing:
        if existing.amount != money(amount) or existing.kind != kind or existing.leave_type != leave_type or existing.leave_days != leave_days:
            raise ValidationException("重复请求标识对应的调整内容不同")
        return existing
    amount = money(amount)
    account.balance = money(account.balance + amount)
    user.beili_balance = float(account.balance)
    user.updated_at = account.updated_at = now_cn()
    entry = BeliLedger(user_id=user_id, amount=amount, balance_after=account.balance,
                       event_key=key, kind=kind, reason=reason, actor_id=actor_id,
                       details=details or {}, leave_type=leave_type, leave_days=leave_days)
    session.add_all([account, user, entry])
    session.flush()
    return entry


def change_leave(session, user_id, leave_type, days, key, reason, actor_id=None):
    if leave_type not in LEAVE_FIELDS:
        raise ValidationException("无效假期类型")
    user, _ = account_for(session, user_id)
    existing = session.exec(select(BeliLedger).where(BeliLedger.event_key == key)).first()
    if existing:
        if existing.kind != "leave" or existing.leave_type != leave_type or existing.leave_days != money(days):
            raise ValidationException("重复请求标识对应的调整内容不同")
        return
    field = LEAVE_FIELDS[leave_type]
    balance = money(getattr(user, field)) + money(days)
    if balance < 0:
        raise ValidationException("假期余额不足")
    setattr(user, field, float(balance))
    session.add(user)
    session.flush()
    post_entry(session, user_id, 0, key, "leave", reason, actor_id,
               {"remaining_days": str(balance)}, leave_type, money(days))


def is_workday(session, day):
    override = session.exec(select(WorkdayOverride).where(WorkdayOverride.day == day)).first()
    return override.is_workday if override else day.weekday() < 5


def validate_plan(todo, *, for_reward=False):
    if not todo.due_at:
        raise ValidationException("请先补齐截止日期")
    if for_reward and (todo.estimated_hours is None or todo.estimated_hours <= 0):
        raise ValidationException("预计工时必须大于零才能审核贝利")


def reward_for(session, todo):
    return session.exec(select(TaskReward).where(TaskReward.todo_id == todo.id).with_for_update().execution_options(populate_existing=True)).first()


def queue_reward(session, todo, *, backfill=False):
    """Reconcile eligibility while the caller holds the task lock."""
    reward = reward_for(session, todo)
    if reward and reward.status == "approved":
        return
    employee = session.get(User, todo.assignee_user_id)
    policy = session.exec(select(BeliPolicy)).first()
    eligible = (todo.status == TodoStatus.DONE and todo.action_type == "do"
                and not (todo.link or {}).get("leave_id")
                and todo.estimated_hours is not None and todo.estimated_hours > 0
                and todo.due_at is not None and todo.submitted_at is not None and todo.done_at is not None
                and employee is not None and employee.manager_user_id is not None
                and (policy is None or todo.done_at.date() >= policy.starts_on))
    if not eligible:
        if reward and reward.status in ("pending", "rejected"):
            reward.history = [*reward.history, {"status": reward.status, "comment": reward.comment,
                "reviewer_id": str(reward.reviewer_id) if reward.reviewer_id else None,
                "reviewed_at": reward.reviewed_at.isoformat() if reward.reviewed_at else None,
                "excluded_at": now_cn().isoformat(), "reason": "任务不符合奖励条件"}]
            reward.status = "excluded"
            reward.updated_at = now_cn()
            session.add(reward)
        return
    if not reward:
        # Editing an old completed task must not create a retroactive reward.
        if backfill and (not policy or not policy.hours_rule_starts_at
                         or todo.done_at < policy.hours_rule_starts_at):
            return
        session.add(TaskReward(todo_id=todo.id, user_id=todo.assignee_user_id))
    elif reward.status in ("reversed", "excluded"):
        reward.status = "pending"
        reward.user_id = todo.assignee_user_id
        reward.reviewer_id = reward.reviewed_at = reward.comment = None
        reward.updated_at = now_cn()
        session.add(reward)


def reverse_reward(session, todo, actor_id, reason):
    reward = reward_for(session, todo)
    if reward and reward.status == "approved":
        post_entry(session, reward.user_id, -reward.amount, f"reward-reverse:{reward.id}:{reward.revision}",
                   "task_reverse", reason, actor_id, {"todo_id": str(todo.id)})
        reward.history = [*reward.history, {"snapshot": reward.snapshot, "amount": str(reward.amount),
                           "reviewer_id": str(reward.reviewer_id), "reversed_at": now_cn().isoformat()}]
        reward.status = "reversed"
        reward.revision += 1
        session.add(reward)
    elif reward and reward.status in ("pending", "rejected"):
        reward.status = "reversed"
        session.add(reward)


def protect_reward_plan(session, todo, changes):
    fields = set(changes).intersection({"due_at", "estimated_hours", "priority", "assignee_user_id"})
    if not any(changes[field] != getattr(todo, field) for field in fields):
        return
    reward = reward_for(session, todo)
    if reward and reward.status == "approved":
        raise ValidationException("任务贝利已发放，请先重开任务冲销奖励后再修改计划")
    if reward and "assignee_user_id" in fields:
        reward.user_id = changes["assignee_user_id"]
        session.add(reward)


def approve_reward(session, todo_id, actor, changes, comment=""):
    require_l0(actor)
    todo = session.exec(select(TodoItem).where(TodoItem.id == todo_id).with_for_update().execution_options(populate_existing=True)).first()
    if not todo or todo.status != TodoStatus.DONE:
        raise ValidationException("任务必须先通过待办验收")
    reward = reward_for(session, todo)
    if not reward:
        raise ValidationException("该任务不在本次奖励范围")
    if reward.status == "approved":
        return reward
    if reward.status not in ("pending", "rejected"):
        raise ValidationException("奖励当前不可审核")
    validate_plan(todo, for_reward=True)
    user = lock_user(session, todo.assignee_user_id)
    if not user.manager_user_id:
        raise ValidationException("仅非 L0 员工参与任务贝利奖励")
    if user.basic_salary is None or user.basic_salary <= 0:
        raise ValidationException("请先由管理员补录员工基本工资")
    before = {"due_at": todo.due_at.isoformat() if todo.due_at else None,
              "estimated_hours": str(todo.estimated_hours), "priority": str(todo.priority)}
    for key in ("due_at", "estimated_hours", "priority"):
        if key in changes:
            setattr(todo, key, changes[key])
    validate_plan(todo, for_reward=True)
    if not todo.submitted_at:
        raise ValidationException("缺少最终提交时间，请重新提交验收")
    late_days = max(0, (todo.submitted_at.date() - todo.due_at.date()).days)
    time_factor = [Decimal(x) for x in ("1", ".95", ".9", ".8", ".6", ".5")][min(late_days, 5)]
    priority_factor = PRIORITIES.get(todo.priority)
    if priority_factor is None:
        raise ValidationException("无效重要级")
    amount = money(user.basic_salary / 1000 * Decimal("2.5") * todo.estimated_hours * priority_factor * time_factor)
    reward.amount = amount
    reward.status = "approved"
    reward.reviewer_id = actor.id
    reward.reviewed_at = now_cn()
    reward.comment = comment
    reward.snapshot = {"basic_salary": str(user.basic_salary), "estimated_hours": str(todo.estimated_hours),
                       "due_at": todo.due_at.isoformat(), "priority": str(todo.priority),
                       "submitted_at": todo.submitted_at.isoformat(), "late_days": late_days,
                       "priority_factor": str(priority_factor), "time_factor": str(time_factor),
                       "before": before, "title": todo.title}
    reward.user_id = todo.assignee_user_id
    todo.updated_at = now_cn()
    session.add_all([todo, reward])
    post_entry(session, reward.user_id, amount, f"reward:{reward.id}:{reward.revision}", "task_reward",
               comment or "任务贝利审核通过", actor.id, {"todo_id": str(todo.id), "title": todo.title})
    return reward


def reconcile_attendance(session, day):
    policy = session.exec(select(BeliPolicy).with_for_update()).first()
    if not policy or day < policy.starts_on or day > now_cn().date():
        return
    meetings = session.exec(select(MeetingRecord).where(MeetingRecord.meeting_date == day,
        MeetingRecord.meeting_type == "morning", MeetingRecord.status.in_([
            MeetingStatus.TRANSCRIBED, MeetingStatus.SUMMARIZED, MeetingStatus.ARCHIVED]))).all()
    existing = session.exec(select(MorningAttendance).where(MorningAttendance.day == day)).all()
    if not meetings and not existing:
        return
    all_users = session.exec(select(User)).all()
    rows = {row.user_id: row for row in existing}
    # Historical eligibility and names must survive later employee profile changes.
    roster_names = {user.id: (rows[user.id].employee_name or user.display_name).strip()
                    if user.id in rows else user.display_name.strip() for user in all_users}
    from app.services.meeting_participants import resolve_participants
    present_ids, _ = resolve_participants(session, meetings,
        [user for user in all_users if user.created_at.date() <= day], roster_names)
    leaves = session.exec(select(LeaveRequest).where(LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_at < datetime.combine(day, time(12)),
        LeaveRequest.end_at > datetime.combine(day, time(10)))).all()
    excused = {leave.applicant_user_id for leave in leaves}
    for user in sorted(all_users, key=lambda item: str(item.id)):
        if user.id not in rows and (not user.manager_user_id or user.status != UserStatus.ACTIVE
                                   or user.created_at.date() > day):
            continue
        row = rows.get(user.id) or MorningAttendance(day=day, user_id=user.id)
        row.employee_name = roster_names[user.id]
        present = user.id in present_ids
        row.absent = bool(meetings and is_workday(session, day) and not present and user.id not in excused)
        should_charge = row.absent and not row.waived
        if should_charge != row.charged:
            row.revision += 1
            post_entry(session, user.id, -500 if should_charge else 500,
                       f"attendance:{day}:{user.id}:{row.revision}", "attendance" if should_charge else "attendance_reverse",
                       row.reason or ("早会缺席" if should_charge else "早会考勤更正"),
                       details={"day": day.isoformat()})
            row.charged = should_charge
        session.add(row)
    session.flush()


def order_action(session, order_id, actor, action, comment="", tracking=""):
    order = session.exec(select(BeliOrder).where(BeliOrder.id == order_id).with_for_update().execution_options(populate_existing=True)).first()
    if not order:
        raise NotFoundException("未找到兑换单")
    if action == "cancel" and actor.id == order.user_id and order.status == "pending":
        pass
    else:
        require_l0(actor)
    if action == "approve" and order.status in ("approved", "fulfilled", "shipped"):
        return order
    if action == "reject" and order.status == "rejected" or action == "cancel" and order.status == "cancelled":
        return order
    if action == "ship":
        if order.status == "shipped":
            return order
        if order.status != "approved" or not tracking.strip():
            raise ValidationException("仅待发货实物订单可发货，请填写发货信息")
        order.status = "shipped"
        order.tracking = tracking
    else:
        if action not in ("approve", "reject", "cancel"):
            raise ValidationException("无效操作")
        if order.status != "pending" and not (action == "cancel" and order.status == "approved"):
            raise ValidationException("订单状态不允许此操作")
        _, account = account_for(session, order.user_id)
        product = session.exec(select(BeliProduct).where(BeliProduct.id == order.product_id).with_for_update().execution_options(populate_existing=True)).first()
        if action == "approve":
            if account.balance < account.frozen:
                raise ValidationException("当前余额不足以支付被冻结的兑换，请先处理余额")
            account.frozen = money(account.frozen - order.amount)
            session.add(account)
            session.flush()
            post_entry(session, order.user_id, -order.amount, f"order-pay:{order.id}", "redemption", "兑换审批通过", actor.id)
            snap = order.product_snapshot
            if snap["kind"] == "leave":
                change_leave(session, order.user_id, snap["leave_type"], Decimal(snap["leave_days"]) * order.quantity,
                             f"order-leave:{order.id}", "商城兑换假期", actor.id)
                order.status = "fulfilled"
            else:
                order.status = "approved"
        else:
            if order.status == "pending":
                account.frozen = money(account.frozen - order.amount)
                session.add(account)
            else:
                post_entry(session, order.user_id, order.amount, f"order-refund:{order.id}", "refund", "取消未发货订单", actor.id)
            product.stock += order.quantity
            session.add(product)
            order.status = "rejected" if action == "reject" else "cancelled"
    order.comment = comment
    order.reviewer_id = actor.id
    order.updated_at = now_cn()
    session.add(order)
    return order


def create_order(session, user, product_id, quantity, request_key, delivery):
    if not user.manager_user_id:
        raise ForbiddenException("商城兑换面向非 L0 员工")
    _, account = account_for(session, user.id)
    key = f"{user.id}:{request_key}"
    existing = session.exec(select(BeliOrder).where(BeliOrder.request_key == key)).first()
    if existing:
        if existing.product_id != product_id or existing.quantity != quantity or existing.delivery != delivery:
            raise ValidationException("重复请求标识对应的兑换内容不同")
        return existing
    product = session.exec(select(BeliProduct).where(BeliProduct.id == product_id).with_for_update().execution_options(populate_existing=True)).first()
    if not product or not product.active or product.stock < quantity:
        raise ValidationException("商品已下架或库存不足")
    amount = money(product.price * quantity)
    if account.balance - account.frozen < amount:
        raise ValidationException("可用贝利不足")
    if product.kind == "physical" and not delivery.strip():
        raise ValidationException("请填写实物领取或配送信息")
    product.stock -= quantity
    account.frozen = money(account.frozen + amount)
    order = BeliOrder(user_id=user.id, product_id=product.id, quantity=quantity, amount=amount,
        request_key=key, delivery=delivery, product_snapshot={"name": product.name, "kind": product.kind,
        "leave_type": product.leave_type, "leave_days": str(product.leave_days), "price": str(product.price)})
    session.add_all([product, account, order])
    return order


async def attendance_reconciliation_worker():
    """Retry unfinished reconciliation and settle future-dated records when due."""
    import asyncio
    import logging
    from app.core.database import engine
    logger = logging.getLogger(__name__)
    while True:
        try:
            await asyncio.to_thread(_reconcile_recorded_days, engine)
        except Exception:
            logger.exception("Morning attendance reconciliation failed")
        await asyncio.sleep(300)


def _reconcile_recorded_days(engine):
    with Session(engine) as session:
        policy = session.exec(select(BeliPolicy)).first()
        if not policy:
            return
        days = set(session.exec(select(MeetingRecord.meeting_date).where(
            MeetingRecord.meeting_type == "morning", MeetingRecord.meeting_date >= policy.starts_on,
            MeetingRecord.meeting_date <= now_cn().date(), MeetingRecord.status.in_([
                MeetingStatus.TRANSCRIBED, MeetingStatus.SUMMARIZED, MeetingStatus.ARCHIVED]))).all())
        days.update(session.exec(select(MorningAttendance.day).distinct()).all())
        for day in sorted(days):
            reconcile_attendance(session, day)
            session.commit()
