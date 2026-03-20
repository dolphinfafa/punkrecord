"""make project.our_entity_id nullable for B2C projects

Revision ID: 20260320_0001
Revises: 20260318_0001
Create Date: 2026-03-20 10:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260320_0001"
down_revision = "20260318_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make our_entity_id nullable on the project table (B2C projects may not have one)
    op.alter_column(
        "project",
        "our_entity_id",
        existing_type=sa.String(36),  # UUID stored as CHAR(36) in MySQL
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "project",
        "our_entity_id",
        existing_type=sa.String(36),
        nullable=False,
    )
