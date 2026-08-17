"""add wechat_pending_notification offline queue

Revision ID: 20260817_0001
Revises: 20260708_0001
Create Date: 2026-08-17 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260817_0001"
down_revision = "20260708_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "wechat_pending_notification" in inspector.get_table_names():
        return

    op.create_table(
        "wechat_pending_notification",
        sa.Column("id", sa.CHAR(32), primary_key=True),
        sa.Column("recipient_user_id", sa.CHAR(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("todo_id", sa.CHAR(32), sa.ForeignKey("todo_item.id"), nullable=True),
        sa.Column("event_type", sa.String(64), nullable=False, server_default=""),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_retry_at", sa.DateTime(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_0900_ai_ci",
    )
    op.create_index("ix_wechat_pending_notification_recipient_user_id", "wechat_pending_notification", ["recipient_user_id"])
    op.create_index("ix_wechat_pending_notification_todo_id", "wechat_pending_notification", ["todo_id"])
    op.create_index("ix_wechat_pending_notification_status", "wechat_pending_notification", ["status"])
    op.create_index("ix_wechat_pending_notification_next_retry_at", "wechat_pending_notification", ["next_retry_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "wechat_pending_notification" not in inspector.get_table_names():
        return

    op.drop_index("ix_wechat_pending_notification_next_retry_at", table_name="wechat_pending_notification")
    op.drop_index("ix_wechat_pending_notification_status", table_name="wechat_pending_notification")
    op.drop_index("ix_wechat_pending_notification_todo_id", table_name="wechat_pending_notification")
    op.drop_index("ix_wechat_pending_notification_recipient_user_id", table_name="wechat_pending_notification")
    op.drop_table("wechat_pending_notification")
