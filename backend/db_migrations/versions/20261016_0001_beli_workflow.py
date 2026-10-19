"""Independent Beli accounting and required task planning fields."""
from datetime import date
from decimal import Decimal
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "20261016_0001"
down_revision = "20260818_0001"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for table, name, column in (
        ("todo_item", "estimated_hours", sa.Column("estimated_hours", sa.Numeric(10, 2), nullable=True)),
        ("todo_item", "submitted_at", sa.Column("submitted_at", sa.DateTime(), nullable=True)),
        ("users", "basic_salary", sa.Column("basic_salary", sa.Numeric(12, 2), nullable=True)),
        ("notification_log", "leave_id", sa.Column("leave_id", sa.Uuid(), nullable=True)),
    ):
        if name not in {c["name"] for c in sa.inspect(bind).get_columns(table)}:
            op.add_column(table, column)
    if bind.dialect.name != "sqlite":
        op.alter_column("notification_log", "todo_id", existing_type=sa.Uuid(), nullable=True)
    else:
        with op.batch_alter_table("notification_log") as batch:
            batch.alter_column("todo_id", existing_type=sa.Uuid(), nullable=True)
    from app.models.beli import (BeliAccount, BeliLedger, TaskReward, WorkdayOverride,
        BeliPolicy, MorningAttendance, BeliProduct, BeliOrder)
    for model in (BeliAccount, BeliLedger, TaskReward, WorkdayOverride, BeliPolicy,
                  MorningAttendance, BeliProduct, BeliOrder):
        if bind.dialect.name == "mysql":
            collation = bind.execute(sa.text("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='id'")).scalar_one()
            model.__table__.dialect_options["mysql"]["charset"] = "utf8mb4"
            model.__table__.dialect_options["mysql"]["collate"] = collation
        model.__table__.create(bind, checkfirst=True)
    from app.models.iam import User
    from app.models.base import now_cn
    policy = BeliPolicy.__table__
    if not bind.execute(sa.select(policy.c.id)).first():
        bind.execute(policy.insert().values(id=uuid4(), created_at=now_cn(), updated_at=now_cn(),
                                           code="default", starts_on=now_cn().date()))
    account, ledger = BeliAccount.__table__, BeliLedger.__table__
    for user_id, balance in bind.execute(sa.select(User.__table__.c.id, User.__table__.c.beili_balance)).all():
        if not bind.execute(sa.select(account.c.id).where(account.c.user_id == user_id)).first():
            value = Decimal(str(balance or 0)).quantize(Decimal("0.01"))
            bind.execute(account.insert().values(id=uuid4(), created_at=now_cn(), updated_at=now_cn(),
                user_id=user_id, balance=value, frozen=0))
            bind.execute(ledger.insert().values(id=uuid4(), created_at=now_cn(), updated_at=now_cn(),
                user_id=user_id, event_key=f"opening:{user_id}", kind="opening", amount=value,
                balance_after=value, reason="历史余额结转", details={}))


def downgrade():
    raise RuntimeError("此迁移包含财务流水，禁止自动删除；请使用开发库备份恢复。")
