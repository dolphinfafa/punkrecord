"""Isolated regressions for task rewards, attendance and store transactions."""
import asyncio
from datetime import datetime, timedelta, date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select
from app import models  # noqa: F401
from app.main import app
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_session
from app.core.exceptions import ValidationException, ForbiddenException
from app.models.base import now_cn
from app.models.iam import User, OurEntity, OurEntityType, OurEntityStatus, Role, UserRole
from app.models.project import Project, ProjectType, ProjectStatus
from app.models.todo import TodoItem, TodoSourceType, TodoActionType, TodoStatus, LeaveRequest, LeaveType, LeaveStatus
from app.models.meeting import MeetingRecord, MeetingStatus
from app.models.beli import BeliPolicy, BeliAccount, BeliLedger, TaskReward, BeliProduct, BeliOrder, MorningAttendance, WorkdayOverride
from app.services.beli import (account_for, post_entry, queue_reward, approve_reward, reverse_reward,
    protect_reward_plan, reconcile_attendance, create_order, order_action, change_leave, is_workday)
from app.api.beli import safe_reward
from app.schemas.todo import TodoCreate


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        boss = User(display_name="Boss", username="boss", profile_completed=True, must_change_password=False)
        session.add(boss); session.flush()
        employee = User(display_name="Employee", username="employee", manager_user_id=boss.id,
                        basic_salary=Decimal("12000"), beili_balance=2000, profile_completed=True, must_change_password=False,
                        created_at=datetime(2020, 1, 1))
        other = User(display_name="Other", username="other", manager_user_id=boss.id, created_at=datetime(2020, 1, 1))
        entity = OurEntity(name="Test Entity", type=OurEntityType.COMPANY, status=OurEntityStatus.ACTIVE)
        policy = BeliPolicy(starts_on=date(2020, 1, 1), hours_rule_starts_at=datetime(2020, 1, 1))
        session.add_all([employee, other, entity, policy]); session.commit()
        actor = [boss]
        app.dependency_overrides[get_session] = lambda: session
        app.dependency_overrides[get_current_user] = lambda: actor[0]
        monkeypatch.setattr(settings, "ENFORCE_RBAC", False)
        # Notifications must never call real external services in tests.
        monkeypatch.setattr(settings, "WECHAT_MSG_SERVICE_URL", None)
        yield session, boss, employee, other, entity, actor, TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()
    engine.dispose()


def task(db, **overrides):
    session, boss, employee, _, entity, *_ = db
    data = dict(our_entity_id=entity.id, assignee_user_id=employee.id, creator_user_id=boss.id,
                title="Task", source_type=TodoSourceType.CUSTOM, source_id=str(uuid4()), action_type=TodoActionType.DO,
                status=TodoStatus.DONE, due_at=datetime(2026, 10, 5, 18), submitted_at=datetime(2026, 10, 5, 17),
                done_at=now_cn(), estimated_hours=Decimal("8"), priority="p2")
    data.update(overrides)
    todo = TodoItem(**data); session.add(todo); session.flush(); queue_reward(session, todo); session.commit()
    return todo


@pytest.mark.parametrize("priority,factor", [("p0", "1.2"), ("p1", "1"), ("p2", "1"), ("p3", ".8")])
@pytest.mark.parametrize("days,factor_time", [(0, "1"), (1, ".95"), (2, ".9"), (3, ".8"), (4, ".6"), (5, ".5"), (8, ".5")])
def test_reward_formula_boundaries(db, priority, factor, days, factor_time):
    session, boss, employee, *_ = db
    todo = task(db, priority=priority, submitted_at=datetime(2026, 10, 5, 17) + timedelta(days=days))
    reward = approve_reward(session, todo.id, boss, {})
    session.commit()
    expected = (Decimal(30) * 8 * Decimal(factor) * Decimal(factor_time)).quantize(Decimal(".01"))
    assert reward.amount == expected
    assert account_for(session, employee.id)[1].balance == 2000 + expected


def test_independent_review_edits_and_idempotency(db):
    session, boss, employee, *_ = db
    todo = task(db)
    assert account_for(session, employee.id)[1].balance == 2000
    reward = approve_reward(session, todo.id, boss, {"estimated_hours": Decimal("2"), "priority": "p0"})
    session.commit()
    assert reward.amount == 72
    assert todo.estimated_hours == 2 and todo.priority == "p0"
    assert Decimal(reward.snapshot["before"]["estimated_hours"]) == 8
    approve_reward(session, todo.id, boss, {}); session.commit()
    assert len(session.exec(select(BeliLedger).where(BeliLedger.kind == "task_reward")).all()) == 1
    public = safe_reward(reward, session)
    assert "snapshot" not in public and "basic_salary" not in public and "priority_factor" not in public
    with pytest.raises(ValidationException):
        protect_reward_plan(session, todo, {"estimated_hours": 100})
    reverse_reward(session, todo, boss.id, "重开"); session.commit()
    assert account_for(session, employee.id)[1].balance == 2000
    reverse_reward(session, todo, boss.id, "重开"); session.commit()
    queue_reward(session, todo); session.commit()
    approve_reward(session, todo.id, boss, {}); session.commit()
    assert account_for(session, employee.id)[1].balance == 2072


