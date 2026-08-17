"""widen notification_log.channel enum to include WECHAT

The notification_log table predates the WECHAT channel: its `channel` column is
ENUM('IN_APP','EMAIL','WEBHOOK'), so any attempt to log a WeChat send raised
"Data truncated for column 'channel'" and silently rolled back the notification
log rows. Add WECHAT to the enum set.

Revision ID: 20260817_0002
Revises: 20260817_0001
Create Date: 2026-08-17 11:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260817_0002"
down_revision = "20260817_0001"
branch_labels = None
depends_on = None

# 目标枚举集合(与 models/todo.py 的 NotificationChannel 名称一致,本库存枚举名)
_TARGET = "ENUM('IN_APP','EMAIL','WEBHOOK','WECHAT')"


def _current_enum_ddl(bind) -> str:
    return bind.execute(
        sa.text(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='notification_log' AND COLUMN_NAME='channel'"
        )
    ).scalar() or ""


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "notification_log" not in inspector.get_table_names():
        return
    if "WECHAT" in _current_enum_ddl(bind):
        return  # 已包含,幂等跳过
    op.execute(
        f"ALTER TABLE notification_log MODIFY COLUMN channel {_TARGET} NOT NULL"
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "notification_log" not in inspector.get_table_names():
        return
    # 仅当没有任何 WECHAT 行时才可安全收窄
    has_wechat = bind.execute(
        sa.text("SELECT COUNT(*) FROM notification_log WHERE channel='WECHAT'")
    ).scalar()
    if has_wechat:
        return
    op.execute(
        "ALTER TABLE notification_log MODIFY COLUMN channel ENUM('IN_APP','EMAIL','WEBHOOK') NOT NULL"
    )
