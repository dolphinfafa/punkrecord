"""add changelog table for version update logs

Revision ID: 20260331_0001
Revises: 20260320_0001
Create Date: 2026-03-31 10:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260331_0001"
down_revision = "20260320_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "changelog",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("published_by_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("changelog")
