"""add contract attachments

Revision ID: 20260708_0001
Revises: 20260408_0001, 20260624_0001
Create Date: 2026-07-08 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260708_0001"
down_revision = ("20260408_0001", "20260624_0001")
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "contract" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("contract")}
    if "attachments" not in columns:
        op.add_column("contract", sa.Column("attachments", sa.JSON(), nullable=True))
    op.execute("UPDATE contract SET attachments = '[]' WHERE attachments IS NULL")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "contract" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("contract")}
    if "attachments" in columns:
        op.drop_column("contract", "attachments")