def test_rewarded_task_metadata_edits_and_pending_assignee_sync(db):
    session, boss, employee, other, entity, actor, client = db
    todo = task(db)
    payload = {'title': 'Renamed task', 'estimated_hours': 8, 'priority': 'p2',
               'due_at': todo.due_at.isoformat(), 'assignee_user_id': str(employee.id)}
    approve_reward(session, todo.id, boss, {}); session.commit()
    assert client.patch(f'/api/v1/todo/{todo.id}', json=payload).status_code == 200
    assert todo.title == 'Renamed task'
    assert client.patch(f'/api/v1/todo/{todo.id}', json={'estimated_hours': 10}).status_code == 400
    second = task(db, title='Reassigned task')
    assert client.patch(f'/api/v1/todo/{second.id}', json={'assignee_user_id': str(other.id)}).status_code == 200
    reward = session.exec(select(TaskReward).where(TaskReward.todo_id == second.id)).first()
    assert reward.user_id == other.id


def test_reward_requires_completion_salary_and_l0(db):
    session, boss, employee, *_ = db
    todo = task(db, status=TodoStatus.PENDING_REVIEW)
    with pytest.raises(ValidationException): approve_reward(session, todo.id, boss, {})
    with pytest.raises(ForbiddenException): approve_reward(session, todo.id, employee, {})
    todo.status = TodoStatus.DONE; employee.basic_salary = None; session.add_all([todo, employee])
    queue_reward(session, todo); session.commit()
    with pytest.raises(ValidationException): approve_reward(session, todo.id, boss, {})


def test_task_required_fields_and_lifecycle(db):
    session, boss, employee, _, entity, actor, client = db
    payload = {"title": "New", "assignee_user_id": str(employee.id), "our_entity_id": str(entity.id)}
    assert client.post('/api/v1/todo', json=payload).status_code == 422
    payload.update(due_at="2026-10-16T18:00:00", estimated_hours=0)
    assert client.post('/api/v1/todo', json=payload).status_code == 200
    payload['estimated_hours'] = 1.5
    resp = client.post('/api/v1/todo', json=payload)
    assert resp.status_code == 200, resp.text
    todo_id = resp.json()['data']['id']
    actor[0] = employee
    assert client.post(f'/api/v1/todo/{todo_id}/submit').status_code == 200
    todo = session.get(TodoItem, todo_id)
    assert todo.status == TodoStatus.PENDING_REVIEW and todo.submitted_at
    submitted = todo.submitted_at
    actor[0] = boss
    assert client.post(f'/api/v1/todo/{todo_id}/approve').status_code == 200
    assert todo.submitted_at == submitted
    assert account_for(session, employee.id)[1].balance == 2000
    assert client.patch(f'/api/v1/todo/{todo_id}', json={"estimated_hours": None}).status_code == 400


@pytest.mark.parametrize('hours', [None, 0, 1.25])
@pytest.mark.parametrize('kind', ['custom', 'project', 'bug'])
def test_task_creation_defaults_hours_across_sources(db, hours, kind):
    session, boss, employee, _, entity, actor, client = db
    payload = {'title': 'Default hours', 'assignee_user_id': str(employee.id), 'due_at': '2026-10-20T18:00:00'}
    if kind != 'custom':
        project = make_project(db)
        payload.update(source_type='project_task', source_id=str(project.id), link={'project_id': str(project.id)})
    if kind == 'bug':
        payload.update(tags=['bug'], link={**payload['link'], 'type': 'bug'})
    if hours is not None:
        payload['estimated_hours'] = hours
    response = client.post('/api/v1/todo', json=payload)
    assert response.status_code == 200, response.text
    todo = session.get(TodoItem, response.json()['data']['id'])
    assert todo.estimated_hours == Decimal(str(hours or 0))
    assert not session.exec(select(TaskReward)).all()


