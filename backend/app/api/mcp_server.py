"""
PunkRecord MCP server (Streamable HTTP).

Exposes a curated set of PunkRecord operations as MCP tools so AI clients
(Claude Desktop/Code, Cursor, Cherry Studio, ...) can act on the user's behalf.

Auth: the client sends `Authorization: Bearer pat_xxx` (a PunkRecord Agent Token).
Each tool forwards that token to the local REST API in-process, so permissions,
notifications and all business rules stay identical to the web app — zero logic
duplication.
"""
import logging
import base64
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP, Context
from mcp.server.transport_security import TransportSecuritySettings

from app.core.config import settings

logger = logging.getLogger(__name__)

# streamable_http_path="/" so mounting at /api/v1/mcp serves the endpoint exactly there.
# Disable DNS-rebinding Host/Origin checks: this is a public, token-authenticated
# endpoint reached through nginx/Caddy under various hostnames (otherwise the SDK
# returns "421 Invalid Host header" for any non-localhost Host).
mcp = FastMCP(
    "punkrecord",
    stateless_http=True,
    streamable_http_path="/",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


class AuthError(Exception):
    """Raised when the MCP request lacks a valid PunkRecord Agent Token."""


def _extract_token(ctx: Context) -> str:
    """Pull the `pat_` Agent Token out of the request's Authorization header."""
    auth = None
    try:
        request = ctx.request_context.request
        if request is not None:
            auth = request.headers.get("authorization") or request.headers.get("Authorization")
    except Exception:  # pragma: no cover - defensive
        auth = None

    if not auth:
        raise AuthError(
            "缺少 Authorization 头。请在 MCP 客户端配置 "
            "'Authorization: Bearer pat_你的PunkRecord密钥'。"
        )

    token = auth[7:].strip() if auth[:7].lower() == "bearer " else auth.strip()
    if not token.startswith("pat_"):
        raise AuthError("无效的 API Key（应为 pat_ 开头的 PunkRecord Agent Token）。")
    return token


async def _call(
    ctx: Context,
    method: str,
    path: str,
    *,
    params: Optional[dict] = None,
    json: Optional[dict] = None,
    files: Optional[dict] = None,
):
    """Forward the call to the local REST API with the caller's token."""
    token = _extract_token(ctx)
    url = settings.INTERNAL_API_BASE_URL.rstrip("/") + path
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.request(method, url, params=params, json=json, files=files, headers=headers)

    try:
        body = resp.json()
    except Exception:
        if resp.status_code >= 400:
            raise RuntimeError(f"请求失败（HTTP {resp.status_code}）")
        return {"raw": resp.text}

    if resp.status_code >= 400:
        msg = None
        if isinstance(body, dict):
            msg = body.get("message") or body.get("detail")
        raise RuntimeError(str(msg) if msg else f"请求失败（HTTP {resp.status_code}）")

    # REST envelope is {code, message, data}; return the payload.
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


def _attachment_urls(contract_id: str, attachment_id: str) -> dict:
    base = f"/api/v1/contract/contracts/{contract_id}/attachments/{attachment_id}"
    return {
        "view_path": f"{base}/view",
        "download_path": f"{base}/download",
    }


def _attach_contract_urls(contract_id: str, attachment: dict) -> dict:
    if not isinstance(attachment, dict):
        return attachment
    attachment_id = attachment.get("id")
    if attachment_id:
        return {**attachment, **_attachment_urls(contract_id, attachment_id)}
    return attachment


# ─── Read tools ───────────────────────────────────────────────────────────────

@mcp.tool()
async def get_me(ctx: Context) -> dict:
    """获取当前 API Key 对应的用户信息与权限（id、姓名、permissions 等）。建议先调用以确认身份。"""
    return await _call(ctx, "GET", "/auth/me")


@mcp.tool()
async def list_my_todos(ctx: Context, status: Optional[str] = None, page_size: int = 20) -> dict:
    """查看我的待办任务列表。status 可选：open/in_progress/pending_review/done/blocked/dismissed。"""
    return await _call(ctx, "GET", "/todo/my", params={"status": status, "page_size": page_size})


@mcp.tool()
async def get_todo(ctx: Context, todo_id: str) -> dict:
    """查看某个任务的详情（含 link.todo_images 图片元数据）。"""
    return await _call(ctx, "GET", f"/todo/{todo_id}")


@mcp.tool()
async def list_todo_images(ctx: Context, todo_id: str) -> dict:
    """列出某个任务的全部图片（含 download_path 下载路径）。"""
    return await _call(ctx, "GET", f"/todo/{todo_id}/images")


@mcp.tool()
async def list_my_leaves(ctx: Context, status: Optional[str] = None) -> dict:
    """查看我的请假记录。status 可选：pending/approved/rejected。"""
    return await _call(ctx, "GET", "/todo/leaves/my", params={"status": status})


@mcp.tool()
async def list_projects(ctx: Context, status: Optional[str] = None, page_size: int = 20) -> dict:
    """查看项目列表。status 可选：active/archived 等。"""
    return await _call(ctx, "GET", "/project/projects", params={"status": status, "page_size": page_size})


@mcp.tool()
async def get_project(ctx: Context, project_id: str) -> dict:
    """查看项目详情。"""
    return await _call(ctx, "GET", f"/project/projects/{project_id}")


@mcp.tool()
async def list_project_todos(ctx: Context, project_id: str) -> dict:
    """查看某个项目下的全部任务。"""
    return await _call(ctx, "GET", f"/project/projects/{project_id}/todos")


@mcp.tool()
async def list_contracts(ctx: Context, status: Optional[str] = None, page_size: int = 20) -> dict:
    """查看合同列表（需 contract.read 权限）。"""
    return await _call(ctx, "GET", "/contract/contracts", params={"status": status, "page_size": page_size})


@mcp.tool()
async def get_contract(ctx: Context, contract_id: str) -> dict:
    """查看合同详情（需 contract.read 权限），返回基础信息和附件元数据。"""
    data = await _call(ctx, "GET", f"/contract/contracts/{contract_id}")
    if isinstance(data, dict):
        attachments = data.get("attachments") or []
        data["attachments"] = [_attach_contract_urls(contract_id, item) for item in attachments]
    return data


@mcp.tool()
async def list_contract_attachments(ctx: Context, contract_id: str) -> dict:
    """列出某个合同的附件（PDF/图片），返回 view_path/download_path 供查看或下载。"""
    attachments = await _call(ctx, "GET", f"/contract/contracts/{contract_id}/attachments")
    if isinstance(attachments, list):
        return {
            "items": [_attach_contract_urls(contract_id, item) for item in attachments],
            "total": len(attachments),
        }
    return attachments


@mcp.tool()
async def list_counterparties(ctx: Context, page_size: int = 20) -> dict:
    """查看交易方（对手方）列表。"""
    return await _call(ctx, "GET", "/contract/counterparties", params={"page_size": page_size})


@mcp.tool()
async def list_transactions(
    ctx: Context,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account_id: Optional[str] = None,
    txn_direction: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """查看财务交易记录（需 finance.read 权限）。

    - 日期格式：YYYY-MM-DD。
    - txn_direction：in / out。
    - status：unreconciled / completed / reconciled / voided；voided 表示作废交易。
    - account_id：财务账户 UUID，可先用 list_accounts 获取。
    """
    return await _call(
        ctx, "GET", "/finance/transactions",
        params={
            "date_from": date_from,
            "date_to": date_to,
            "account_id": account_id,
            "txn_direction": txn_direction,
            "status": status,
            "page": page,
            "page_size": page_size,
        },
    )


@mcp.tool()
async def search_kb(ctx: Context, query: str, top_k: int = 5) -> dict:
    """在企业知识库做语义搜索（需 kb.read 权限）。"""
    return await _call(ctx, "POST", "/kb/search", json={"query": query, "top_k": top_k})


@mcp.tool()
async def list_meetings(ctx: Context, search: Optional[str] = None, page_size: int = 10) -> dict:
    """查看会议记录列表（需 meeting.read 权限）。search 可按标题/参会人搜索。"""
    return await _call(ctx, "GET", "/meeting/records", params={"search": search, "page_size": page_size})


@mcp.tool()
async def get_meeting(ctx: Context, meeting_id: str) -> dict:
    """查看会议详情（需 meeting.read 权限），包含音频状态、说话人映射、纪要等。"""
    return await _call(ctx, "GET", f"/meeting/records/{meeting_id}")


@mcp.tool()
async def get_meeting_transcript(ctx: Context, meeting_id: str) -> dict:
    """查看会议转写分段（需 meeting.read 权限）。"""
    segments = await _call(ctx, "GET", f"/meeting/records/{meeting_id}/transcript")
    if isinstance(segments, list):
        return {"items": segments, "total": len(segments)}
    return segments


# ─── Write tools ──────────────────────────────────────────────────────────────

@mcp.tool()
async def create_todo(
    ctx: Context,
    title: str,
    assignee_user_id: str,
    priority: str = "p2",
    due_at: Optional[str] = None,
    description: Optional[str] = None,
    project_name: Optional[str] = None,
    project_id: Optional[str] = None,
    dev_type: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> dict:
    """创建任务。

    - assignee_user_id：执行人用户 UUID（可先用 get_me 或 list 接口获取）。
    - priority：p0-p3（默认 p2）；due_at：ISO 时间，如 2026-06-10T18:00:00。
    - 关联项目（任选其一）：project_name（项目名精确匹配）或 project_id；
      dev_type 任务类型：dev_backend/dev_frontend/dev_ui/dev_product/other。
    - tags：标签数组。
    """
    link: dict = {}
    if project_id:
        link["project_id"] = project_id
    if project_name:
        link["project_name"] = project_name
    if dev_type:
        link["dev_type"] = dev_type

    body: dict = {"title": title, "assignee_user_id": assignee_user_id, "priority": priority}
    if due_at:
        body["due_at"] = due_at
    if description:
        body["description"] = description
    if tags:
        body["tags"] = tags
    if link:
        body["link"] = link
    return await _call(ctx, "POST", "/todo", json=body)


@mcp.tool()
async def create_bug(
    ctx: Context,
    title: str,
    project_name: Optional[str] = None,
    project_id: Optional[str] = None,
    description: Optional[str] = None,
    actual_result: Optional[str] = None,
    expected_result: Optional[str] = None,
    reproduce_steps: Optional[str] = None,
    priority: str = "p2",
    assignee_user_id: Optional[str] = None,
) -> dict:
    """在项目中创建一个 Bug（会同时出现在项目任务与「Bug 管理」）。

    - 必须关联项目：project_name（精确匹配）或 project_id 二选一。
    - actual_result（实际表现）/expected_result（期望行为）/reproduce_steps（复现步骤）选填。
    - assignee_user_id 缺省时分配给当前 API Key 对应用户。
    - 通过打 tags=["bug"] 与 link.type="bug" 使其被识别为 Bug。
    """
    if not project_name and not project_id:
        raise RuntimeError("创建 Bug 必须指定 project_name 或 project_id")

    if not assignee_user_id:
        me = await _call(ctx, "GET", "/auth/me")
        assignee_user_id = me.get("id") if isinstance(me, dict) else None

    link: dict = {"type": "bug"}
    if project_id:
        link["project_id"] = project_id
    if project_name:
        link["project_name"] = project_name
    if actual_result:
        link["actual_result"] = actual_result
    if expected_result:
        link["expected_result"] = expected_result
    if reproduce_steps:
        link["reproduce_steps"] = reproduce_steps

    body: dict = {
        "title": title,
        "assignee_user_id": assignee_user_id,
        "priority": priority,
        "tags": ["bug"],
        "link": link,
    }
    if description:
        body["description"] = description
    return await _call(ctx, "POST", "/todo", json=body)


@mcp.tool()
async def start_todo(ctx: Context, todo_id: str) -> dict:
    """开始任务（open → in_progress）。"""
    return await _call(ctx, "POST", f"/todo/{todo_id}/start")


@mcp.tool()
async def submit_todo(ctx: Context, todo_id: str) -> dict:
    """提交任务完成（有审核人则进入待审核，否则直接完成）。"""
    return await _call(ctx, "POST", f"/todo/{todo_id}/submit")


@mcp.tool()
async def block_todo(ctx: Context, todo_id: str, blocked_reason: str) -> dict:
    """阻塞任务，需说明原因。"""
    return await _call(ctx, "POST", f"/todo/{todo_id}/block", json={"blocked_reason": blocked_reason})


@mcp.tool()
async def dismiss_todo(ctx: Context, todo_id: str, dismiss_reason: Optional[str] = None) -> dict:
    """忽略任务，可附原因。"""
    return await _call(ctx, "POST", f"/todo/{todo_id}/dismiss", json={"dismiss_reason": dismiss_reason})


# ─── Review tools (team tasks awaiting my review) ─────────────────────────────

@mcp.tool()
async def list_tasks_to_review(ctx: Context) -> dict:
    """查看团队任务中【需要我审核】的任务（下属上报完成、待我审批的 pending_review 任务）。"""
    me = await _call(ctx, "GET", "/auth/me")
    my_id = me.get("id") if isinstance(me, dict) else None
    return await _call(
        ctx, "GET", "/todo/team",
        params={"status": "pending_review", "reviewed_by_user_id": my_id, "page_size": 50},
    )


@mcp.tool()
async def approve_todo(ctx: Context, todo_id: str, comment: Optional[str] = None) -> dict:
    """审核通过某个待我审核的任务（pending_review → done）。comment 为可选审批意见。"""
    return await _call(ctx, "POST", f"/todo/{todo_id}/approve", json={"comment": comment})


@mcp.tool()
async def reject_todo(ctx: Context, todo_id: str, comment: str) -> dict:
    """审核驳回某个待我审核的任务（打回为未开始 open）。comment 为驳回理由（必填）。"""
    return await _call(ctx, "POST", f"/todo/{todo_id}/reject", json={"comment": comment})


@mcp.tool()
async def create_leave(
    ctx: Context, leave_type: str, start_at: str, end_at: str, reason: Optional[str] = None
) -> dict:
    """提交请假申请。

    - leave_type：annual/maternity/marriage/personal/sick。
    - 时间格式：上午用 T10:00:00/T12:00:00，下午用 T14:00:00/T19:00:00。
      例：请一天 start_at=2026-06-10T10:00:00，end_at=2026-06-10T19:00:00。
    """
    body = {"leave_type": leave_type, "start_at": start_at, "end_at": end_at}
    if reason:
        body["reason"] = reason
    return await _call(ctx, "POST", "/todo/leaves", json=body)


# ─── Contract write tools ─────────────────────────────────────────────────────

@mcp.tool()
async def upload_contract_attachment(
    ctx: Context,
    contract_id: str,
    file_name: str,
    content_base64: str,
    content_type: str = "application/pdf",
) -> dict:
    """上传合同附件（需 contract.write 权限）。

    - contract_id：合同 UUID。
    - file_name：原始文件名，后缀应为 .pdf 或图片格式。
    - content_base64：文件内容的 Base64 字符串。
    - content_type：application/pdf 或 image/png/image/jpeg 等。
    单个文件大小仍受 REST 接口 20MB 限制。
    """
    if not file_name:
        raise RuntimeError("file_name 不能为空。")
    try:
        file_bytes = base64.b64decode(content_base64, validate=True)
    except Exception as exc:
        raise RuntimeError("content_base64 不是有效的 Base64 文件内容。") from exc
    if not file_bytes:
        raise RuntimeError("文件内容不能为空。")

    files = {"file": (file_name, file_bytes, content_type)}
    attachment = await _call(
        ctx,
        "POST",
        f"/contract/contracts/{contract_id}/attachments",
        files=files,
    )
    if isinstance(attachment, dict):
        return _attach_contract_urls(contract_id, attachment)
    return attachment


@mcp.tool()
async def delete_contract_attachment(ctx: Context, contract_id: str, attachment_id: str) -> dict:
    """删除某个合同附件（需 contract.write 权限）。"""
    return await _call(ctx, "DELETE", f"/contract/contracts/{contract_id}/attachments/{attachment_id}")


@mcp.tool()
async def retranscribe_meeting(ctx: Context, meeting_id: str) -> dict:
    """重新转写已有音频的会议（需 meeting.write 权限）。

    新 ASR 成功后会替换当前转写分段；如果 ASR 失败，旧分段会保留。
    """
    return await _call(ctx, "POST", f"/meeting/records/{meeting_id}/retranscribe")


# ─── Finance write tools ──────────────────────────────────────────────────────

# 允许批量写入时直接透传给 REST 层的字段（白名单，避免误传无关键值）。
_TXN_ALLOWED_FIELDS = {
    "account_id", "our_entity_id", "txn_type", "txn_direction", "amount",
    "currency", "txn_date", "counterparty_id", "employee_user_id",
    "contract_id", "purpose", "channel", "reference_no", "reconcile_status",
}


@mcp.tool()
async def list_accounts(ctx: Context, page: int = 1, page_size: int = 50) -> dict:
    """查看财务账户列表（需 finance.read 权限）。

    返回各账户的 id、名称、币种、当前余额等。批量写入交易前，先用本工具
    拿到目标账户的 account_id（create_transactions 的必填字段）。
    """
    return await _call(
        ctx, "GET", "/finance/accounts",
        params={"page": page, "page_size": page_size},
    )


@mcp.tool()
async def create_transactions(ctx: Context, transactions: list[dict]) -> dict:
    """批量写入财务交易明细（需 finance.write 权限）。一次提交多条，逐条创建，互不影响。

    transactions：交易对象数组，每个对象支持以下字段：
    - account_id（必填）：账户 UUID，可先用 list_accounts 获取。
    - amount（必填）：金额，正数。
    - txn_date（必填）：交易日期，格式 YYYY-MM-DD。
    - txn_type：receipt（收款）/ payment（付款，默认）/ reimbursement（报销）。
    - txn_direction：in / out。省略时按 txn_type 自动推断
      （receipt→in，payment/reimbursement→out）。
    - currency：币种，默认 CNY。
    - counterparty_id：交易方 UUID（收/付款用，可用 list_counterparties 获取）。
    - employee_user_id：报销人 UUID（仅 reimbursement 用）。
    - contract_id：关联合同 UUID（选填，会自动更新合同待收/待付金额）。
    - purpose：用途/摘要；channel：渠道；reference_no：流水号；
      reconcile_status：unreconciled（默认）/ completed / reconciled。

    示例 transactions：
      [{"account_id": "...", "amount": 1200, "txn_date": "2026-06-24",
        "txn_type": "payment", "purpose": "办公用品采购"}]

    返回 {total, created, failed, results}，results 按输入顺序逐条给出
    {index, success, id|error}，便于定位失败行。
    """
    if not isinstance(transactions, list):
        raise RuntimeError("transactions 必须是交易对象数组。")
    if not transactions:
        raise RuntimeError("transactions 不能为空，至少传入一条交易。")

    results: list[dict] = []
    created = 0
    for index, raw in enumerate(transactions):
        if not isinstance(raw, dict):
            results.append({"index": index, "success": False, "error": "该条不是有效的交易对象。"})
            continue

        # 仅透传白名单字段，并按 txn_type 兜底推断 txn_direction（REST 层会再次校正）。
        body = {k: v for k, v in raw.items() if k in _TXN_ALLOWED_FIELDS and v is not None}
        if not body.get("txn_direction"):
            txn_type = body.get("txn_type", "payment")
            body["txn_direction"] = "in" if txn_type == "receipt" else "out"

        try:
            data = await _call(ctx, "POST", "/finance/transactions", json=body)
            txn_id = data.get("id") if isinstance(data, dict) else None
            results.append({"index": index, "success": True, "id": txn_id})
            created += 1
        except Exception as exc:  # 单条失败不中断整批
            results.append({"index": index, "success": False, "error": str(exc)})

    return {
        "total": len(transactions),
        "created": created,
        "failed": len(transactions) - created,
        "results": results,
    }


@mcp.tool()
async def void_transaction(ctx: Context, txn_id: str) -> dict:
    """作废一条财务交易（需 finance.write 权限）。

    作废后交易仍会保留并可通过 list_transactions(status="voided") 查询，
    但不再计入账户余额；如有关联合同，会同步回退合同待收/待付金额。
    """
    return await _call(ctx, "POST", f"/finance/transactions/{txn_id}/void")


@mcp.tool()
async def unvoid_transaction(ctx: Context, txn_id: str) -> dict:
    """恢复一条已作废的财务交易（需 finance.write 权限）。"""
    return await _call(ctx, "POST", f"/finance/transactions/{txn_id}/unvoid")


@mcp.tool()
async def delete_voided_transaction(ctx: Context, txn_id: str) -> dict:
    """永久删除一条已作废的财务交易（需 finance.write 权限）。

    仅允许删除 voided=true 的交易；正常交易必须先调用 void_transaction 作废，
    再调用本工具删除，避免误删有效流水。
    """
    return await _call(ctx, "DELETE", f"/finance/transactions/{txn_id}")
