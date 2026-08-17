"""
WeChat Notification API endpoints
Proxies requests to weixin-msg-service for QR binding and message sending.
"""
import httpx
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Header
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.exceptions import ValidationException, NotFoundException
from app.core.response import success_response
from app.models.base import now_cn
from app.models.iam import User
from app.models.shared import WeChatNotifyBinding

VALID_PREF_KEYS = {
    "todo_assigned",
    "todo_created_notify_manager",
    "todo_submitted",
    "todo_pending_review",
    "leave_approval_pending",
    "todo_approved",
    "todo_rejected",
    "todo_reassigned",
    "todo_reopened",
    "todo_blocked",
    "todo_done_direct",
}

router = APIRouter(prefix="/wechat-notify", tags=["WeChat Notification"])

MSG_TIMEOUT = 10.0


def _service_url(path: str) -> str:
    return f"{settings.WECHAT_MSG_SERVICE_URL}{path}"


def _service_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if settings.WECHAT_MSG_SERVICE_API_KEY:
        headers["Authorization"] = f"Bearer {settings.WECHAT_MSG_SERVICE_API_KEY}"
    return headers


def _check_service_configured():
    if not settings.WECHAT_MSG_SERVICE_URL:
        raise ValidationException("微信消息服务未配置")


@router.get("/binding", response_model=dict)
async def get_binding(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get current user's WeChat notification binding status"""
    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == current_user.id,
            WeChatNotifyBinding.is_active == True,
        )
    ).first()

    if not binding:
        return success_response(None)

    return success_response({
        "id": str(binding.id),
        "account_id": binding.account_id,
        "nickname": binding.nickname,
        "is_active": binding.is_active,
        "created_at": binding.created_at.isoformat() if binding.created_at else None,
        "preferences": binding.preferences,
    })