@pytest.mark.parametrize('self_created', [False, True])
def test_zero_hours_completion_then_backfill_is_independent_and_idempotent(db, self_created):
    session, boss, employee, _, entity, actor, client = db
    actor[0] = employee if self_created else boss
    response = client.post('/api/v1/todo', json={'title': 'Zero hours', 'assignee_user_id': str(employee.id),
                                               'due_at': (now_cn() + timedelta(days=1)).isoformat()})
    todo_id = response.json()['data']['id']
    actor[0] = employee
    assert client.post(f'/api/v1/todo/{todo_id}/submit').status_code == 200
    actor[0] = boss
    if not self_created:
        assert client.post(f'/api/v1/todo/{todo_id}/approve').status_code == 200
    todo = session.get(TodoItem, todo_id)
    assert todo.status == TodoStatus.DONE
    assert not session.exec(select(TaskReward)).all()
    assert client.post(f'/api/v1/beli/rewards/{todo_id}/review', json={'action': 'approve', 'estimated_hours': 2}).status_code == 400
    for _ in range(2):
        assert client.patch(f'/api/v1/todo/{todo_id}', json={'estimated_hours': 2}).status_code == 200
    rewards = session.exec(select(TaskReward)).all()
    assert len(rewards) == 1 and rewards[0].status == 'pending'
    assert account_for(session, employee.id)[1].balance == 2000
    for _ in range(2):
        assert client.post(f'/api/v1/beli/rewards/{todo_id}/review', json={'action': 'approve'}).status_code == 200
    assert account_for(session, employee.id)[1].balance == 2060
    assert client.patch(f'/api/v1/todo/{todo_id}', json={'estimated_hours': 0}).status_code == 400


@pytest.mark.parametrize('previous_status', ['pending', 'rejected'])
def test_zero_hours_excludes_unpaid_reward_and_preserves_review(db, previous_status):
    session, boss, employee, _, entity, actor, client = db
    todo = task(db)
    reward = session.exec(select(TaskReward)).one()
    reward.status, reward.comment = previous_status, 'Original review'
    reward.reviewer_id, reward.reviewed_at = boss.id, now_cn()
    session.add(reward); session.commit()
    assert client.patch(f'/api/v1/todo/{todo.id}', json={'estimated_hours': 0}).status_code == 200
    assert reward.status == 'excluded' and reward.comment == 'Original review'
    assert reward.history[-1]['status'] == previous_status
    assert reward.history[-1]['comment'] == 'Original review'
    assert todo.status == TodoStatus.DONE
    assert client.get('/api/v1/beli/rewards', params={'status': 'pending'}).json()['data'] == []
    assert client.get('/api/v1/beli/rewards').json()['data'][0]['status'] == 'excluded'
    for action in ('approve', 'reject'):
        assert client.post(f'/api/v1/beli/rewards/{todo.id}/review', json={
            'action': action, 'comment': 'Stale request', 'estimated_hours': 1}).status_code == 400
    assert account_for(session, employee.id)[1].balance == 2000
    assert client.patch(f'/api/v1/todo/{todo.id}', json={'estimated_hours': 1.5}).status_code == 200
    assert reward.status == 'pending' and reward.comment is None and reward.reviewer_id is None
    assert len(session.exec(select(TaskReward)).all()) == 1 and len(reward.history) == 1
    assert client.post(f'/api/v1/beli/rewards/{todo.id}/review', json={'action': 'approve'}).status_code == 200
    assert account_for(session, employee.id)[1].balance == 2045


@pytest.mark.parametrize('missing_submission', [False, True])
def test_historical_completed_task_backfill_is_not_retroactive(db, missing_submission):
    session, boss, employee, _, entity, actor, client = db
    policy = session.exec(select(BeliPolicy)).one()
    policy.hours_rule_starts_at = datetime(2026, 10, 16, 12)
    session.add(policy); session.commit()
    todo = task(db, estimated_hours=0, done_at=datetime(2026, 10, 16, 11),
                submitted_at=None if missing_submission else datetime(2026, 10, 16, 10))
    assert client.patch(f'/api/v1/todo/{todo.id}', json={'estimated_hours': 2}).status_code == 200
    assert not session.exec(select(TaskReward)).all()


def test_no_policy_backfill_fails_closed_and_pending_completion_does_not_queue(db):
    session, boss, employee, _, entity, actor, client = db
    todo = task(db, status=TodoStatus.PENDING_REVIEW, estimated_hours=0)
    assert client.patch(f'/api/v1/todo/{todo.id}', json={'estimated_hours': 2}).status_code == 200
    assert not session.exec(select(TaskReward)).all()
    assert client.post(f'/api/v1/todo/{todo.id}/approve').status_code == 200
    assert session.exec(select(TaskReward)).one().status == 'pending'
    policy = session.exec(select(BeliPolicy)).one()
    policy.hours_rule_starts_at = None; session.add(policy); session.commit()
    second = task(db, estimated_hours=0)
    assert client.patch(f'/api/v1/todo/{second.id}', json={'estimated_hours': 1}).status_code == 200
    assert len(session.exec(select(TaskReward)).all()) == 1


