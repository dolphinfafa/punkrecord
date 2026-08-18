"""
Shared Models (Audit Log, File Metadata, WeChat)
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Column, JSON, SQLModel
from sqlalchemy import Text
from app.models.base import BaseDBModel, now_cn


class AuditLog(BaseDBModel, table=True):
    """Audit log"""
    __tablename__ = "audit_log"
    
    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    object_type: str = Field(nullable=False, index=True)
    object_id: UUID = Field(nullable=False, index=True)
    action: str = Field(nullable=False)  # create, update, delete, approve, reject, etc.
    changes: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class FileMetadata(BaseDBModel, table=True):
    """File metadata"""
    __tablename__ = "file_metadata"
    
    filename: str = Field(nullable=False)
    content_type: str = Field(nullable=False)
    size: int = Field(nullable=False)
    storage_path: str = Field(nullable=False)
    
    uploaded_by: UUID = Field(foreign_key="users.id", nullable=False)
    
    related_object_type: Optional[str] = None
    related_object_id: Optional[UUID] = None


class SubscribeStatus(str, Enum):
    """WeChat subscribe status"""
    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"


class WeChatUserBinding(BaseDBModel, table=True):
    """WeChat user binding"""
    __tablename__ = "wechat_user_binding"
    
    user_id: UUID = Field(foreign_key="users.id", nullable=False)
    openid: str = Field(nullable=False, unique=True, index=True)
    unionid: Optional[str] = Field(default=None, index=True)
    
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    subscribe_status: SubscribeStatus = Field(default=SubscribeStatus.SUBSCRIBED, nullable=False)


class ChangeLog(BaseDBModel, table=True):
    """Version changelog entry"""
    __tablename__ = "changelog"

    version: str = Field(nullable=False)
    title: str = Field(nullable=False)
    content: str = Field(nullable=False)  # Markdown content
    published_by_user_id: UUID = Field(foreign_key="users.id", nullable=False)
    published_at: datetime = Field(nullable=False)


class WeChatMessageTemplate(BaseDBModel, table=True):
    """WeChat message template"""
    __tablename__ = "wechat_message_template"

    template_code: str = Field(nullable=False, unique=True, index=True)
    wx_template_id: str = Field(nullable=False)
    name: str = Field(nullable=False)
    is_active: bool = Field(default=True, nullable=False)


class AgentToken(BaseDBModel, table=True):
    """Personal access token for AI Agent authentication"""
    __tablename__ = "agent_token"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    token: str = Field(nullable=False, unique=True, index=True)
    name: str = Field(default="", nullable=False)
    expires_at: Optional[datetime] = Field(default=None)
    is_active: bool = Field(default=True, nullable=False)
    last_used_at: Optional[datetime] = Field(default=None)


class WeChatNotifyBinding(BaseDBModel, table=True):
    """WeChat notification binding via weixin-msg-service"""
    __tablename__ = "wechat_notify_binding"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, unique=True, index=True)
    msg_service_key: str = Field(nullable=False, unique=True, index=True)
    account_id: Optional[str] = Field(default=None, index=True)
    nickname: Optional[str] = None
    is_active: bool = Field(default=True, nullable=False)
    preferences: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    # 通道保活跟踪:context_token 自最近一次来信起约 24h 有效
    last_inbound_at: Optional[datetime] = Field(default=None)
    keepalive_notified_at: Optional[datetime] = Field(default=None)


class WeChatPendingStatus(str, Enum):
    """WeChat pending-notification delivery status"""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"    # gave up after max attempts, or permanent error
    DROPPED = "dropped"  # no active binding at flush time


class WeChatPendingNotification(BaseDBModel, table=True):
    """Buffered WeChat notification awaiting delivery (offline queue).

    Stores the fully-rendered push text so a flush is a pure FIFO replay
    without re-rendering against a possibly-changed/deleted todo. The
    msg_service_key is deliberately NOT snapshotted: at flush time we
    re-resolve the recipient's current active binding.
    """
    __tablename__ = "wechat_pending_notification"
    # MySQL FK columns are collation-sensitive: the referenced users.id /
    # todo_item.id use utf8mb4_0900_ai_ci, so this table must match or the
    # FK constraint fails (pymysql 3780 "columns are incompatible").
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_0900_ai_ci"}

    recipient_user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    todo_id: Optional[UUID] = Field(default=None, foreign_key="todo_item.id", index=True)
    event_type: str = Field(default="", nullable=False)
    payload: str = Field(sa_column=Column(Text, nullable=False))
    status: WeChatPendingStatus = Field(default=WeChatPendingStatus.PENDING, nullable=False, index=True)
    retry_count: int = Field(default=0, nullable=False)
    next_retry_at: datetime = Field(default_factory=now_cn, nullable=False, index=True)
    last_error: Optional[str] = None
