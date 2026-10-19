"""Keep historical attendance stable when employee profiles change."""
from alembic import op
import sqlalchemy as sa

revision = '20261016_0002'
down_revision = '20261016_0001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'employee_name' not in {column['name'] for column in sa.inspect(bind).get_columns('morning_attendance')}:
        op.add_column('morning_attendance', sa.Column('employee_name', sa.String(255), nullable=True))
    metadata = sa.MetaData()
    attendance = sa.Table('morning_attendance', metadata, autoload_with=bind)
    users = sa.Table('users', metadata, autoload_with=bind)
    bind.execute(attendance.update().where(attendance.c.employee_name.is_(None)).values(
        employee_name=sa.select(users.c.display_name).where(users.c.id == attendance.c.user_id).scalar_subquery()))


def downgrade():
    raise RuntimeError('Attendance snapshots must not be discarded; restore the development backup instead.')
