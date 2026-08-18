"""
微信入站消息处理(融合模式 C)。

weixin-msg-service 收到用户在微信里发来的消息后,转发到
`POST /wechat-notify/inbound`,本模块负责理解并执行:
  1. 引用某条推送 + 回复"通过/拒绝" → 审批对应待办(与 wechat-bot 的
     parse.ts 同源的确定性解析,不经 LLM);
  2. "待办/所有待办/todo" 等 → 把当前待办逐条推送(一条待办一条消息,
     每条带单号,可继续引用回复审批);
  3. 其余自由消息 → LiteLLM 对话兜底。

入站本身即"通道激活"信号,顺带触发该用户离线队列补发。

注意:本模块运行在后端自己的事件循环里,且会调用本系统自身 REST
(自调用)。所有 HTTP 必须用 AsyncClient —— 在 async 端点里用同步
httpx 调自己会死锁事件循环(等不到响应直至超时)。
"""
import asyncio
import logging
import re
from typing import Optional
from uuid import UUID

import httpx
from sqlmodel import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.models.iam import User
from app.models.shared import WeChatNotifyBinding
from app.services.wechat_notify_queue import SendOutcome, send_wechat_text

logger = logging.getLogger(__name__)

# ─── 引用回复解析(与 wechat-bot/src/parse.ts 保持同源) ──────────────────────

_UUID_RE = re.compile(
    r"单号\s*[:：]\s*("
    r"[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}"
    r"|[0-9a-fA-F]{32})"
)
_APPROVE_RE = re.compile(
    r"^(通过|同意|批准|可以啊?|可以的?|行|好的?|OK|okay|approve|lgtm|yes|没问题)(了)?[\s!。.~！]*$",
    re.I,
)
_REJECT_RE = re.compile(
    r"^(拒绝|驳回|不同意|不通过|打回|退回|reject|no)(了)?(?:\s*理由?\s*[:：,，]?\s*)?(.*)$",
    re.I,
)
_DEFAULT_REJECT_COMMENT = "审核不通过"

# ─── 编号指令(微信通道不回传"引用"内容,改为:待办→带编号逐条发送→回复编号) ───

_APPROVE_WORDS = ("通过", "同意", "批准", "可以", "行", "好的", "好", "ok", "okay",
                  "approve", "lgtm", "yes", "没问题")
_REJECT_WORDS = ("拒绝", "驳回", "不同意", "不通过", "打回", "退回", "reject", "no")

_REPLY_CMD_RE = re.compile(  # 备用:见 parse_action_reply 的说明
    r"^(unused)$"
)
_REPLY_UUID_RE = re.compile(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{32})")
_INDEX_RE = re.compile(r"^(?:第)?(\d+)(?:条|项|个)?\s*(.*)$")

# 动词锚定:词表按需排序(长词在前避免前缀吞掉),匹配后解析剩余部分
_ACTION_VERB_RE = re.compile(
    r"^(不通过|不同意|没问题|好的|可以|okay|approve|lgtm|yes|reject|"
    r"通过|同意|批准|拒绝|驳回|打回|退回|行|好|ok|no)(了)?",
    re.I,
)
_APPROVE_WORD_SET = {"不通过", "没问题", "好的", "可以", "okay", "approve", "lgtm",
                     "yes", "通过", "同意", "批准", "行", "好", "ok"}


def _clean_comment(s: str) -> str:
    return re.sub(r"^[\s,，、]*理由?[\s:：,，]*", "", (s or "").strip()).strip()


def parse_action_reply(text: str) -> Optional[dict]:
    """解析编号/单号指令:"通过 1"/"同意第2条"/"拒绝 3 理由:xx"/"通过了"/"通过 <uuid>"。
    返回 {"action","index"|"todo_id","comment"} 或 None(不是指令)。"""
    t = (text or "").strip()
    if not t or len(t) > 60:
        return None
    m = _ACTION_VERB_RE.match(t)
    if not m:
        return None
    action = "approve" if m.group(1).lower() in _APPROVE_WORD_SET else "reject"
    rest = t[m.end():].strip()

    # 消息里直接带完整单号 → 优先用单号
    um = _REPLY_UUID_RE.search(rest)
    if um:
        uid = _normalize_uuid(um.group(1))
        if uid:
            comment = _clean_comment(rest.replace(um.group(1), "").strip())
            return {"action": action, "todo_id": uid,
                    "comment": (comment or _DEFAULT_REJECT_COMMENT) if action == "reject" else (comment or None)}

    im = _INDEX_RE.match(rest)
    if im:
        comment = _clean_comment(im.group(2))
        return {"action": action, "index": int(im.group(1)),
                "comment": (comment or _DEFAULT_REJECT_COMMENT) if action == "reject" else (comment or None)}

    if not rest:  # 裸动词
        return {"action": action, "index": None,
                "comment": _DEFAULT_REJECT_COMMENT if action == "reject" else None}

    # 通过 + 无编号无单号的尾文 → 多半是普通聊天(如"通过一下这个方案吧")
    if action == "approve":
        return None
    # 拒绝 + 尾文 → 尾文即理由
    return {"action": "reject", "index": None, "comment": _clean_comment(rest) or _DEFAULT_REJECT_COMMENT}


