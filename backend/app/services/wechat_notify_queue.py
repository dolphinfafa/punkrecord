"""
WeChat notification offline queue + retry worker.

When the WeChat push channel is down (context_token expired after ~24h without
interaction, or the msg-service is unreachable), notifications are buffered in the
`wechat_pending_notification` table and replayed FIFO once the channel reactivates.

This module deliberately imports nothing from `app.api.*` so it can be used from
both request handlers and a background worker without circular-import risk.
"""
import asyncio
import logging
from datetime import timedelta
from enum import Enum
from typing import Optional
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import engine
from app.models.base import now_cn
from app.models.shared import (
    WeChatNotifyBinding,
    WeChatPendingNotification,
    WeChatPendingStatus,
)

logger = logging.getLogger(__name__)

# Substring the msg-service returns when the push channel needs re-activation.
# Centralized so a wording change upstream is a one-line fix.
_CHANNEL_INACTIVE_MARKER = "激活通知通道"

_SEND_TIMEOUT = 5.0


class SendOutcome(str, Enum):
    """Result class of a single WeChat send attempt."""
    SENT = "sent"
    CHANNEL_INACTIVE = "channel_inactive"  # transient / retryable
    PERMANENT = "permanent"                # no point retrying


def classify_send_result(status_code: int, body: Optional[dict]) -> SendOutcome:
    """Map an /api/send response to a SendOutcome.

    msg-service returns 200 {ok:true} on success and 400 {ok:false,error} on
    failure; the channel-inactive case is identifiable by a marker substring.
    5xx and transport errors are treated as transient (retryable).
    """
    if status_code == 200 and body and body.get("ok") is True:
        return SendOutcome.SENT
    err = str((body or {}).get("error") or (body or {}).get("message") or "")
    if _CHANNEL_INACTIVE_MARKER in err:
        return SendOutcome.CHANNEL_INACTIVE
    if status_code == 0 or status_code >= 500:
        return SendOutcome.CHANNEL_INACTIVE
    return SendOutcome.PERMANENT


def send_wechat_text(key: str, text: str) -> tuple[SendOutcome, Optional[str]]:
    """Send a text message via the msg-service. Never raises; returns (outcome, error)."""
    if not settings.WECHAT_MSG_SERVICE_URL:
        return SendOutcome.PERMANENT, "微信消息服务未配置"
    headers = {"Content-Type": "application/json"}
    if settings.WECHAT_MSG_SERVICE_API_KEY:
        headers["Authorization"] = f"Bearer {settings.WECHAT_MSG_SERVICE_API_KEY}"
    try:
        with httpx.Client(timeout=_SEND_TIMEOUT) as client:
            resp = client.post(
                f"{settings.WECHAT_MSG_SERVICE_URL}/api/send",
                json={"key": key, "text": text},
                headers=headers,
            )
        try:
            body = resp.json()
        except ValueError:
            body = None
        outcome = classify_send_result(resp.status_code, body)
        error = None if outcome is SendOutcome.SENT else (resp.text or f"HTTP {resp.status_code}")
        return outcome, error
    except Exception as e:  # transport error -> transient, retry later
        return SendOutcome.CHANNEL_INACTIVE, str(e)


def enqueue_wechat_notification(
    session: Session,
    recipient_user_id: UUID,
    todo_id: Optional[UUID],
    event_type: str,
    text: str,
    error: Optional[str],
) -> WeChatPendingNotification:
    """Buffer a fully-rendered notification for later delivery. Does not commit."""
    row = WeChatPendingNotification(
        recipient_user_id=recipient_user_id,
        todo_id=todo_id,
        event_type=event_type,
        payload=text,
        status=WeChatPendingStatus.PENDING,
        retry_count=0,
        next_retry_at=now_cn(),
        last_error=error,
    )
    session.add(row)
    return row


