"""Migration replay against a disposable legacy schema, never the app DB."""
import importlib.util
from pathlib import Path
from datetime import date, datetime
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_upgrade_preserves_balances_and_is_replayable():
    path = Path(__file__).resolve().parents[1] / 'db_migrations/versions/20261016_0001_beli_workflow.py'
    spec = importlib.util.spec_from_file_location('beli_upgrade', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    legacy = sa.MetaData()
    users = sa.Table('users', legacy, sa.Column('id', sa.Uuid(), primary_key=True),
                     sa.Column('display_name', sa.String(255)), sa.Column('beili_balance', sa.Float()))
    sa.Table('todo_item', legacy, sa.Column('id', sa.Uuid(), primary_key=True))
    sa.Table('notification_log', legacy, sa.Column('id', sa.Uuid(), primary_key=True), sa.Column('todo_id', sa.Uuid(), nullable=False))
    legacy.create_all(engine)
    user_id = uuid4()
    with engine.begin() as connection:
        connection.execute(users.insert().values(id=user_id, beili_balance=-125.5))
        connection.execute(legacy.tables['todo_item'].insert().values(id=uuid4()))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            migration.upgrade()
            spec2 = importlib.util.spec_from_file_location('attendance_upgrade', path.with_name('20261016_0002_attendance_roster.py'))
            roster = importlib.util.module_from_spec(spec2)
            spec2.loader.exec_module(roster)
            roster.upgrade()
            roster.upgrade()
            spec3 = importlib.util.spec_from_file_location('hours_upgrade', path.with_name('20261016_0003_optional_task_hours.py'))
            hours = importlib.util.module_from_spec(spec3)
            spec3.loader.exec_module(hours)
            hours.upgrade()
            activated_at = connection.execute(sa.text('SELECT hours_rule_starts_at FROM beli_policy')).scalar_one()
            hours.upgrade()
            assert connection.execute(sa.text('SELECT hours_rule_starts_at FROM beli_policy')).scalar_one() == activated_at
        inspector = sa.inspect(connection)
        assert {'estimated_hours', 'submitted_at'} <= {c['name'] for c in inspector.get_columns('todo_item')}
        assert next(c for c in inspector.get_columns('notification_log') if c['name'] == 'todo_id')['nullable']
        assert connection.execute(sa.text('SELECT balance FROM beli_account')).scalar_one() == -125.5
        assert connection.execute(sa.text('SELECT COUNT(*) FROM beli_ledger')).scalar_one() == 1
        assert connection.execute(sa.text('SELECT COUNT(*) FROM beli_policy')).scalar_one() == 1
        assert connection.execute(sa.text('SELECT estimated_hours FROM todo_item')).scalar_one() is None
        tasks = sa.Table('todo_item', sa.MetaData(), autoload_with=connection)
        new_id = uuid4().hex
        connection.execute(tasks.insert().values(id=new_id))
        assert connection.execute(sa.select(tasks.c.estimated_hours).where(tasks.c.id == new_id)).scalar_one() == 0
    with pytest.raises(RuntimeError): migration.downgrade()
    engine.dispose()


def test_hours_upgrade_from_already_deployed_policy_schema():
    path = Path(__file__).resolve().parents[1] / 'db_migrations/versions/20261016_0003_optional_task_hours.py'
    spec = importlib.util.spec_from_file_location('deployed_hours_upgrade', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    metadata = sa.MetaData()
    policy = sa.Table('beli_policy', metadata, sa.Column('id', sa.Integer(), primary_key=True))
    tasks = sa.Table('todo_item', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                     sa.Column('estimated_hours', sa.Numeric(10, 2), nullable=True))
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(policy.insert().values(id=1))
        connection.execute(tasks.insert(), [{'id': 1, 'estimated_hours': None}, {'id': 2, 'estimated_hours': 8}])
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            activated_at = connection.execute(sa.text('SELECT hours_rule_starts_at FROM beli_policy')).scalar_one()
            migration.upgrade()
        assert activated_at is not None
        assert connection.execute(sa.text('SELECT hours_rule_starts_at FROM beli_policy')).scalar_one() == activated_at
        assert connection.execute(sa.select(tasks.c.estimated_hours).order_by(tasks.c.id)).scalars().all() == [None, 8]
        connection.execute(tasks.insert().values(id=3))
        assert connection.execute(sa.select(tasks.c.estimated_hours).where(tasks.c.id == 3)).scalar_one() == 0
    engine.dispose()


def test_meeting_employee_binding_upgrade_preserves_legacy_records():
    path = Path(__file__).resolve().parents[1] / 'db_migrations/versions/20261021_0001_meeting_employee_speakers.py'
    spec = importlib.util.spec_from_file_location('meeting_binding_upgrade', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    metadata = sa.MetaData()
    meetings = sa.Table('meeting_record', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                        sa.Column('speaker_mapping', sa.JSON()), sa.Column('attendees', sa.JSON()))
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(meetings.insert().values(id=1, speaker_mapping={'speaker_1': 'Legacy'}, attendees=['Legacy']))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            migration.upgrade()
        upgraded = sa.Table('meeting_record', sa.MetaData(), autoload_with=connection)
        row = connection.execute(sa.select(upgraded)).mappings().one()
        assert row['speaker_mapping'] == {'speaker_1': 'Legacy'}
        assert row['attendees'] == ['Legacy'] and row['speaker_user_mapping'] == {}
        connection.execute(upgraded.update().values(speaker_user_mapping={'speaker_1': str(uuid4())}))
        with Operations.context(MigrationContext.configure(connection)): migration.upgrade()
        assert connection.execute(sa.select(upgraded.c.speaker_user_mapping)).scalar_one()['speaker_1']
    engine.dispose()


def test_summary_attendance_migration_freezes_only_settled_days_without_money_changes():
    path = Path(__file__).resolve().parents[1] / 'db_migrations/versions/20261117_0001_summary_attendance.py'
    spec = importlib.util.spec_from_file_location('summary_attendance_upgrade', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    metadata = sa.MetaData()
    users = sa.Table('users', metadata, sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('username', sa.String()), sa.Column('display_name', sa.String()),
        sa.Column('created_at', sa.DateTime()), sa.Column('beili_balance', sa.Float()))
    meetings = sa.Table('meeting_record', metadata, sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('meeting_type', sa.String()), sa.Column('meeting_date', sa.Date()),
        sa.Column('status', sa.String()), sa.Column('speaker_mapping', sa.JSON()),
        sa.Column('speaker_user_mapping', sa.JSON()), sa.Column('attendees', sa.JSON()))
    segments = sa.Table('meeting_transcript_segment', metadata,
        sa.Column('meeting_id', sa.Integer()), sa.Column('speaker_id', sa.String()))
    attendance = sa.Table('morning_attendance', metadata, sa.Column('day', sa.Date()),
        sa.Column('user_id', sa.Uuid()), sa.Column('employee_name', sa.String()))
    ledger = sa.Table('beli_ledger', metadata, sa.Column('amount', sa.Numeric(16, 2)))
    metadata.create_all(engine)
    first, second = uuid4(), uuid4()
    day = date(2026, 11, 16)
    with engine.begin() as connection:
        connection.execute(users.insert(), [dict(id=first, username='first', display_name='Duplicate',
            created_at=datetime(2020, 1, 1), beili_balance=1500), dict(id=second, username='second',
            display_name='Duplicate', created_at=datetime(2020, 1, 1), beili_balance=-500)])
        connection.execute(attendance.insert(), [dict(day=day, user_id=first, employee_name='Duplicate'),
            dict(day=day, user_id=second, employee_name='Duplicate')])
        connection.execute(ledger.insert(), [dict(amount=-500)])
        connection.execute(meetings.insert(), [dict(id=1, meeting_type='morning', meeting_date=day,
            status='TRANSCRIBED', speaker_mapping={'s1': 'Duplicate', 's2': 'second'},
            speaker_user_mapping={'s1': str(first), 's2': None}, attendees=['Duplicate']),
            dict(id=2, meeting_type='morning', meeting_date=date(2026, 11, 17), status='TRANSCRIBED',
            speaker_mapping={}, speaker_user_mapping={}, attendees=[])])
        connection.execute(segments.insert(), [dict(meeting_id=1, speaker_id='s1'), dict(meeting_id=1, speaker_id='s2')])
        before_balances = connection.execute(sa.select(users.c.beili_balance).order_by(users.c.username)).all()
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        upgraded = sa.Table('meeting_record', sa.MetaData(), autoload_with=connection)
        snapshots = dict(connection.execute(sa.select(upgraded.c.id, upgraded.c.attendance_snapshot)).all())
        assert snapshots[1]['present_user_ids'] == [str(first)] and snapshots[1]['legacy'] is True
        assert snapshots[2] is None
        connection.execute(upgraded.insert().values(id=3, meeting_type='morning', meeting_date=day,
            status='TRANSCRIBED', speaker_mapping={}, speaker_user_mapping={}, attendees=[]))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(sa.select(upgraded.c.attendance_snapshot).where(upgraded.c.id == 3)).scalar_one() is None
        assert connection.execute(sa.select(users.c.beili_balance).order_by(users.c.username)).all() == before_balances
        assert connection.execute(sa.select(ledger.c.amount)).scalars().all() == [-500]
    with pytest.raises(RuntimeError):
        migration.downgrade()
    engine.dispose()
