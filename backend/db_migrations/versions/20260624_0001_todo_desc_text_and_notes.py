"""todo_item: widen description to TEXT and add notes column

Revision ID: 20260624_0001
Revises: 20260509_0001
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = '20260624_0001'
down_revision = '20260509_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 描述上限 1 万字符：varchar(255) -> TEXT
    op.alter_column(
        'todo_item', 'description',
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )
    # 新增「备注」字段
    op.add_column('todo_item', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('todo_item', 'notes')
    op.alter_column(
        'todo_item', 'description',
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