@router.post("/bind/start", response_model=dict)
async def start_bind(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Start QR code binding session"""
    _check_service_configured()

    existing = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == current_user.id,
            WeChatNotifyBinding.is_active == True,
        )
    ).first()
    if existing:
        raise ValidationException("已绑定微信，请先解绑")

    try:
        with httpx.Client(timeout=MSG_TIMEOUT) as client:
            resp = client.post(_service_url("/api/bind"), headers=_service_headers())
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise ValidationException(f"微信消息服务不可用: {e}")

    return success_response({
        "sessionId": data.get("sessionId"),
        "qrUrl": data.get("qrUrl"),
        "expiresIn": data.get("expiresIn", 300),
    })


@router.get("/bind/status/{session_id}", response_model=dict)
async def check_bind_status(
    session_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Poll binding session status"""
    _check_service_configured()

    try:
        with httpx.Client(timeout=MSG_TIMEOUT) as client:
            resp = client.get(
                _service_url(f"/api/bind/{session_id}"),
                headers=_service_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise ValidationException(f"微信消息服务不可用: {e}")

    status = data.get("status")

    if status == "confirmed":
        key = data.get("key")
        account_id = data.get("accountId")

        if not key:
            raise ValidationException("绑定失败：未获取到 key")

        # Check uniqueness: same key not bound to another user
        existing_key = session.exec(
            select(WeChatNotifyBinding).where(
                WeChatNotifyBinding.msg_service_key == key,
                WeChatNotifyBinding.user_id != current_user.id,
            )
        ).first()
        if existing_key:
            raise ValidationException("该微信已绑定其他用户，请使用其他微信")

        # Check if user already has a binding (race condition guard)
        existing_user = session.exec(
            select(WeChatNotifyBinding).where(
                WeChatNotifyBinding.user_id == current_user.id,
            )
        ).first()

        if existing_user:
            existing_user.msg_service_key = key
            existing_user.account_id = account_id
            existing_user.is_active = True
            existing_user.updated_at = now_cn()
            session.add(existing_user)
        else:
            binding = WeChatNotifyBinding(
                user_id=current_user.id,
                msg_service_key=key,
                account_id=account_id,
                is_active=True,
            )
            session.add(binding)

        session.commit()

    return success_response({
        "status": status,
        "message": data.get("message", ""),
    })


@router.delete("/unbind", response_model=dict)
async def unbind(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Unbind WeChat notification"""
    _check_service_configured()

    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == current_user.id,
            WeChatNotifyBinding.is_active == True,
        )
    ).first()
    if not binding:
        raise NotFoundException("未找到绑定记录")

    # Call msg-service to deactivate
    try:
        with httpx.Client(timeout=MSG_TIMEOUT) as client:
            client.delete(
                _service_url(f"/api/accounts/{binding.msg_service_key}"),
                headers=_service_headers(),
            )
    except httpx.HTTPError:
        pass  # Best-effort: even if msg-service fails, we still remove local binding

    session.delete(binding)
    session.commit()

    return success_response({"unbound": True})


@router.post("/test", response_model=dict)
async def send_test(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Send a test message to the bound WeChat"""
    _check_service_configured()

    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == current_user.id,
            WeChatNotifyBinding.is_active == True,
        )
    ).first()
    if not binding:
        raise NotFoundException("未绑定微信，请先扫码绑定")

    try:
        with httpx.Client(timeout=MSG_TIMEOUT) as client:
            resp = client.post(
                _service_url("/api/send"),
                json={"key": binding.msg_service_key, "text": "PunkRecord 测试消息：微信通知绑定成功！"},
                headers=_service_headers(),
            )
            data = resp.json()
    except httpx.HTTPError as e:
        raise ValidationException(f"发送失败: {e}")

    if not data.get("ok"):
        raise ValidationException(data.get("error", "发送失败"))

    return success_response({"sent": True})


class PreferencesUpdate(BaseModel):
    preferences: dict


@router.put("/preferences", response_model=dict)
async def update_preferences(
    data: PreferencesUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update notification preferences for bound WeChat"""
    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == current_user.id,
            WeChatNotifyBinding.is_active == True,
        )
    ).first()
    if not binding:
        raise NotFoundException("未绑定微信，请先扫码绑定")

    cleaned = {k: bool(v) for k, v in data.preferences.items() if k in VALID_PREF_KEYS}
    binding.preferences = cleaned
    binding.updated_at = now_cn()
    session.add(binding)
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(binding, "preferences")
    session.commit()

    return success_response({"preferences": cleaned})


def send_wechat_notification(key: str, text: str) -> bool:
    """Send a WeChat notification. Returns True on success. Used by notification system."""
    if not settings.WECHAT_MSG_SERVICE_URL:
        return False
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                _service_url("/api/send"),
                json={"key": key, "text": text},
                headers=_service_headers(),
            )
            return resp.status_code == 200 and resp.json().get("ok", False)
    except Exception:
        return False


class FlushRequest(BaseModel):
    user_id: Optional[str] = None       # default: caller's own queue
    account_id: Optional[str] = None    # alternative: resolve via binding


class InboundMessage(BaseModel):
    """weixin-msg-service 转发来的入站微信消息。"""
    account_id: str                     # msg-service 侧的机器人账号 ID → 定位绑定
    text: str
    conversation_id: Optional[str] = None


@router.post("/inbound", response_model=dict)
async def wechat_inbound(
    data: InboundMessage,
    x_inbound_secret: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
):
    """接收 msg-service 转发的入站消息,理解并执行,返回回复文本。

    服务器间接口:用 WECHAT_INBOUND_SECRET 共享密钥鉴权(配置后必填)。
    处理逻辑见 app/services/wechat_inbound.py:
    引用+通过/拒绝 → 审批;"待办" → 逐条推送待办;其余 → LiteLLM 对话。
    """
    if settings.WECHAT_INBOUND_SECRET and x_inbound_secret != settings.WECHAT_INBOUND_SECRET:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("Invalid inbound secret")

    from app.services.wechat_inbound import handle_wechat_inbound
    from app.models.iam import User

    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.account_id == data.account_id,
            WeChatNotifyBinding.is_active == True,  # noqa: E712
        )
    ).first()
    if not binding:
        # 该微信账号没绑定任何 punkrecord 用户:静默
        return success_response({"reply": ""})

    user = session.get(User, binding.user_id)
    if not user:
        return success_response({"reply": ""})

    reply = await handle_wechat_inbound(session, user, binding, data.text)
    return success_response({"reply": reply})


@router.post("/flush", response_model=dict)
async def flush_pending(
    data: FlushRequest = FlushRequest(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Flush queued (offline-buffered) WeChat notifications.

    Called by the WeChat bot whenever it receives any inbound message — that
    inbound is the signal that the user's push channel (context_token) has been
    reactivated, so buffered messages can be delivered immediately instead of
    waiting for the retry worker's interval. Accepts a pat_ agent token.

    Not sensitive: it can only cause already-queued messages to be delivered to
    their rightful recipients, so any authenticated caller may trigger a flush
    (worst case is premature delivery of one's own pending messages).
    """
    from app.services.wechat_notify_queue import flush_pending_for_user

    target_id = current_user.id
    if data.account_id:
        binding = session.exec(
            select(WeChatNotifyBinding).where(
                WeChatNotifyBinding.account_id == data.account_id,
                WeChatNotifyBinding.is_active == True,  # noqa: E712
            )
        ).first()
        if binding:
            target_id = binding.user_id
    elif data.user_id:
        try:
            target_id = UUID(data.user_id)
        except (ValueError, TypeError):
            raise ValidationException("无效的 user_id")

    result = flush_pending_for_user(session, target_id, force=True)
    return success_response(result)
