from unittest.mock import AsyncMock

import pytest

from app.api import mcp_server


@pytest.mark.asyncio
async def test_update_todo_forwards_only_supplied_fields(monkeypatch):
    ctx = object()
    call = AsyncMock(
        return_value={
            "id": "todo-1",
            "title": "更新后的任务",
            "priority": "p1",
            "link": {},
        }
    )
    monkeypatch.setattr(mcp_server, "_call", call)

    result = await mcp_server.update_todo(
        ctx=ctx,
        todo_id="todo-1",
        title="更新后的任务",
        priority="p1",
        tags=["backend"],
        project_id="project-1",
        dev_type="dev_backend",
    )

    call.assert_awaited_once_with(
        ctx,
        "PATCH",
        "/todo/todo-1",
        json={
            "title": "更新后的任务",
            "priority": "p1",
            "tags": ["backend"],
            "link": {"project_id": "project-1", "dev_type": "dev_backend"},
        },
    )
    assert result["title"] == "更新后的任务"


@pytest.mark.asyncio
async def test_update_todo_requires_at_least_one_change(monkeypatch):
    call = AsyncMock()
    monkeypatch.setattr(mcp_server, "_call", call)

    with pytest.raises(RuntimeError, match="至少需要提供一个"):
        await mcp_server.update_todo(ctx=object(), todo_id="todo-1")

    call.assert_not_awaited()
