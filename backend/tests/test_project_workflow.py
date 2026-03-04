import asyncio
from datetime import datetime, timedelta
from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine, select

from app import models  # noqa: F401
from app.api.project import (
    add_project_member,
    clear_project_todos,
    create_project,
    remove_project_member,
    update_project_todo_plan,
)
from app.models.iam import OurEntity, OurEntityStatus, OurEntityType, User, UserStatus
from app.models.project import ProjectMember, ProjectStage
from app.models.todo import TodoActionType, TodoItem, TodoPriority, TodoSourceType, TodoStatus
from app.schemas.project import ProjectCreate, ProjectMemberCreate, ProjectTaskPlanUpdateRequest


def _make_session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _seed_user(session: Session, name: str) -> User:
    user = User(
        display_name=name,
        username=f"{name.lower()}_{uuid4().hex[:6]}",
        status=UserStatus.ACTIVE,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _seed_entity(session: Session) -> OurEntity:
    entity = OurEntity(
        name=f"Entity-{uuid4().hex[:6]}",
        type=OurEntityType.COMPANY,
        status=OurEntityStatus.ACTIVE,
    )
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


def test_create_project_generates_stages_and_response():
    with _make_session() as session:
        owner = _seed_user(session, "Owner")
        pm = _seed_user(session, "PM")
        entity = _seed_entity(session)

        payload = ProjectCreate(
            our_entity_id=entity.id,
            project_no=f"P-{uuid4().hex[:8]}",
            name="Project API Test",
            project_type="b2b",
            pm_user_id=pm.id,
        )

        resp = asyncio.run(create_project(payload, session=session, current_user=owner))
        assert resp["code"] == 0
        assert resp["data"].name == "Project API Test"

        stages = session.exec(select(ProjectStage)).all()
        assert len(stages) == 8


def test_add_and_remove_project_member():
    with _make_session() as session:
        owner = _seed_user(session, "Owner")
        pm = _seed_user(session, "PM")
        member_user = _seed_user(session, "Member")
        entity = _seed_entity(session)

        project_resp = asyncio.run(
            create_project(
                ProjectCreate(
                    our_entity_id=entity.id,
                    project_no=f"P-{uuid4().hex[:8]}",
                    name="Member Test",
                    project_type="b2b",
                    pm_user_id=pm.id,
                ),
                session=session,
                current_user=owner,
            )
        )
        project_id = project_resp["data"].id

        add_resp = asyncio.run(
            add_project_member(
                project_id=project_id,
                data=ProjectMemberCreate(user_id=member_user.id),
                session=session,
                current_user=owner,
            )
        )
        assert add_resp["code"] == 0

        members = session.exec(select(ProjectMember)).all()
        assert len(members) >= 1

        rm_resp = asyncio.run(
            remove_project_member(
                project_id=project_id,
                user_id=member_user.id,
                session=session,
                current_user=owner,
            )
        )
        assert rm_resp["code"] == 0
        assert session.exec(select(ProjectMember).where(ProjectMember.user_id == member_user.id)).first() is None


def test_update_project_todo_plan_updates_assignment_and_due_date():
    with _make_session() as session:
        owner = _seed_user(session, "Owner")
        pm = _seed_user(session, "PM")
        assignee = _seed_user(session, "Assignee")
        entity = _seed_entity(session)

        project_resp = asyncio.run(
            create_project(
                ProjectCreate(
                    our_entity_id=entity.id,
                    project_no=f"P-{uuid4().hex[:8]}",
                    name="Plan Test",
                    project_type="b2b",
                    pm_user_id=pm.id,
                ),
                session=session,
                current_user=owner,
            )
        )
        project_id = project_resp["data"].id

        # Add assignee as project member so plan update is authorized.
        asyncio.run(
            add_project_member(
                project_id=project_id,
                data=ProjectMemberCreate(user_id=assignee.id),
                session=session,
                current_user=owner,
            )
        )

        todo = TodoItem(
            our_entity_id=entity.id,
            assignee_user_id=pm.id,
            creator_user_id=pm.id,
            title="Dev Task",
            source_type=TodoSourceType.PROJECT_TASK,
            source_id=str(project_id),
            action_type=TodoActionType.DO,
            priority=TodoPriority.P2,
            status=TodoStatus.OPEN,
        )
        session.add(todo)
        session.commit()
        session.refresh(todo)

        new_due = datetime.utcnow() + timedelta(days=5)
        update_resp = asyncio.run(
            update_project_todo_plan(
                project_id=project_id,
                todo_id=todo.id,
                data=ProjectTaskPlanUpdateRequest(
                    assignee_user_id=assignee.id,
                    due_at=new_due,
                    priority="p1",
                ),
                session=session,
                current_user=pm,
            )
        )
        assert update_resp["code"] == 0

        updated_todo = session.get(TodoItem, todo.id)
        assert updated_todo.assignee_user_id == assignee.id
        assert updated_todo.priority == TodoPriority.P1
        assert updated_todo.due_at is not None


def test_project_member_can_reassign_bug_developer():
    with _make_session() as session:
        owner = _seed_user(session, "Owner")
        pm = _seed_user(session, "PM")
        member = _seed_user(session, "Member")
        dev = _seed_user(session, "Dev")
        entity = _seed_entity(session)

        project_resp = asyncio.run(
            create_project(
                ProjectCreate(
                    our_entity_id=entity.id,
                    project_no=f"P-{uuid4().hex[:8]}",
                    name="Bug Assign Test",
                    project_type="b2b",
                    pm_user_id=pm.id,
                ),
                session=session,
                current_user=owner,
            )
        )
        project_id = project_resp["data"].id

        asyncio.run(add_project_member(project_id=project_id, data=ProjectMemberCreate(user_id=member.id), session=session, current_user=owner))
        asyncio.run(add_project_member(project_id=project_id, data=ProjectMemberCreate(user_id=dev.id), session=session, current_user=owner))

        bug_todo = TodoItem(
            our_entity_id=entity.id,
            assignee_user_id=pm.id,
            creator_user_id=pm.id,
            title="[BUG] Login crash",
            source_type=TodoSourceType.PROJECT_TASK,
            source_id=str(project_id),
            action_type=TodoActionType.DO,
            priority=TodoPriority.P1,
            status=TodoStatus.OPEN,
            tags=["bug"],
            link={"type": "bug"},
        )
        session.add(bug_todo)
        session.commit()
        session.refresh(bug_todo)

        resp = asyncio.run(
            update_project_todo_plan(
                project_id=project_id,
                todo_id=bug_todo.id,
                data=ProjectTaskPlanUpdateRequest(assignee_user_id=dev.id),
                session=session,
                current_user=member,
            )
        )
        assert resp["code"] == 0
        assert session.get(TodoItem, bug_todo.id).assignee_user_id == dev.id


def test_clear_project_todos_cascades_linked_mirror_todos():
    with _make_session() as session:
        owner = _seed_user(session, "Owner")
        pm = _seed_user(session, "PM")
        dev = _seed_user(session, "Dev")
        entity = _seed_entity(session)

        project_resp = asyncio.run(
            create_project(
                ProjectCreate(
                    our_entity_id=entity.id,
                    project_no=f"P-{uuid4().hex[:8]}",
                    name="Clear Todos Test",
                    project_type="b2b",
                    pm_user_id=pm.id,
                ),
                session=session,
                current_user=owner,
            )
        )
        project_id = project_resp["data"].id

        tracking = TodoItem(
            our_entity_id=entity.id,
            assignee_user_id=dev.id,
            creator_user_id=pm.id,
            title="[BUG] API timeout",
            source_type=TodoSourceType.PROJECT_TASK,
            source_id=str(project_id),
            action_type=TodoActionType.DO,
            priority=TodoPriority.P1,
            status=TodoStatus.OPEN,
            tags=["bug"],
            link={"type": "bug"},
        )
        session.add(tracking)
        session.commit()
        session.refresh(tracking)

        mirrored = TodoItem(
            our_entity_id=entity.id,
            assignee_user_id=dev.id,
            creator_user_id=pm.id,
            title="[待修复][BUG] API timeout",
            source_type=TodoSourceType.CUSTOM,
            source_id=uuid4().hex,
            action_type=TodoActionType.DO,
            priority=TodoPriority.P1,
            status=TodoStatus.OPEN,
            tags=["bug_fix"],
            link={"type": "bug_fix_todo", "tracking_todo_id": str(tracking.id)},
        )
        session.add(mirrored)
        session.commit()

        clear_resp = asyncio.run(clear_project_todos(project_id=project_id, session=session, current_user=pm))
        assert clear_resp["code"] == 0
        assert session.get(TodoItem, tracking.id) is None
        assert session.get(TodoItem, mirrored.id) is None
