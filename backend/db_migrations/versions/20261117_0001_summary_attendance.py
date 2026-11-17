"""Freeze settled legacy attendance; new attendance follows summary generation."""
from collections import defaultdict
from uuid import UUID

from alembic import op
import sqlalchemy as sa

revision = "20261117_0001"
down_revision = "20261021_0001"
branch_labels = None
depends_on = None


def _uid(value):
    return str(UUID(str(value)))


def _freeze_settled_meetings(bind):
    # Migration-local resolution keeps historical upgrades independent of app changes.
    metadata = sa.MetaData()
    meetings = sa.Table("meeting_record", metadata, autoload_with=bind)
    attendance = sa.Table("morning_attendance", metadata, autoload_with=bind)
    users = sa.Table("users", metadata, autoload_with=bind)
    segments = sa.Table("meeting_transcript_segment", metadata, autoload_with=bind)
    old_rows = bind.execute(sa.select(attendance)).mappings().all()
    names_by_day = defaultdict(dict)
    for row in old_rows:
        names_by_day[row["day"]][_uid(row["user_id"])] = row["employee_name"]
    if not names_by_day:
        return
    employees = bind.execute(sa.select(users.c.id, users.c.username, users.c.display_name,
                                      users.c.created_at)).mappings().all()
    settled = bind.execute(sa.select(meetings).where(
        meetings.c.meeting_type == "morning", meetings.c.meeting_date.in_(list(names_by_day)),
        sa.func.lower(meetings.c.status).in_(["transcribed", "summarized", "archived"])
    )).mappings().all()
    for meeting in settled:
        day = meeting["meeting_date"]
        by_id, usernames, names = set(), defaultdict(set), defaultdict(set)
        for user in employees:
            if user["created_at"].date() > day:
                continue
            uid = _uid(user["id"])
            by_id.add(uid)
            if user["username"]:
                usernames[user["username"].strip()].add(uid)
            name = names_by_day[day].get(uid) or user["display_name"]
            names[name.strip()].add(uid)
        used = set(bind.execute(sa.select(segments.c.speaker_id).where(
            segments.c.meeting_id == meeting["id"])).scalars())
        mapping, bindings = meeting["speaker_mapping"] or {}, meeting["speaker_user_mapping"] or {}
        present, unmatched, labels = set(), set(), []
        if used:
            for sid in used:
                if sid in bindings:
                    uid = bindings[sid]
                    if uid and _uid(uid) in by_id:
                        present.add(_uid(uid))
                else:
                    labels.append(mapping.get(sid, sid))
        else:
            labels = meeting["attendees"] or []
        for label in labels:
            label = str(label).strip()
            candidates = usernames.get(label) or names.get(label, set())
            if len(candidates) == 1:
                present.update(candidates)
            elif len(candidates) > 1:
                unmatched.add(label)
        bind.execute(meetings.update().where(meetings.c.id == meeting["id"]).values(
            attendance_snapshot={"day": day.isoformat(), "present_user_ids": sorted(present),
                                 "unmatched_names": sorted(unmatched), "legacy": True}))


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("meeting_record")}
    if "summary_generation_id" not in columns:
        op.add_column("meeting_record", sa.Column("summary_generation_id", sa.Uuid(), nullable=True))
    if "attendance_snapshot" not in columns:
        op.add_column("meeting_record", sa.Column("attendance_snapshot", sa.JSON(none_as_null=True), nullable=True))
        _freeze_settled_meetings(bind)


def downgrade():
    raise RuntimeError("Attendance snapshots must be retained; restore the development backup instead.")
