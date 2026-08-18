"""wechat_notify_binding: add last_inbound_at / keepalive_notified_at

Track when the user last messaged the bot (context_token ≈24h validity) so the
backend can push a keepalive reminder ~1h before the push channel expires.

Revision ID: 20260818_0001
Revises: 20260817_0002
Create Date: 2026-08-18 19:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260818_0001"
down_revision = "20260817_0002"
branch_labels = None
depends_on = None

_NEW_COLUMNS = ("last_inbound_at", "keepalive_notified_at")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "wechat_notify_binding" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("wechat_notify_binding")}
    for name in _NEW_COLUMNS:
        if name not in columns:
            op.add_column("wechat_notify_binding", sa.Column(name, sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "wechat_notify_binding" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("wechat_notify_binding")}
    for name in _NEW_COLUMNS:
        if name in columns:
            op.drop_column("wechat_notify_binding", name)