def _reply_cache_get(account_id: str) -> Optional[list]:
    import time as _time
    entry = _REPLY_CACHE.get(account_id)
    if not entry:
        return None
    if _time.time() - entry["ts"] > _REPLY_CACHE_TTL_SECONDS:
        _REPLY_CACHE.pop(account_id, None)
        return None
    return entry["items"]


def _reply_cache_set(account_id: str, items: list) -> None:
    import time as _time
    _REPLY_CACHE[account_id] = {"items": items, "ts": _time.time()}


def _normalize_uuid(raw: str) -> Optional[str]:
    hex_str = raw.replace("-", "").lower()
    if len(hex_str) != 32:
        return None
    return (
        f"{hex_str[0:8]}-{hex_str[8:12]}-{hex_str[12:16]}-{hex_str[16:20]}-{hex_str[20:32]}"
    )


def parse_quote_command(text: str) -> Optional[dict]:
    """解析"[引用: ...单号: <uuid>...]\n<回复>"为审批指令;解析不出返回 None。"""
    if not text or not text.startswith("[引用:"):
        return None
    close = text.find("]")
    if close == -1:
        return None
    quoted = text[len("[引用:"):close]
    reply = text[close + 1:].lstrip("\n").strip()

    m = _UUID_RE.search(quoted)
    if not m:
        return None
    todo_id = _normalize_uuid(m.group(1))
    if not todo_id:
        return None

    if _APPROVE_RE.match(reply):
        return {"action": "approve", "todo_id": todo_id, "comment": None}
    rm = _REJECT_RE.match(reply)
    if rm:
        comment = re.sub(r"^[理由由\s]*[:：]?", "", (rm.group(3) or "").strip()).strip()
        return {"action": "reject", "todo_id": todo_id, "comment": comment or _DEFAULT_REJECT_COMMENT}
    return None


# ─── 以绑定用户身份调用本系统 REST(铸造短时 JWT,完整复用权限逻辑) ─────────
# 必须异步:这是进程对自身的 HTTP 调用。

async def _internal_call(user: User, method: str, path: str, json_body: Optional[dict] = None) -> dict:
    token = create_access_token({"sub": str(user.id)})
    url = f"{settings.INTERNAL_API_BASE_URL.rstrip('/')}{path}"
    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        resp = await client.request(
            method, url,
            json=json_body,
            headers={"Authorization": f"Bearer {token}"},
        )
    try:
        body = resp.json()
    except ValueError:
        body = {}
    if resp.status_code >= 400:
        raise RuntimeError(str(body.get("message") or body.get("detail") or f"HTTP {resp.status_code}"))
    return body.get("data") if isinstance(body, dict) and "data" in body else body


# ─── 各类处理 ────────────────────────────────────────────────────────────────

async def _exec_approval(user: User, cmd: dict) -> str:
    """cmd 需含 todo_id(编号指令已解析)"""
    todo_id = cmd["todo_id"]
    try:
        if cmd["action"] == "approve":
            data = await _internal_call(user, "POST", f"/todo/{todo_id}/approve", {"comment": None})
        else:
            data = await _internal_call(user, "POST", f"/todo/{todo_id}/reject", {"comment": cmd["comment"]})
    except Exception as e:  # noqa: BLE001
        return f"❌ {('通过' if cmd['action'] == 'approve' else '拒绝')}失败:{e}"
    title = (data or {}).get("title") or todo_id[:8]

    # 请假审批级联:该待办关联请假单时,同步批准/驳回请假单本身
    # (否则只改待办状态,请假单永远停在 pending)
    leave_note = ""
    link = (data or {}).get("link") or {}
    leave_id = link.get("leave_id")
    if leave_id:
        try:
            if cmd["action"] == "approve":
                await _internal_call(user, "POST", f"/todo/leaves/{leave_id}/approve", {})
            else:
                await _internal_call(user, "POST", f"/todo/leaves/{leave_id}/reject", {"comment": cmd["comment"]})
            leave_note = "(请假单已同步审批)"
        except Exception as e:  # noqa: BLE001
            leave_note = f"(⚠️ 请假单同步失败:{e})"

    if cmd["action"] == "approve":
        return f"✅ 已通过:{title}{leave_note}"
    return f"🚫 已拒绝:{title}\n理由:{cmd['comment']}{leave_note}"


