"""add wechat_notify_binding table and recipient_user_id to notification_log

Revision ID: 20260408_0001
Revises: 20260331_0001
Create Date: 2026-04-08 10:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260408_0001"
down_revision = "20260331_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wechat_notify_binding",
        sa.Column("id", sa.CHAR(32), primary_key=True),
        sa.Column("user_id", sa.CHAR(32), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("msg_service_key", sa.String(64), nullable=False, unique=True),
        sa.Column("account_id", sa.String(255), nullable=True),
        sa.Column("nickname", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("preferences", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_0900_ai_ci",
    )
    op.create_index("ix_wechat_notify_binding_user_id", "wechat_notify_binding", ["user_id"])
    op.create_index("ix_wechat_notify_binding_msg_service_key", "wechat_notify_binding", ["msg_service_key"])
    op.create_index("ix_wechat_notify_binding_account_id", "wechat_notify_binding", ["account_id"])

    op.add_column(
        "notification_log",
        sa.Column("recipient_user_id", sa.CHAR(32), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_notification_log_recipient_user_id", "notification_log", ["recipient_user_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_log_recipient_user_id", table_name="notification_log")
    op.drop_column("notification_log", "recipient_user_id")
    op.drop_table("wechat_notify_binding")