@pytest.mark.parametrize('bad_hours', [-1, None, 0.001, 'NaN', 'Infinity'])
def test_task_creation_rejects_invalid_hours(db, bad_hours):
    session, boss, employee, other, entity, actor, client = db
    assert client.post('/api/v1/todo', json={'title': 'Invalid', 'assignee_user_id': str(employee.id),
        'due_at': '2026-10-20T18:00:00', 'estimated_hours': bad_hours}).status_code == 422


def meeting(session, boss, day=date(2026, 10, 15), attendees=None):
    row = MeetingRecord(title="Morning", meeting_type="morning", meeting_date=day,
                        created_by=boss.id, status=MeetingStatus.TRANSCRIBED, attendees=attendees or [])
    session.add(row); session.flush()
    return row


def test_attendance_automatic_once_correction_and_waiver(db):
    session, boss, employee, other, *_ = db
    day = date(2026, 10, 15)
    row = meeting(session, boss, day, [employee.display_name])
    reconcile_attendance(session, day); session.commit()
    assert account_for(session, employee.id)[1].balance == 2000
    assert account_for(session, other.id)[1].balance == -500
    meeting(session, boss, day, [employee.display_name]); reconcile_attendance(session, day); session.commit()
    assert account_for(session, other.id)[1].balance == -500
    row.attendees = [employee.display_name, other.display_name]; session.add(row); session.flush()
    reconcile_attendance(session, day); session.commit()
    assert account_for(session, other.id)[1].balance == 0
    row.attendees = []; session.add(row); session.flush(); reconcile_attendance(session, day); session.commit()
    absence = session.exec(select(MorningAttendance).where(MorningAttendance.user_id == other.id)).first()
    absence.waived = True; absence.reason = "外出"; session.add(absence); session.flush()
    reconcile_attendance(session, day); session.commit()
    reconcile_attendance(session, day); session.commit()
    assert account_for(session, other.id)[1].balance == 0


def test_calendar_leave_and_no_record_exemption(db):
    session, boss, employee, other, entity, *_ = db
    day = date(2026, 10, 15)
    reconcile_attendance(session, day); session.commit()
    assert not session.exec(select(MorningAttendance)).all()
    meeting(session, boss, day)
    leave = LeaveRequest(applicant_user_id=employee.id, our_entity_id=entity.id, leave_type=LeaveType.ANNUAL,
        status=LeaveStatus.APPROVED, start_at=datetime(2026, 10, 15, 10), end_at=datetime(2026, 10, 15, 12))
    session.add(leave); session.flush(); reconcile_attendance(session, day); session.commit()
    assert account_for(session, employee.id)[1].balance == 2000
    assert account_for(session, other.id)[1].balance == -500
    session.add(WorkdayOverride(day=day, is_workday=False, reason="假日")); session.flush()
    reconcile_attendance(session, day); session.commit()
    assert account_for(session, other.id)[1].balance == 0
    sunday = date(2026, 10, 11)
    assert not is_workday(session, sunday)
    session.add(WorkdayOverride(day=sunday, is_workday=True, reason="调休")); session.flush()
    assert is_workday(session, sunday)


def product(session, **overrides):
    data = dict(name="Vacation", kind="leave", price=Decimal("300"), stock=2, leave_type="annual", leave_days=Decimal(".5"))
    data.update(overrides)
    row = BeliProduct(**data); session.add(row); session.commit()
    return row


def test_store_freeze_approval_leave_and_idempotency(db):
    session, boss, employee, *_ = db
    item = product(session)
    order = create_order(session, employee, item.id, 2, "test", ""); session.commit()
    account = account_for(session, employee.id)[1]
    assert account.balance == 2000 and account.frozen == 600 and item.stock == 0
    duplicate = create_order(session, employee, item.id, 2, "test", ""); session.commit()
    assert duplicate.id == order.id and account.frozen == 600
    order_action(session, order.id, boss, "approve"); session.commit()
    order_action(session, order.id, boss, "approve"); session.commit()
    assert account_for(session, employee.id)[1].balance == 1400
    assert employee.leave_annual_remaining == 6
    assert order.status == "fulfilled"


@pytest.mark.parametrize('action', ['reject', 'cancel'])
def test_store_release_and_physical_refund(db, action):
    session, boss, employee, *_ = db
    item = product(session, kind="physical")
    order = create_order(session, employee, item.id, 1, str(uuid4()), "自提"); session.commit()
    order_action(session, order.id, boss, action); session.commit()
    assert account_for(session, employee.id)[1].frozen == 0 and item.stock == 2
    order = create_order(session, employee, item.id, 1, str(uuid4()), "自提"); session.commit()
    order_action(session, order.id, boss, "approve"); session.commit()
    order_action(session, order.id, boss, "cancel"); session.commit()
    order_action(session, order.id, boss, "cancel"); session.commit()
    assert account_for(session, employee.id)[1].balance == 2000 and item.stock == 2