def flush_pending_for_user(session: Session, user_id: UUID, force: bool = False) -> dict:
    """Attempt to deliver a user's queued notifications in FIFO order.

    Stops at the first CHANNEL_INACTIVE failure (channel still dead) so the
    remaining rows keep their order for the next cycle. Commits per row.

    ``force=False`` (the retry worker) respects each row's ``next_retry_at``
    backoff schedule; ``force=True`` (the /flush endpoint, fired when the user
    just interacted => channel is live) delivers ALL pending rows immediately,
    ignoring backoff — per the requirement "一旦开通立刻逐条补发".
    """
    now = now_cn()
    binding = session.exec(
        select(WeChatNotifyBinding).where(
            WeChatNotifyBinding.user_id == user_id,
            WeChatNotifyBinding.is_active == True,  # noqa: E712
        )
    ).first()

    if not binding:
        rows = session.exec(
            select(WeChatPendingNotification).where(
                WeChatPendingNotification.recipient_user_id == user_id,
                WeChatPendingNotification.status == WeChatPendingStatus.PENDING,
            )
        ).all()
        for r in rows:
            r.status = WeChatPendingStatus.DROPPED
            r.updated_at = now
            session.add(r)
        session.commit()
        return {"sent": 0, "failed": 0, "dropped": len(rows), "remaining": 0}

    query = select(WeChatPendingNotification).where(
        WeChatPendingNotification.recipient_user_id == user_id,
        WeChatPendingNotification.status == WeChatPendingStatus.PENDING,
    )
    if not force:
        query = query.where(WeChatPendingNotification.next_retry_at <= now)
    rows = session.exec(query.order_by(WeChatPendingNotification.created_at)).all()

    sent = failed = 0
    for row in rows:
        outcome, err = send_wechat_text(binding.msg_service_key, row.payload)
        row.updated_at = now_cn()
        if outcome is SendOutcome.SENT:
            row.status = WeChatPendingStatus.SENT
            row.last_error = None
            sent += 1
            session.add(row)
            session.commit()
        elif outcome is SendOutcome.CHANNEL_INACTIVE:
            row.retry_count += 1
            row.last_error = err
            if row.retry_count >= settings.WECHAT_NOTIFY_MAX_ATTEMPTS:
                row.status = WeChatPendingStatus.FAILED
            else:
                delay = min(
                    settings.WECHAT_NOTIFY_RETRY_INTERVAL_SECONDS * (2 ** row.retry_count),
                    settings.WECHAT_NOTIFY_RETRY_BACKOFF_MAX_SECONDS,
                )
                row.next_retry_at = now_cn() + timedelta(seconds=delay)
            session.add(row)
            session.commit()
            break  # channel still dead -> stop, preserve FIFO for next cycle
        else:  # PERMANENT
            row.status = WeChatPendingStatus.FAILED
            row.last_error = err
            failed += 1
            session.add(row)
            session.commit()

    remaining = len(rows) - sent - failed
    return {"sent": sent, "failed": failed, "dropped": 0, "remaining": max(remaining, 0)}


def retry_cycle() -> None:
    """One pass over all users that have due pending notifications."""
    if not settings.WECHAT_MSG_SERVICE_URL:
        return
    now = now_cn()
    with Session(engine) as session:
        recipient_ids = session.exec(
            select(WeChatPendingNotification.recipient_user_id).where(
                WeChatPendingNotification.status == WeChatPendingStatus.PENDING,
                WeChatPendingNotification.next_retry_at <= now,
            ).distinct()
        ).all()
    for uid in recipient_ids:
        try:
            with Session(engine) as s:
                flush_pending_for_user(s, uid)
        except Exception:
            logger.exception("flush_pending_for_user failed for user %s", uid)


async def wechat_notification_retry_worker() -> None:
    """Background loop: periodically replay due queued notifications.

    The blocking DB + httpx cycle runs in a thread so the event loop is not
    stalled. Cancellation lands at the next ``await`` (the sleep / to_thread).
    """
    logger.info(
        "WeChat notify retry worker started (interval=%ss, max_attempts=%s)",
        settings.WECHAT_NOTIFY_RETRY_INTERVAL_SECONDS,
        settings.WECHAT_NOTIFY_MAX_ATTEMPTS,
    )
    while True:
        try:
            await asyncio.to_thread(retry_cycle)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("WeChat notify retry cycle failed")
        await asyncio.sleep(settings.WECHAT_NOTIFY_RETRY_INTERVAL_SECONDS)
