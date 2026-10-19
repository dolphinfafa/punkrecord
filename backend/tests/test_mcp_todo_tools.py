from unittest.mock import AsyncMock
from pathlib import Path
import re

import pytest

from app.api import mcp_server


@pytest.mark.asyncio
async def test_mcp_documented_inventory_matches_registered_tools():
    document = Path(__file__).resolve().parents[2] / '.agent/workflows/backend-api.md'
    inventory = next(line for line in document.read_text(encoding='utf-8').splitlines()
                     if line.startswith('- **工具（'))
    documented_names = re.findall(r'`([^`]+)`', inventory)
    tools = await mcp_server.mcp.list_tools()
    actual_names = {tool.name for tool in tools}
    assert set(documented_names) == actual_names
    assert len(documented_names) == len(actual_names)
    assert int(re.search(r'工具（(\d+)）', inventory).group(1)) == len(actual_names)


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


@pytest.mark.asyncio
@pytest.mark.parametrize('tool', ['create_todo', 'create_bug'])
async def test_mcp_creates_require_and_forward_task_plan(monkeypatch, tool):
    ctx = object()
    call = AsyncMock(return_value={'id': 'todo-1', 'link': {}})
    monkeypatch.setattr(mcp_server, '_call', call)
    method = getattr(mcp_server, tool)
    with pytest.raises(TypeError):
        await method(ctx=ctx, title='Task', assignee_user_id='employee-1')
    await method(ctx=ctx, title='Task', assignee_user_id='employee-1', project_id='project-1',
                 due_at='2026-10-20T18:00:00', estimated_hours=1.25)
    body = call.await_args.kwargs['json']
    assert body['estimated_hours'] == 1.25 and body['due_at'] == '2026-10-20T18:00:00'
    assert body['link']['project_id'] == 'project-1'


@pytest.mark.asyncio
@pytest.mark.parametrize('tool', ['create_todo', 'create_bug'])
async def test_mcp_creates_default_to_zero_hours(monkeypatch, tool):
    call = AsyncMock(return_value={'id': 'todo-1', 'link': {}})
    monkeypatch.setattr(mcp_server, '_call', call)
    await getattr(mcp_server, tool)(ctx=object(), title='Zero hours', assignee_user_id='employee-1',
                                  project_id='project-1', due_at='2026-10-20T18:00:00')
    assert call.await_args.kwargs['json']['estimated_hours'] == 0


@pytest.mark.asyncio
async def test_mcp_update_can_set_hours_to_zero(monkeypatch):
    ctx = object()
    call = AsyncMock(return_value={'id': 'todo-1', 'link': {}})
    monkeypatch.setattr(mcp_server, '_call', call)
    await mcp_server.update_todo(ctx=ctx, todo_id='todo-1', estimated_hours=0)
    call.assert_awaited_once_with(ctx, 'PATCH', '/todo/todo-1', json={'estimated_hours': 0})


@pytest.mark.asyncio
async def test_mcp_search_project_bugs_forwards_query_and_enriches(monkeypatch):
    call = AsyncMock(return_value={'items': [{'id': 'bug-1', 'link': {}}], 'total': 1})
    monkeypatch.setattr(mcp_server, '_call', call)
    result = await mcp_server.search_project_bugs(ctx=object(), project_id='project-1', title='登录', page=2)
    assert call.await_args.args[1:] == ('GET', '/project/projects/project-1/bugs')
    assert call.await_args.kwargs['params'] == {'title': '登录', 'page': 2, 'page_size': 30}
    assert result['items'][0]['id'] == 'bug-1'


@pytest.mark.asyncio
async def test_mcp_independent_leave_review_tools(monkeypatch):
    ctx = object()
    call = AsyncMock(return_value=[])
    monkeypatch.setattr(mcp_server, '_call', call)
    assert await mcp_server.list_leaves_to_review(ctx) == []
    call.assert_awaited_with(ctx, 'GET', '/todo/leaves/team/pending')
    call.return_value = {'id': 'leave-1'}
    await mcp_server.approve_leave(ctx, 'leave-1')
    call.assert_awaited_with(ctx, 'POST', '/todo/leaves/leave-1/approve')
    await mcp_server.reject_leave(ctx, 'leave-1', '有冲突')
    call.assert_awaited_with(ctx, 'POST', '/todo/leaves/leave-1/reject', json={'comment': '有冲突'})
