"""Opt-in MySQL row-lock verification, using a disposable local database only."""
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel, Session, create_engine, select
from app import models  # noqa: F401
from app.core.config import settings
from app.core.exceptions import ValidationException
from app.models.base import now_cn
from app.models.iam import User, OurEntity, OurEntityType, OurEntityStatus
from app.models.todo import TodoItem
from app.models.beli import BeliProduct, BeliAccount, BeliLedger
from app.services.beli import (account_for, create_order, queue_reward, approve_reward,
                               lock_todo, protect_reward_plan)

pytestmark = pytest.mark.skipif(os.environ.get('PUNKRECORD_MYSQL_TESTS') != '1', reason='Opt-in local scratch MySQL only')


@pytest.fixture
def mysql_db():
    assert settings.DB_TYPE == 'mysql' and settings.DB_HOST in ('localhost', '127.0.0.1', '::1')
    assert settings.APP_ENV in ('development', 'dev', 'test')
    name = 'punkrecord_test_' + uuid4().hex
    admin = create_engine(settings.DATABASE_URL, isolation_level='AUTOCOMMIT', hide_parameters=True)
    engine = None
    created = False
    try:
        try:
            with admin.connect() as connection:
                connection.execute(text(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'))
                created = True
        except OperationalError as exc:
            if exc.orig.args[0] in (1044, 1045):
                pytest.skip('Local DB account cannot create a disposable database; concurrency not verified')
            raise
        engine = create_engine(make_url(settings.DATABASE_URL).set(database=name), hide_parameters=True)
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            boss = User(display_name='Boss'); session.add(boss); session.flush()
            employee = User(display_name='Employee', manager_user_id=boss.id, basic_salary=12000, beili_balance=1000)
            entity = OurEntity(name='Fixture', type=OurEntityType.COMPANY, status=OurEntityStatus.ACTIVE)
            session.add_all([employee, entity]); session.commit()
            ids = boss.id, employee.id, entity.id
        yield engine, ids
    finally:
        if engine: engine.dispose()
        if created:
            with admin.connect() as connection:
                connection.execute(text(f'DROP DATABASE IF EXISTS `{name}`'))
        admin.dispose()


def test_concurrent_redemption_cannot_oversell(mysql_db):
    engine, (boss_id, employee_id, _) = mysql_db
    with Session(engine) as session:
        item = BeliProduct(name='One', kind='physical', price=300, stock=1)
        session.add(item); session.commit(); product_id = item.id
        account_for(session, employee_id); session.commit()
    barrier = Barrier(2)
    def redeem(index):
        with Session(engine) as session:
            employee = session.get(User, employee_id)
            barrier.wait(timeout=10)
            try:
                row = create_order(session, employee, product_id, 1, f'request-{index}', 'pickup')
                session.commit()
                return 'created'
            except ValidationException:
                session.rollback()
                return 'rejected'
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(redeem, range(2)))
    assert sorted(outcomes) == ['created', 'rejected']
    with Session(engine) as session:
        assert session.get(BeliProduct, product_id).stock == 0
        assert account_for(session, employee_id)[1].frozen == 300


def test_concurrent_reward_credits_once(mysql_db):
    engine, (boss_id, employee_id, entity_id) = mysql_db
    with Session(engine) as session:
        todo = TodoItem(our_entity_id=entity_id, assignee_user_id=employee_id, creator_user_id=boss_id,
            title='Task', source_type='custom', source_id=str(uuid4()), action_type='do', status='done',
            due_at=datetime(2026, 10, 20, 18), submitted_at=now_cn(), done_at=now_cn(), estimated_hours=Decimal('2'))
        session.add(todo); session.flush(); queue_reward(session, todo); session.commit(); todo_id = todo.id
    barrier = Barrier(2)
    def review(index):
        with Session(engine) as session:
            boss = session.get(User, boss_id)
            barrier.wait(timeout=10)
            row = approve_reward(session, todo_id, boss, {})
            session.commit()
            return row.id
    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(review, range(2)))
    assert ids[0] == ids[1]
    with Session(engine) as session:
        assert account_for(session, employee_id)[1].balance == 1060
        assert len(session.exec(select(BeliLedger).where(BeliLedger.kind == 'task_reward')).all()) == 1


def test_concurrent_zero_hours_and_reward_review_are_serialized(mysql_db):
    engine, (boss_id, employee_id, entity_id) = mysql_db
    with Session(engine) as session:
        todo = TodoItem(our_entity_id=entity_id, assignee_user_id=employee_id, creator_user_id=boss_id,
            title='Hours race', source_type='custom', source_id=str(uuid4()), action_type='do', status='done',
            due_at=datetime(2026, 10, 20, 18), submitted_at=now_cn(), done_at=now_cn(), estimated_hours=Decimal('2'))
        session.add(todo); session.flush(); queue_reward(session, todo); session.commit(); todo_id = todo.id
    barrier = Barrier(2)
    def act(action):
        with Session(engine) as session:
            boss = session.get(User, boss_id)
            barrier.wait(timeout=10)
            try:
                if action == 'review':
                    approve_reward(session, todo_id, boss, {})
                else:
                    todo = lock_todo(session, todo_id)
                    protect_reward_plan(session, todo, {'estimated_hours': Decimal('0')})
                    todo.estimated_hours = Decimal('0'); session.add(todo)
                    queue_reward(session, todo, backfill=True)
                session.commit()
                return action
            except ValidationException:
                session.rollback()
                return 'blocked'
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(act, ['review', 'zero']))
    assert sorted(outcomes) in (['blocked', 'review'], ['blocked', 'zero'])
    with Session(engine) as session:
        todo = session.get(TodoItem, todo_id)
        entries = session.exec(select(BeliLedger).where(BeliLedger.kind == 'task_reward')).all()
        assert (todo.estimated_hours == 0 and not entries) or (todo.estimated_hours == 2 and len(entries) == 1)
        assert account_for(session, employee_id)[1].balance == (1000 if not entries else 1060)
