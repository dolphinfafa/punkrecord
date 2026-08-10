from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine, select

from app import models  # noqa: F401
from app.api.todo import _apply_todo_list_order
from app.models.todo import TodoActionType, TodoItem, TodoPriority, TodoSourceType, TodoStatus


def _make_session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _make_todo(title: str, status: TodoStatus, *, due_at: datetime, done_at: Optional[datetime] = None) -> TodoItem:
    return TodoItem(
        our_entity_id=uuid4(),
        assignee_user_id=uuid4(),
        creator_user_id=uuid4(),
        title=title,
        source_type=TodoSourceType.CUSTOM,
        source_id=uuid4().hex,
        action_type=TodoActionType.DO,
        priority=TodoPriority.P2,
        status=status,
        due_at=due_at,
        done_at=done_at,
        updated_at=done_at or due_at,
    )


def test_done_todos_sort_by_done_at_desc():
    base = datetime(2026, 8, 10, 10, 0, 0)
    with _make_session() as session:
        session.add(_make_todo("older-done", TodoStatus.DONE, due_at=base + timedelta(days=3), done_at=base))
        session.add(_make_todo("newer-done", TodoStatus.DONE, due_at=base + timedelta(days=1), done_at=base + timedelta(hours=2)))
        session.commit()

        query = select(TodoItem).where(TodoItem.status == TodoStatus.DONE)
        rows = session.exec(_apply_todo_list_order(query, "done")).all()

    assert [row.title for row in rows] == ["newer-done", "older-done"]


def test_active_todos_keep_due_at_order():
    base = datetime(2026, 8, 10, 10, 0, 0)
    with _make_session() as session:
        session.add(_make_todo("later-due", TodoStatus.OPEN, due_at=base + timedelta(days=3)))
        session.add(_make_todo("earlier-due", TodoStatus.OPEN, due_at=base + timedelta(days=1)))
        session.commit()

        query = select(TodoItem).where(TodoItem.status == TodoStatus.OPEN)
        rows = session.exec(_apply_todo_list_order(query, "open")).all()

    assert [row.title for row in rows] == ["earlier-due", "later-due"]
