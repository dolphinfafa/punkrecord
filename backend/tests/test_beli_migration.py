"""Migration replay against a disposable legacy schema, never the app DB."""
import importlib.util
from pathlib import Path
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
