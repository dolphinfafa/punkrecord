"""Start manually confirmed daily rosters without recalculating old attendance."""
from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa

from app.core.config import settings

revision = "20261124_0001"
down_revision = "20261117_0001"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "daily_attendance_roster" not in inspector.get_table_names():
        op.create_table(
            "daily_attendance_roster",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("day", sa.Date(), nullable=False, unique=True),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("people", sa.JSON(), nullable=False),
            sa.Column("generation_id", sa.Uuid()),
            sa.Column("settled_version", sa.Integer()),
            sa.Column("settled_people", sa.JSON(none_as_null=True)),
        )
    if "roster_starts_on" not in {col["name"] for col in inspector.get_columns("beli_policy")}:
        op.add_column("beli_policy", sa.Column("roster_starts_on", sa.Date()))
    policy = sa.table("beli_policy", sa.column("roster_starts_on", sa.Date()))
    today = datetime.now(timezone(timedelta(hours=8))).date()
    effective = today if settings.APP_ENV in ("development", "dev", "test") else today + timedelta(days=1)
    bind.execute(policy.update().where(policy.c.roster_starts_on.is_(None)).values(roster_starts_on=effective))


def downgrade():
    raise RuntimeError("Daily attendance settlement snapshots must not be discarded.")
