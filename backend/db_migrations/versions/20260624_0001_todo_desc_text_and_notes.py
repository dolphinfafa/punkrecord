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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'todo_item' not in inspector.get_table_names():
        return

    columns = {c['name']: c for c in inspector.get_columns('todo_item')}

    # 描述上限 1 万字符：varchar(255) -> TEXT(已是 TEXT 则跳过)
    if 'description' in columns and not isinstance(columns['description']['type'], sa.Text):
        op.alter_column(
            'todo_item', 'description',
            existing_type=sa.String(length=255),
            type_=sa.Text(),
            existing_nullable=True,
        )
    # 新增「备注」字段(已存在则跳过)
    if 'notes' not in columns:
        op.add_column('todo_item', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'todo_item' not in inspector.get_table_names():
        return
    columns = {c['name']: c for c in inspector.get_columns('todo_item')}
    if 'notes' in columns:
        op.drop_column('todo_item', 'notes')
    if 'description' in columns and isinstance(columns['description']['type'], sa.Text):
        op.alter_column(
            'todo_item', 'description',
            existing_type=sa.Text(),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