_TODO_LIST_HINTS = (
    "待办", "代办", "任务列表", "todo", "list",
    "有什么任务", "我的任务",
    # 审批类问法(如"有哪些需要我审批的")也路由到真实查询,避免落到 LLM 编造
    "审批", "审核", "批准",
)


def _wants_todo_list(text: str) -> bool:
    lowered = (text or "").strip().lower()
    # 只对短消息生效:长句多半是普通提问(如"帮我写待办系统文档"),交给 LLM
    if not lowered or len(lowered) > 12:
        return False
    return any(h in lowered for h in _TODO_LIST_HINTS)




async def _send_todo_list(user: User, binding: WeChatNotifyBinding) -> str:
    """「待办」指令:逐条只发"待你审批"的事项(请假审批等,可引用回复通过/拒绝);
    其余进行中的待办只给数量。"""
    # 1) 待我审核的(pending_review 且我是审核人)——逐条发送
    try:
        me = await _internal_call(user, "GET", "/auth/me")
        review_data = await _internal_call(
            user, "GET",
            f"/todo/team?status=pending_review&reviewed_by_user_id={me.get('id')}&page_size=50",
        )
        review_items = (review_data or {}).get("items") or []
    except Exception as e:  # noqa: BLE001
        return f"❌ 查询待审批失败:{e}"

    sent = 0
    num_items = []  # (todo_id, title) 编号映射,供"通过 1"指令解析
    for i, t in enumerate(review_items, start=1):
        desc = (t.get("description") or "").strip().replace("\n", " | ")
        if len(desc) > 60:
            desc = desc[:60] + "…"
        msg = (
            f"🔔 待你审批【{i}】\n标题: {t['title']}\n状态: {t.get('status')}"
            + (f"\n内容: {desc}" if desc else "")
            + f"\n单号: {t['id']}"
        )
        outcome, err = await asyncio.to_thread(send_wechat_text, binding.msg_service_key, msg)
        if outcome is SendOutcome.SENT:
            sent += 1
            num_items.append((t["id"], t["title"]))
        else:
            logger.warning("review-queue push failed (todo=%s): %s", t.get("id"), err)

    # 记录编号映射,后续"通过 1/拒绝 2 理由:xx"据此定位
    if binding.account_id:
        _reply_cache_set(binding.account_id, num_items)

    # 2) 我名下进行中的其余待办(open/in_progress/blocked)——只计数
    try:
        my_data = await _internal_call(user, "GET", "/todo/my?page_size=100")
        my_items = (my_data or {}).get("items") or []
        doing = [t for t in my_items if (t.get("status") or "") in ("open", "in_progress", "blocked")]
        doing_count = len(doing)
    except Exception:  # noqa: BLE001
        logger.exception("query my todos failed")
        doing_count = -1  # 查询失败时不展示该项

    parts = []
    if review_items:
        parts.append(f"🔔 待你审批 {len(review_items)} 条,已逐条发送(带编号)")
        if sent:
            parts.append('直接回复:通过 1 / 拒绝 2 理由:xxx')
    else:
        parts.append("✅ 没有待你审批的事项")
    if doing_count >= 0:
        parts.append(f"📋 你名下进行中的待办 {doing_count} 条")
    return "\n".join(parts)


_LLM_SYSTEM_TEMPLATE = (
    "你是 PunkRecord 待办系统的微信助手,用户在微信里和你对话。\n"
    "【实时数据】(仅可引用下面给出的数据,严禁编造任何人名、数量或事项):\n"
    "{facts}\n"
    "【指令协议】用户发送\"待办\":系统逐条发送待审批事项(带编号【1】【2】…);"
    "用户回复\"通过 编号\"或\"拒绝 编号 理由:xxx\"即可审批对应事项(无需引用消息);"
    "用户只发\"通过/拒绝\"没带编号时,提醒其按\"通过 编号\"格式回复。\n"
    "【规则】回答务必简短,适合微信阅读,不要 markdown;"
    "凡问及具体待办/审批内容而【实时数据】里没有的,引导用户发送\"待办\"查看,不得虚构;"
    "与系统无关的问题礼貌带过。"
)