def test_no_overspend_or_unauthorized_read(db):
    session, boss, employee, other, entity, actor, client = db
    item = product(session, price=Decimal("1500"))
    create_order(session, employee, item.id, 1, "one", ""); session.commit()
    with pytest.raises(ValidationException): create_order(session, employee, item.id, 1, "two", "")
    actor[0] = other
    assert client.get('/api/v1/beli/ledger', params={'user_id': str(employee.id)}).status_code == 404
    assert client.get(f'/api/v1/iam/users/{employee.id}/salary').status_code == 403
    assert client.post('/api/v1/beli/products', json={"name":"X", "kind":"physical", "price":1, "stock":2}).status_code == 403
    assert all(r['user_id'] == str(other.id) for r in client.get('/api/v1/beli/accounts').json()['data']['items'])


def test_leave_decoupled_from_todo(db):
    session, boss, employee, _, entity, actor, client = db
    actor[0] = employee
    resp = client.post('/api/v1/todo/leaves', json={"leave_type":"annual", "start_at":"2026-10-16T10:00:00", "end_at":"2026-10-16T12:00:00"})
    assert resp.status_code == 200, resp.text
    leave_id = resp.json()['data']['id']
    assert not session.exec(select(TodoItem)).all()
    actor[0] = boss
    assert client.post(f'/api/v1/todo/leaves/{leave_id}/approve').status_code == 200
    assert not session.exec(select(TodoItem)).all()
    assert employee.leave_annual_remaining == 4.5
    assert len(session.exec(select(BeliLedger).where(BeliLedger.kind == 'leave')).all()) == 1


def make_project(db):
    session, boss, _, _, entity, *_ = db
    row = Project(our_entity_id=entity.id, project_no=str(uuid4()), name="Project", project_type=ProjectType.B2B,
                  owner_user_id=boss.id, pm_user_id=boss.id, current_stage_code="development")
    session.add(row); session.commit()
    return row


@pytest.mark.parametrize('hours', [None, 0, 1.25])
def test_generate_development_tasks_defaults_hours(db, hours):
    session, boss, employee, _, entity, actor, client = db
    row = make_project(db)
    payload = {'title': 'Generated', 'assignee_user_id': str(employee.id), 'due_at': '2026-10-20T18:00:00'}
    if hours is not None:
        payload['estimated_hours'] = hours
    response = client.post(f'/api/v1/project/projects/{row.id}/generate-dev-tasks', json={'tasks': [payload]})
    assert response.status_code == 200, response.text
    todo = session.exec(select(TodoItem)).one()
    assert todo.estimated_hours == Decimal(str(hours or 0))
    assert not session.exec(select(TaskReward)).all()


def test_sync_feature_tasks_defaults_hours(db, monkeypatch):
    from app.api import project as api
    session, boss, *_ = db
    row = make_project(db)
    monkeypatch.setattr(api, '_extract_feature_list_for_project', lambda *args: ([{'l1_feature': 'Feature'}], None))
    plan = api.SyncTaskPlan(due_at='2026-10-20T18:00:00')
    asyncio.run(api.sync_dev_tasks_from_feature_list(row.id, plan, session, boss))
    todo = session.exec(select(TodoItem)).one()
    assert todo.estimated_hours == 0
    assert not session.exec(select(TaskReward)).all()


def test_project_plan_edit_uses_shared_reward_eligibility(db):
    session, boss, employee, _, entity, actor, client = db
    row = make_project(db)
    todo = task(db, source_type=TodoSourceType.PROJECT_TASK, source_id=str(row.id), estimated_hours=0)
    route = f'/api/v1/project/projects/{row.id}/todos/{todo.id}/plan'
    assert client.post(route, json={'estimated_hours': 2}).status_code == 200
    reward = session.exec(select(TaskReward)).one()
    assert reward.status == 'pending'
    assert client.post(route, json={'estimated_hours': 0}).status_code == 200
    assert reward.status == 'excluded'
    assert client.post(route, json={'estimated_hours': None}).status_code == 400
    assert client.post(route, json={'estimated_hours': -1}).status_code == 422


