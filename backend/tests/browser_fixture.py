"""Local-only, ephemeral browser fixtures. No development/production DB writes.

Run from backend: punkrecord-python -m tests.browser_fixture (or this file).
"""
import os
import base64
import sys
import tempfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlmodel import SQLModel, Session, create_engine
from app import models
from app.api import auth, iam, todo, project, beli, meeting
from app.core.config import settings
from app.core.database import get_session
from app.core.exceptions import AtlasException
from app.core.security import create_access_token
from app.models.iam import User, UserStatus, Role, UserRole, ScopeType, Permission, RolePermission, OurEntity, OurEntityType, OurEntityStatus
from app.models.project import Project, ProjectType, ProjectMember
from app.models.todo import TodoItem, TodoStatus
from app.models.beli import BeliPolicy, BeliProduct
from app.models.meeting import MeetingRecord, MeetingStatus, MeetingTranscriptSegment
from app.models.base import now_cn
from app.services.beli import queue_reward, account_for

temporary = tempfile.TemporaryDirectory(prefix="punkrecord-browser-")
engine = create_engine(f"sqlite:///{temporary.name}/fixture.sqlite", connect_args={"check_same_thread": False, "timeout": 30}, hide_parameters=True)
SQLModel.metadata.create_all(engine)
attendance_fixture = os.environ.get("BROWSER_ATTENDANCE_FIXTURE") == "1"
if attendance_fixture:
    import httpx

    def llm_response(request):
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=(
            'data: {"choices":[{"delta":{"content":"Synthetic attendance summary"}}]}\n\n'
            'data: [DONE]\n\n'
        ))

    meeting.engine = engine
    meeting.httpx = SimpleNamespace(AsyncClient=lambda **kwargs: httpx.AsyncClient(
        transport=httpx.MockTransport(llm_response), **kwargs))
settings.WECHAT_MSG_SERVICE_URL = None
settings.ENFORCE_RBAC = True
app = FastAPI()
image_bytes = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
images = {'fixture.png': image_bytes}
beli.save_file = lambda directory, name, content, mime: images.update({name: content})
beli.get_file = lambda directory, name: (images[name], '')
for router in (auth.router, iam.router, todo.router, project.router, beli.router, meeting.router):
    app.include_router(router, prefix="/api/v1")


def session_dependency():
    with Session(engine) as session:
        yield session


app.dependency_overrides[get_session] = session_dependency


@app.exception_handler(AtlasException)
async def handle_error(request: Request, exc: AtlasException):
    return JSONResponse(status_code=exc.code, content={"code": exc.code, "message": exc.message})


