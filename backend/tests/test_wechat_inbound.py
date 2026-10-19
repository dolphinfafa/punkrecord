from app.services.wechat_inbound import (
    _wants_todo_list,
    parse_action_reply,
    parse_quote_command,
)

UUID_STR = "3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b"
UUID_NODASH = UUID_STR.replace("-", "")
NOTIFY = f"📋 待办\n标题: 修复登录页\n优先级: P1\n状态: pending_review\n单号: {UUID_STR}"


# ─── parse_quote_command ────────────────────────────────────────────────────

def test_parse_approve():
    cmd = parse_quote_command(f"[引用: {NOTIFY}]\n通过")
    assert cmd == {"action": "approve", "todo_id": UUID_STR, "comment": None}


def test_parse_reject_with_reason():
    cmd = parse_quote_command(f"[引用: {NOTIFY}]\n拒绝 理由:预算超了")
    assert cmd["action"] == "reject"
    assert cmd["todo_id"] == UUID_STR
    assert cmd["comment"] == "预算超了"


def test_parse_reject_default_comment():
    cmd = parse_quote_command(f"[引用: {NOTIFY}]\n驳回")
    assert cmd["comment"] == "审核不通过"


def test_parse_normalizes_nodash_uuid():
    notify = NOTIFY.replace(UUID_STR, UUID_NODASH)
    cmd = parse_quote_command(f"[引用: {notify}]\n同意")
    assert cmd["todo_id"] == UUID_STR  # 规范成带连字符小写


def test_parse_various_approve_words():
    for w in ["通过", "同意", "批准", "可以", "好的", "ok", "OK", "通过。"]:
        assert parse_quote_command(f"[引用: {NOTIFY}]\n{w}")["action"] == "approve", w


def test_parse_no_quote_returns_none():
    assert parse_quote_command("通过") is None


def test_parse_quote_without_uuid_returns_none():
    assert parse_quote_command("[引用: 标题: 某任务]\n通过") is None


def test_parse_non_command_reply_returns_none():
    assert parse_quote_command(f"[引用: {NOTIFY}]\n这个能延期吗") is None


# ─── _wants_todo_list ───────────────────────────────────────────────────────

def test_todo_list_triggers():
    for t in ["待办", "所有待办", "我的待办", "待办列表", "todo", "LIST", "查一下任务列表",
              "有哪些需要我审批的", "要审核的有哪些", "有什么要批准的"]:
        assert _wants_todo_list(t), t


def test_todo_list_not_triggered():
    for t in ["你好", "", "帮我写一份待办系统的使用文档好吗,要详细一点的"]:
        assert not _wants_todo_list(t), t


# ─── parse_action_reply(编号指令) ───────────────────────────────────────────

def test_action_bare_words():
    assert parse_action_reply("通过") == {"action": "approve", "index": None, "comment": None}
    assert parse_action_reply("通过了")["action"] == "approve"
    assert parse_action_reply("同意")["action"] == "approve"
    assert parse_action_reply("拒绝") == {"action": "reject", "index": None, "comment": "审核不通过"}


def test_action_with_index():
    r = parse_action_reply("通过 1")
    assert r == {"action": "approve", "index": 1, "comment": None}
    assert parse_action_reply("同意第2条")["index"] == 2
    r = parse_action_reply("拒绝 3 理由:预算超了")
    assert r["action"] == "reject" and r["index"] == 3 and r["comment"] == "预算超了"
    assert parse_action_reply("驳回2，需求不明确")["index"] == 2


def test_action_with_uuid():
    r = parse_action_reply(f"通过 {UUID_STR}")
    assert r == {"action": "approve", "todo_id": UUID_STR, "comment": None}


def test_action_non_command_returns_none():
    for t in ["你好", "挺贵", "通过一下这个方案吧我觉得还行", "", "12345"]:
        assert parse_action_reply(t) is None, t


# ─── parse_bulk_command(批量指令) ───────────────────────────────────────────

def test_bulk_commands():
    from app.services.wechat_inbound import parse_bulk_command
    assert parse_bulk_command("全部通过") == {"action": "approve", "comment": None}
    assert parse_bulk_command("都同意")["action"] == "approve"
    assert parse_bulk_command("全部通过了")["action"] == "approve"
    assert parse_bulk_command("通过全部")["action"] == "approve"
    r = parse_bulk_command("全部拒绝 理由:时间太长")
    assert r == {"action": "reject", "comment": "时间太长"}


def test_bulk_not_triggered_by_questions():
    from app.services.wechat_inbound import parse_bulk_command
    for t in ["全部通过的申请都会发吗", "都通过的话要不要通知他们", "你好", ""]:
        assert parse_bulk_command(t) is None, t


def test_typed_leave_ids_in_explicit_and_quoted_commands():
    assert parse_action_reply(f'通过 leave:{UUID_STR}')['todo_id'] == f'leave:{UUID_STR}'
    assert parse_action_reply(f'拒绝 请假 {UUID_STR} 理由:有冲突')['todo_id'] == f'leave:{UUID_STR}'
    assert parse_quote_command(f'[引用: 请假申请\n单号: leave:{UUID_STR}]\n通过')['todo_id'] == f'leave:{UUID_STR}'
    assert parse_quote_command(f'[引用: 请假申请\n单号: {UUID_STR}]\n通过')['todo_id'] == f'leave:{UUID_STR}'


def test_leave_approval_uses_independent_endpoint(monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock
    from app.services import wechat_inbound as api
    user = object()
    call = AsyncMock(return_value={'applicant_name': 'Employee'})
    monkeypatch.setattr(api, '_internal_call', call)
    result = asyncio.run(api._exec_approval(user, {'todo_id': f'leave:{UUID_STR}', 'action': 'approve', 'comment': None}))
    call.assert_awaited_once_with(user, 'POST', f'/todo/leaves/{UUID_STR}/approve', {'comment': None})
    assert 'Employee' in result


def test_pending_reviews_combines_leaves_without_todo_mirrors(monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock
    from app.services import wechat_inbound as api
    call = AsyncMock(side_effect=[{'id': 'boss'}, {'items': [{'id': 'task', 'title': 'Task'}]},
        [{'id': UUID_STR, 'applicant_name': 'Employee', 'start_at': '2026-10-16', 'end_at': '2026-10-17'}]])
    monkeypatch.setattr(api, '_internal_call', call)
    results = asyncio.run(api._pending_reviews(object()))
    assert [row['id'] for row in results] == ['task', f'leave:{UUID_STR}']
    assert call.await_args_list[-1].args[2] == '/todo/leaves/team/pending'