def test_project_sync_preserves_identity_bug_and_reward(db, monkeypatch):
    from app.api import project as api
    session, boss, employee, *_ = db
    row = make_project(db)
    monkeypatch.setattr(api, '_extract_feature_list_for_project', lambda *args: ([{"l1_feature":"Feature"}], None))
    plan = api.SyncTaskPlan(due_at="2026-10-16T18:00:00", estimated_hours=2)
    asyncio.run(api.sync_dev_tasks_from_feature_list(row.id, plan, session, boss))
    todo = session.exec(select(TodoItem)).first()
    original_id = todo.id
    todo.status = TodoStatus.IN_PROGRESS; todo.link = {**todo.link, "todo_images": [{"id":"screenshot"}]}
    session.add(todo); session.commit()
    bug = task(db, source_type=TodoSourceType.PROJECT_TASK, source_id=str(row.id), tags=['bug'], link={'type':'bug'}, title='Shared Bug')
    response = asyncio.run(api.sync_dev_tasks_from_feature_list(row.id, plan, session, boss))
    assert response['data']['created'] == 0
    assert session.get(TodoItem, original_id).status == TodoStatus.IN_PROGRESS
    assert session.get(TodoItem, original_id).link['todo_images'][0]['id'] == 'screenshot'
    assert session.get(TodoItem, bug.id)


def test_bug_title_query_pagination_and_literal_characters(db):
    session, boss, employee, _, entity, actor, client = db
    row = make_project(db)
    for title in ['Shared API', 'shared UI', 'Other', '100% Bug']:
        task(db, source_type=TodoSourceType.PROJECT_TASK, source_id=str(row.id), title=title, tags=['bug'], link={'type':'bug'})
    response = client.get(f'/api/v1/project/projects/{row.id}/bugs', params={'title':'shared', 'page_size':1})
    assert response.status_code == 200, response.text
    assert response.json()['data']['total'] == 2
    assert len(response.json()['data']['items']) == 1
    assert client.get(f'/api/v1/project/projects/{row.id}/bugs', params={'title':'%'}).json()['data']['total'] == 1


def test_salary_admin_only_and_public_serialization(db):
    session, boss, employee, other, entity, actor, client = db
    role = Role(code='admin', name='Admin'); session.add(role); session.flush()
    from app.models.iam import ScopeType
    session.add(UserRole(user_id=boss.id, role_id=role.id, scope_type=ScopeType.GLOBAL)); session.commit()
    assert client.put(f'/api/v1/iam/users/{employee.id}/salary', json={'basic_salary':13000}).status_code == 200
    assert 'basic_salary' not in client.get(f'/api/v1/iam/users/{employee.id}').json()['data']
    actor[0] = employee
    assert client.get(f'/api/v1/iam/users/{employee.id}/salary').status_code == 403
    assert client.put(f'/api/v1/iam/users/{employee.id}/salary', json={'basic_salary':99999}).status_code == 403


def test_legacy_leave_hidden_and_mandatory_backfill(db):
    session, boss, employee, other, entity, actor, client = db
    legacy = task(db, source_type=TodoSourceType.APPROVAL_STEP, status=TodoStatus.PENDING_REVIEW,
                  action_type=TodoActionType.APPROVE, link={'leave_id':str(uuid4())})
    actor[0] = employee
    assert not client.get('/api/v1/todo/my').json()['data']['items']
    incomplete = task(db, status=TodoStatus.OPEN, due_at=None, estimated_hours=None)
    assert client.post(f'/api/v1/todo/{incomplete.id}/submit').status_code == 400
    assert client.patch(f'/api/v1/todo/{incomplete.id}', json={'due_at':'2026-10-16T18:00:00','estimated_hours':1}).status_code == 200
    assert client.post(f'/api/v1/todo/{incomplete.id}/submit').status_code == 200


def test_timezone_and_precision_validation():
    from pydantic import ValidationError
    payload = dict(title='Task', assignee_user_id=uuid4(), estimated_hours=1, due_at='2026-10-16T17:00:00Z')
    assert TodoCreate(**payload).due_at == datetime(2026, 10, 17, 1)
    with pytest.raises(ValidationError): TodoCreate(**{**payload, 'estimated_hours':0.001})
    from app.schemas.todo import LeaveRequestCreate
    leave = LeaveRequestCreate(leave_type='annual', start_at='2026-10-16T02:00:00Z', end_at='2026-10-16T04:00:00Z')
    assert leave.start_at == datetime(2026, 10, 16, 10)


def test_historical_completed_and_duplicate_names_are_not_assumed(db):
    session, boss, employee, other, *_ = db
    policy = session.exec(select(BeliPolicy)).first()
    policy.starts_on = date(2026, 10, 15); session.add(policy); session.commit()
    task(db, done_at=datetime(2026, 10, 14, 18))
    assert not session.exec(select(TaskReward)).all()
    other.display_name = employee.display_name; session.add(other)
    meeting(session, boss, attendees=[employee.display_name]); session.flush()
    reconcile_attendance(session, date(2026, 10, 15)); session.commit()
    assert account_for(session, employee.id)[1].balance == 1500
    assert account_for(session, other.id)[1].balance == -500