with Session(engine) as session:
    boss = User(display_name="测试L0", username="fixture_boss", profile_completed=True, must_change_password=False)
    session.add(boss); session.flush()
    employee = User(display_name="测试员工", username="fixture_employee", manager_user_id=boss.id,
        basic_salary=Decimal("12000"), beili_balance=2500, profile_completed=True, must_change_password=False,
        created_at=datetime(2020, 1, 1))
    l0 = User(display_name="测试非管理员L0", username="fixture_l0", profile_completed=True,
              must_change_password=False, created_at=datetime(2020, 1, 1))
    admin = Role(code="admin", name="Admin")
    staff = Role(code="fixture_staff", name="Employee")
    salary_l0 = Role(code="fixture_salary_l0", name="L0 with read-only IAM")
    entity = OurEntity(name="测试主体", type=OurEntityType.COMPANY, status=OurEntityStatus.ACTIVE)
    session.add_all([employee, l0, admin, staff, salary_l0, entity]); session.flush()
    session.add_all([UserRole(user_id=boss.id, role_id=admin.id, scope_type=ScopeType.GLOBAL),
                     UserRole(user_id=employee.id, role_id=staff.id, scope_type=ScopeType.GLOBAL),
                     UserRole(user_id=l0.id, role_id=salary_l0.id, scope_type=ScopeType.GLOBAL)])
    for module in ("todo", "project", "iam", "meeting", "finance", "contract", "kb"):
        for action in ("read", "write"):
            permission = Permission(code=f"{module}.{action}", name=f"{module}.{action}", module=module)
            session.add(permission); session.flush()
            session.add(RolePermission(role_id=staff.id, permission_id=permission.id))
            if module == "iam" and action == "read":
                session.add(RolePermission(role_id=salary_l0.id, permission_id=permission.id))
    p = Project(our_entity_id=entity.id, project_no="FIXTURE", name="测试项目", project_type=ProjectType.B2B,
                pm_user_id=boss.id, owner_user_id=boss.id, current_stage_code="development")
    session.add(p); session.flush()
    session.add(ProjectMember(project_id=p.id, user_id=employee.id, role_in_project="开发"))
    session.add(BeliPolicy(starts_on=date(2026, 10, 16), hours_rule_starts_at=now_cn(),
                           roster_starts_on=date(2026, 10, 16) if attendance_fixture else None))
    session.add(BeliProduct(name="半天年假", description="测试商品", kind="leave", price=300, stock=5, image_name='fixture.png',
                            leave_type="annual", leave_days=Decimal(".5")))
    for title in ("[BUG] 共享登录问题 - 前端", "[BUG] 共享登录问题 - 后端", "[BUG] 图片问题"):
        session.add(TodoItem(our_entity_id=entity.id, assignee_user_id=employee.id, creator_user_id=boss.id,
            title=title, source_type="project_task", source_id=str(p.id), action_type="do", tags=["bug"],
            due_at=datetime(2026, 10, 20, 18), estimated_hours=2, link={"type":"bug", "tester_user_id":str(boss.id)}))
    completed = TodoItem(our_entity_id=entity.id, assignee_user_id=employee.id, creator_user_id=boss.id,
        title="待贝利审核的任务", source_type="custom", source_id=str(uuid4()), action_type="do", status=TodoStatus.DONE,
        due_at=datetime(2026, 10, 20, 18), submitted_at=now_cn(), done_at=now_cn(), estimated_hours=2)
    session.add(completed); session.flush(); queue_reward(session, completed); session.commit()
    account_for(session, employee.id); session.commit()
    fixtures = {"project_id":str(p.id), "employee_id":str(employee.id),
        "l0_token":create_access_token({"sub":str(l0.id)}),
        "boss_token":create_access_token({"sub":str(boss.id)}), "employee_token":create_access_token({"sub":str(employee.id)})}
    if attendance_fixture:
        silent = User(display_name="测试未发言员工", username="fixture_silent", manager_user_id=boss.id,
                      created_at=datetime(2020, 1, 1))
        inactive = User(display_name="测试停用员工", username="fixture_inactive", manager_user_id=boss.id,
                        status=UserStatus.INACTIVE, created_at=datetime(2020, 1, 1))
        session.add_all([silent, inactive])
        session.flush()
        fixtures["attendance_silent_id"] = str(silent.id)
        fixtures["attendance_meetings"] = []
        for day in [date(2026, 10, 19), date(2026, 10, 20)]:
            groups = []
            for title in ["考勤验证早会", "同日早会"]:
                record = MeetingRecord(title=title, meeting_date=day, meeting_type="morning",
                                       status=MeetingStatus.TRANSCRIBED, created_by=boss.id,
                                       speaker_mapping={"s1": employee.display_name},
                                       speaker_user_mapping={"s1": str(employee.id)})
                session.add(record)
                session.flush()
                session.add(MeetingTranscriptSegment(meeting_id=record.id, speaker_id="s1", content="Synthetic notes"))
                groups.append(str(record.id))
            fixtures["attendance_meetings"].append(groups)
        session.commit()


@app.get("/__fixtures")
def fixture_sessions():
    return fixtures


if __name__ == "__main__":
    if not sys.prefix.endswith("/envs/punkrecord"):
        raise SystemExit("Use the punkrecord Conda interpreter")
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("BROWSER_FIXTURE_PORT", "15185")), log_level="warning")