_FACTS_OK = "- 待用户审批:{review} 条\n- 进行中待办:{doing} 条"
_FACTS_UNAVAILABLE = "(实时数据暂时不可用,请引导用户发送\"待办\"查询,不要猜测)"


async def _fetch_facts(user: User) -> Optional[str]:
    """取用户真实待办数据,供 LLM 引用(失败返回 None,绝不给 LLM 编造的机会)。"""
    try:
        me = await _internal_call(user, "GET", "/auth/me")
        review_data = await _internal_call(
            user, "GET",
            f"/todo/team?status=pending_review&reviewed_by_user_id={me.get('id')}&page_size=1",
        )
        my_data = await _internal_call(user, "GET", "/todo/my?page_size=100")
        doing = [
            t for t in (my_data or {}).get("items") or []
            if (t.get("status") or "") in ("open", "in_progress", "blocked")
        ]
        review_total = (review_data or {}).get("total")
        if review_total is None:
            review_total = len((review_data or {}).get("items") or [])
        return _FACTS_OK.format(review=review_total, doing=len(doing))
    except Exception:  # noqa: BLE001
        logger.exception("fetch facts for LLM failed")
        return None


async def _llm_reply(user: User, text: str) -> str:
    facts = await _fetch_facts(user)
    system_prompt = _LLM_SYSTEM_TEMPLATE.format(
        facts=facts if facts is not None else _FACTS_UNAVAILABLE
    )
    try:
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            resp = await client.post(
                f"{settings.LITELLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.LITELLM_API_KEY}"},
                json={
                    "model": settings.LITELLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text},
                    ],
                },
            )
        body = resp.json()
        return ((body.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()
    except Exception as e:  # noqa: BLE001
        logger.warning("inbound LLM reply failed: %s", e)
        return ""


# ─── 入口 ────────────────────────────────────────────────────────────────────

async def handle_wechat_inbound(session: Session, user: User, binding: WeChatNotifyBinding, text: str) -> str:
    """处理一条入站消息,返回回复文本(空串=不回复)。"""
    # 来信即激活信号:顺手补发离线队列(同步 DB+HTTP,放线程池;尽力而为)
    from app.services.wechat_notify_queue import flush_pending_for_user
    try:
        await asyncio.to_thread(flush_pending_for_user, session, UUID(str(user.id)), True)
    except Exception:  # noqa: BLE001
        logger.exception("inbound flush failed (user=%s)", user.id)

    text = (text or "").strip()
    if not text:
        return ""

    # 1) 引用式指令(平台若回传 [引用:...单号:...]) —— 目前该通道不回传,留作兜底
    cmd = parse_quote_command(text)
    if cmd:
        return await _exec_approval(user, cmd)

    # 2) 编号指令:"通过 1"/"同意第2条"/"拒绝 3 理由:xx"/裸"通过"(仅一条时)
    reply_cmd = parse_action_reply(text)
    if reply_cmd:
        todo_id = reply_cmd.get("todo_id")
        if not todo_id:
            items = _reply_cache_get(binding.account_id or "") if binding.account_id else None
            if reply_cmd.get("index"):
                if items and 1 <= reply_cmd["index"] <= len(items):
                    todo_id = items[reply_cmd["index"] - 1][0]
                else:
                    nums = "、".join(f"{i}.{t}" for i, (_, t) in enumerate(items or [], 1))
                    return f"编号无效。最近的待审批:\n{nums}" if items else "编号已过期,请重新发送\"待办\""
            elif items and len(items) == 1:
                todo_id = items[0][0]  # 只有一条时裸"通过/拒绝"直接作用
            else:
                nums = "、".join(f"{i}.{t}" for i, (_, t) in enumerate(items or [], 1))
                if items:
                    return f"请带编号,如\"通过 1\"。待审批:\n{nums}"
                return "请先发送\"待办\"获取待审批列表,再回复\"通过 编号\""
        return await _exec_approval(user, {"action": reply_cmd["action"], "todo_id": todo_id,
                                           "comment": reply_cmd.get("comment")})

    if _wants_todo_list(text):
        return await _send_todo_list(user, binding)

    return await _llm_reply(user, text)
