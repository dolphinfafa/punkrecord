"""add meeting_type to meeting_record

Revision ID: 20260318_0001
Revises: 20260301_0001
Create Date: 2026-03-18 10:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260318_0001"
down_revision = "20260301_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {col["name"] for col in inspector.get_columns("meeting_record")}

    if "meeting_type" not in columns:
        op.add_column(
            "meeting_record",
            sa.Column("meeting_type", sa.String(50), nullable=False, server_default="morning"),
        )
        op.create_index("ix_meeting_record_meeting_type", "meeting_record", ["meeting_type"])


def downgrade() -> None:
    op.drop_index("ix_meeting_record_meeting_type", table_name="meeting_record")
    op.drop_column("meeting_record", "meeting_type")
