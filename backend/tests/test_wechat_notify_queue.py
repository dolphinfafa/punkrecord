from datetime import timedelta
from uuid import uuid4

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app import models  # noqa: F401  (register all tables in metadata)
from app.models.base import now_cn
from app.models.shared import (
    WeChatNotifyBinding,
    WeChatPendingNotification,
    WeChatPendingStatus,
)
from app.services import wechat_notify_queue as q
from app.services.wechat_notify_queue import (
    SendOutcome,
    classify_send_result,
    enqueue_wechat_notification,
    flush_pending_for_user,
)


def _make_session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _bind(session: Session, user_id) -> None:
    session.add(
        WeChatNotifyBinding(
            user_id=user_id,
            msg_service_key="k-" + user_id.hex[:8],
            is_active=True,
        )
    )
    session.commit()


# ─── classify_send_result ────────────────────────────────────────────────────

def test_classify_sent():
    assert classify_send_result(200, {"ok": True}) is SendOutcome.SENT


def test_classify_channel_inactive_by_marker():
    body = {"ok": False, "error": "需要先用微信给 bot 发一条消息以激活通知通道"}
    assert classify_send_result(400, body) is SendOutcome.CHANNEL_INACTIVE


def test_classify_permanent_on_other_400():
    assert classify_send_result(400, {"ok": False, "error": "缺少 key"}) is SendOutcome.PERMANENT


def test_classify_5xx_is_retryable():
    assert classify_send_result(500, None) is SendOutcome.CHANNEL_INACTIVE


# ─── enqueue + flush ─────────────────────────────────────────────────────────

def test_flush_delivers_fifo_when_channel_active(monkeypatch):
    user_id = uuid4()
    with _make_session() as session:
        _bind(session, user_id)
        for i in range(3):
            enqueue_wechat_notification(session, user_id, None, "todo_assigned", f"msg-{i}", None)
        session.commit()

        sent_order = []
        monkeypatch.setattr(
            q, "send_wechat_text",
            lambda key, text: (sent_order.append(text), (SendOutcome.SENT, None))[1],
        )
        result = flush_pending_for_user(session, user_id)

        assert result["sent"] == 3
        assert sent_order == ["msg-0", "msg-1", "msg-2"]
        rows = session.exec(select(WeChatPendingNotification)).all()
        assert all(r.status == WeChatPendingStatus.SENT for r in rows)


def test_flush_stops_and_backs_off_when_channel_inactive(monkeypatch):
    user_id = uuid4()
    with _make_session() as session:
        _bind(session, user_id)
        for i in range(2):
            enqueue_wechat_notification(session, user_id, None, "todo_assigned", f"msg-{i}", None)
        session.commit()

        monkeypatch.setattr(
            q, "send_wechat_text",
            lambda key, text: (SendOutcome.CHANNEL_INACTIVE, "激活通知通道"),
        )
        result = flush_pending_for_user(session, user_id)

        assert result["sent"] == 0
        rows = session.exec(
            select(WeChatPendingNotification).order_by(WeChatPendingNotification.created_at)
        ).all()
        # First row attempted: retry_count bumped, next_retry pushed out, still PENDING.
        assert rows[0].status == WeChatPendingStatus.PENDING
        assert rows[0].retry_count == 1
        assert rows[0].next_retry_at > now_cn()
        # Second row untouched (FIFO stop preserves order).
        assert rows[1].retry_count == 0
        assert rows[1].status == WeChatPendingStatus.PENDING


def test_flush_drops_when_no_active_binding():
    user_id = uuid4()
    with _make_session() as session:
        enqueue_wechat_notification(session, user_id, None, "todo_assigned", "msg-x", None)
        session.commit()

        result = flush_pending_for_user(session, user_id)

        assert result["dropped"] == 1
        row = session.exec(select(WeChatPendingNotification)).one()
        assert row.status == WeChatPendingStatus.DROPPED


def test_force_flush_ignores_backoff_schedule(monkeypatch):
    """flush 端点(force=True)在通道激活后应无视退避调度立即全发。"""
    user_id = uuid4()
    with _make_session() as session:
        _bind(session, user_id)
        row = enqueue_wechat_notification(session, user_id, None, "todo_assigned", "msg-x", None)
        session.commit()
        # 模拟一次未激活 flush 已把 next_retry_at 推到远期
        row.next_retry_at = now_cn() + timedelta(hours=1)
        session.add(row)
        session.commit()

        # force=False(worker 路径):未到期,不选
        result = flush_pending_for_user(session, user_id, force=False)
        assert result["sent"] == 0
        # force=True(flush 端点路径):无视调度,立即发送
        monkeypatch.setattr(
            q, "send_wechat_text",
            lambda key, text: (SendOutcome.SENT, None),
        )
        result = flush_pending_for_user(session, user_id, force=True)
        assert result["sent"] == 1
        session.expire_all()
        rows = session.exec(select(WeChatPendingNotification)).all()
        assert rows[0].status == WeChatPendingStatus.SENT


def test_flush_gives_up_after_max_attempts(monkeypatch):
    user_id = uuid4()
    with _make_session() as session:
        _bind(session, user_id)
        row = enqueue_wechat_notification(session, user_id, None, "todo_assigned", "msg-x", None)
        session.commit()
        # Force retry_count to the threshold so the next failure marks it FAILED.
        row.retry_count = q.settings.WECHAT_NOTIFY_MAX_ATTEMPTS - 1
        session.add(row)
        session.commit()

        monkeypatch.setattr(
            q, "send_wechat_text",
            lambda key, text: (SendOutcome.CHANNEL_INACTIVE, "激活通知通道"),
        )
        flush_pending_for_user(session, user_id)

        session.expire_all()
        row = session.exec(select(WeChatPendingNotification)).one()
        assert row.status == WeChatPendingStatus.FAILED
