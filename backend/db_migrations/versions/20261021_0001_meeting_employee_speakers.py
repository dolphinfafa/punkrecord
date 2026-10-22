"""Bind meeting speakers to stable employee IDs without recalculating attendance."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_0001"
down_revision = "20261016_0003"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "speaker_user_mapping" not in {c["name"] for c in sa.inspect(bind).get_columns("meeting_record")}:
        op.add_column("meeting_record", sa.Column("speaker_user_mapping", sa.JSON(), nullable=True))
    meetings = sa.table("meeting_record", sa.column("speaker_user_mapping", sa.JSON()))
    bind.execute(meetings.update().where(meetings.c.speaker_user_mapping.is_(None)).values(speaker_user_mapping={}))


def downgrade():
    raise RuntimeError("Employee bindings must be retained; restore the development backup instead.")
