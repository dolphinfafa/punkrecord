"""Default new task hours to zero and bound automatic reward backfill."""
from alembic import op
import sqlalchemy as sa

from app.models.base import now_cn

revision = '20261016_0003'
down_revision = '20261016_0002'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'hours_rule_starts_at' not in {c['name'] for c in sa.inspect(bind).get_columns('beli_policy')}:
        op.add_column('beli_policy', sa.Column('hours_rule_starts_at', sa.DateTime(), nullable=True))
    policy = sa.table('beli_policy', sa.column('hours_rule_starts_at', sa.DateTime()))
    bind.execute(policy.update().where(policy.c.hours_rule_starts_at.is_(None)).values(hours_rule_starts_at=now_cn()))
    with op.batch_alter_table('todo_item') as batch:
        batch.alter_column('estimated_hours', existing_type=sa.Numeric(10, 2), existing_nullable=True,
                           server_default=sa.text('0'))


def downgrade():
    raise RuntimeError('Reward eligibility history must be retained; restore the development backup instead.')