@pytest.mark.parametrize('action,payload', [
    ('start', {}), ('submit', {}), ('done', {}), ('approve', {}),
    ('reject', {'comment': '拒绝'}), ('block', {'blocked_reason': '阻塞'}),
    ('dismiss', {'dismiss_reason': '取消'}), ('status', {'status': 'in_progress'}),
])
def test_legacy_leave_task_cannot_drive_workflows(db, action, payload):
    session, boss, employee, _, entity, actor, client = db
    leave = LeaveRequest(applicant_user_id=employee.id, our_entity_id=entity.id, leave_type=LeaveType.ANNUAL,
        status=LeaveStatus.PENDING, start_at=datetime(2026, 10, 15, 10), end_at=datetime(2026, 10, 15, 12))
    session.add(leave); session.flush()
    legacy = task(db, status=TodoStatus.PENDING_REVIEW, action_type=TodoActionType.APPROVE,
                  source_type=TodoSourceType.APPROVAL_STEP, source_id=str(leave.id), link={'leave_id': str(leave.id)})
    assert client.post(f'/api/v1/todo/{legacy.id}/{action}', json=payload).status_code == 400
    session.refresh(leave); session.refresh(legacy)
    assert leave.status == LeaveStatus.PENDING and legacy.status == TodoStatus.PENDING_REVIEW
    assert employee.leave_annual_remaining == 5
    assert not session.exec(select(TaskReward)).all()


def test_self_created_task_still_needs_independent_reward_review(db):
    session, boss, employee, _, entity, actor, client = db
    actor[0] = employee
    result = client.post('/api/v1/todo', json={'title': 'Self task', 'assignee_user_id': str(employee.id),
        'our_entity_id': str(entity.id), 'due_at': (now_cn() + timedelta(days=1)).isoformat(), 'estimated_hours': 2})
    todo_id = result.json()['data']['id']
    assert client.post(f'/api/v1/todo/{todo_id}/submit').status_code == 200
    assert session.get(TodoItem, todo_id).status == TodoStatus.DONE
    assert account_for(session, employee.id)[1].balance == 2000
    assert client.post(f'/api/v1/beli/rewards/{todo_id}/review', json={'action': 'approve'}).status_code == 403
    actor[0] = boss
    assert client.post(f'/api/v1/beli/rewards/{todo_id}/review', json={'action': 'approve'}).status_code == 200
    assert account_for(session, employee.id)[1].balance == 2060


def test_attendance_afternoon_leave_late_approval_and_delete_correction(db):
    session, boss, employee, _, entity, actor, client = db
    day = date(2026, 10, 15)
    row = meeting(session, boss, day)
    afternoon = LeaveRequest(applicant_user_id=employee.id, our_entity_id=entity.id, leave_type=LeaveType.ANNUAL,
        status=LeaveStatus.APPROVED, start_at=datetime(2026, 10, 15, 14), end_at=datetime(2026, 10, 15, 19))
    session.add(afternoon); session.flush(); reconcile_attendance(session, day); session.commit()
    assert account_for(session, employee.id)[1].balance == 1500
    morning = LeaveRequest(applicant_user_id=employee.id, our_entity_id=entity.id, leave_type=LeaveType.ANNUAL,
        status=LeaveStatus.PENDING, start_at=datetime(2026, 10, 15, 10), end_at=datetime(2026, 10, 15, 12))
    session.add(morning); session.commit()
    assert client.post(f'/api/v1/todo/leaves/{morning.id}/approve').status_code == 200
    assert account_for(session, employee.id)[1].balance == 2000
    assert employee.leave_annual_remaining == 4.5
    session.delete(row); session.flush(); reconcile_attendance(session, day); session.commit()
    assert all(not absence.charged for absence in session.exec(select(MorningAttendance)).all())


def test_attendance_activation_and_same_day_union(db):
    session, boss, employee, other, *_ = db
    policy = session.exec(select(BeliPolicy)).first()
    policy.starts_on = date(2026, 10, 15); session.add(policy); session.flush()
    meeting(session, boss, date(2026, 10, 14)); reconcile_attendance(session, date(2026, 10, 14)); session.commit()
    assert not session.exec(select(MorningAttendance)).all()
    meeting(session, boss, attendees=[employee.display_name])
    meeting(session, boss, attendees=[other.display_name])
    reconcile_attendance(session, date(2026, 10, 15)); session.commit()
    assert account_for(session, employee.id)[1].balance == 2000
    assert account_for(session, other.id)[1].balance == 0


def test_attendance_profile_changes_do_not_rewrite_historical_roster(db):
    from app.models.iam import UserStatus
    session, boss, employee, other, *_ = db
    day = date(2026, 10, 15)
    meeting(session, boss, day, [employee.display_name])
    reconcile_attendance(session, day); session.commit()
    employee.display_name = 'Renamed'
    other.status = UserStatus.INACTIVE
    other.manager_user_id = None
    session.add_all([employee, other]); session.commit()
    reconcile_attendance(session, day); session.commit()
    assert account_for(session, employee.id)[1].balance == 2000
    assert account_for(session, other.id)[1].balance == -500


def test_store_shipped_cannot_refund_and_balance_loss_blocks_payment(db):
    session, boss, employee, *_ = db
    item = product(session, kind='physical', price=1500)
    order = create_order(session, employee, item.id, 1, str(uuid4()), '自提'); session.commit()
    post_entry(session, employee.id, -1000, 'test-deduction', 'manual', '测试扣款', boss.id); session.commit()
    with pytest.raises(ValidationException, match='余额不足'):
        order_action(session, order.id, boss, 'approve')
    session.rollback()
    assert order.status == 'pending' and account_for(session, employee.id)[1].frozen == 1500
    post_entry(session, employee.id, 1000, 'test-refill', 'manual', '测试调整', boss.id); session.commit()
    order_action(session, order.id, boss, 'approve'); session.commit()
    order_action(session, order.id, boss, 'ship', tracking='自提签收'); session.commit()
    order_action(session, order.id, boss, 'ship', tracking='自提签收'); session.commit()
    with pytest.raises(ValidationException): order_action(session, order.id, boss, 'cancel')
    session.rollback()
    assert order.status == 'shipped' and account_for(session, employee.id)[1].balance == 500


def test_product_image_upload_download_permissions(db, monkeypatch):
    import base64
    from app.api import beli as api
    session, boss, employee, _, entity, actor, client = db
    item = product(session)
    storage = {}
    monkeypatch.setattr(api, 'save_file', lambda directory, name, content, mime: storage.update({name: content}))
    monkeypatch.setattr(api, 'get_file', lambda directory, name: (storage[name], ''))
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
    url = f'/api/v1/beli/products/{item.id}/image'
    assert client.post(url, files={'file': ('image.png', b'not an image', 'image/png')}).status_code == 400
    assert client.post(url, files={'file': ('image.png', png, 'image/png')}).status_code == 200
    actor[0] = employee
    image = client.get(url)
    assert image.status_code == 200 and image.content == png and image.headers['content-type'] == 'image/png'
    assert client.post(url, files={'file': ('image.png', png, 'image/png')}).status_code == 403
    item.active = False; session.add(item); session.commit()
    assert client.get(url).status_code == 404


def test_reject_reward_keeps_task_done_and_salary_private(db):
    session, boss, employee, _, entity, actor, client = db
    todo = task(db)
    assert client.get(f'/api/v1/iam/users/{employee.id}/salary').status_code == 403
    response = client.post(f'/api/v1/beli/rewards/{todo.id}/review', json={'action': 'reject', 'comment': '请补充说明'})
    assert response.status_code == 200
    assert todo.status == TodoStatus.DONE
    assert account_for(session, employee.id)[1].balance == 2000
    assert all(word not in client.get('/api/v1/beli/rewards').text for word in ('basic_salary', 'snapshot', 'factor'))


def test_adjustments_are_audited_idempotent_and_legacy_writes_blocked(db):
    session, boss, employee, _, entity, actor, client = db
    url = f'/api/v1/beli/accounts/{employee.id}/adjust'
    payload = {'amount': -20, 'reason': '更正', 'request_key': str(uuid4())}
    assert client.post(url, json=payload).status_code == 200
    assert client.post(url, json=payload).status_code == 200
    assert client.post(url, json={**payload, 'amount': -21}).status_code == 400
    assert account_for(session, employee.id)[1].balance == 1980
    assert client.patch(f'/api/v1/iam/users/{employee.id}', json={'beili_adjust_action': 'add', 'beili_adjust_amount': 500}).status_code == 400
    assert client.post(f'/api/v1/iam/users/{employee.id}/reset-leave-balances').status_code == 400
    assert client.post('/api/v1/iam/users/reset-leave-balances').status_code == 400
    assert account_for(session, employee.id)[1].balance == 1980


def test_historical_pending_review_requires_explicit_resubmission(db):
    session, boss, employee, _, entity, actor, client = db
    todo = task(db, status=TodoStatus.PENDING_REVIEW, submitted_at=None)
    assert client.post(f'/api/v1/todo/{todo.id}/approve').status_code == 400
    session.refresh(todo)
    assert todo.status == TodoStatus.PENDING_REVIEW
    actor[0] = employee
    assert client.post(f'/api/v1/todo/{todo.id}/status', json={'status': 'in_progress'}).status_code == 200
    assert client.post(f'/api/v1/todo/{todo.id}/submit').status_code == 200
    actor[0] = boss
    assert client.post(f'/api/v1/todo/{todo.id}/approve').status_code == 200
    assert todo.submitted_at and todo.status == TodoStatus.DONE
