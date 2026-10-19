"""Beli accounting. Source records are retained even when tasks are deleted."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, JSON, Numeric, UniqueConstraint
from sqlmodel import Field
from app.models.base import BaseDBModel


class BeliAccount(BaseDBModel, table=True):
    __tablename__ = "beli_account"
    user_id: UUID = Field(foreign_key="users.id", unique=True, index=True)
    balance: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(16, 2), nullable=False))
    frozen: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(16, 2), nullable=False))


class BeliLedger(BaseDBModel, table=True):
    __tablename__ = "beli_ledger"
    user_id: UUID = Field(foreign_key="users.id", index=True)
    event_key: str = Field(unique=True, max_length=190)
    kind: str = Field(index=True, max_length=40)
    amount: Decimal = Field(sa_column=Column(Numeric(16, 2), nullable=False))
    balance_after: Decimal = Field(sa_column=Column(Numeric(16, 2), nullable=False))
    leave_type: Optional[str] = None
    leave_days: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 2)))
    reason: str
    actor_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    details: dict = Field(default_factory=dict, sa_column=Column(JSON))


class TaskReward(BaseDBModel, table=True):
    __tablename__ = "beli_task_reward"
    todo_id: UUID = Field(unique=True, index=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    status: str = Field(default="pending", index=True)
    revision: int = Field(default=1)
    amount: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(16, 2), nullable=False))
    snapshot: dict = Field(default_factory=dict, sa_column=Column(JSON))
    history: list = Field(default_factory=list, sa_column=Column(JSON))
    reviewer_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    reviewed_at: Optional[datetime] = None
    comment: Optional[str] = None


class WorkdayOverride(BaseDBModel, table=True):
    __tablename__ = "workday_override"
    day: date = Field(unique=True, index=True)
    is_workday: bool
    reason: str


class BeliPolicy(BaseDBModel, table=True):
    __tablename__ = "beli_policy"
    code: str = Field(default="default", unique=True)
    starts_on: date
    hours_rule_starts_at: Optional[datetime] = None


class MorningAttendance(BaseDBModel, table=True):
    __tablename__ = "morning_attendance"
    __table_args__ = (UniqueConstraint("day", "user_id"),)
    day: date = Field(index=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    employee_name: Optional[str] = Field(default=None, max_length=255)
    absent: bool = False
    waived: bool = False
    charged: bool = False
    revision: int = 0
    reason: Optional[str] = None


class BeliProduct(BaseDBModel, table=True):
    __tablename__ = "beli_product"
    name: str
    description: str = ""
    kind: str = Field(default="physical")
    price: Decimal = Field(sa_column=Column(Numeric(16, 2), nullable=False))
    stock: int = 0
    active: bool = True
    image_name: Optional[str] = None
    leave_type: Optional[str] = None
    leave_days: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 2)))


class BeliOrder(BaseDBModel, table=True):
    __tablename__ = "beli_order"
    user_id: UUID = Field(foreign_key="users.id", index=True)
    product_id: UUID = Field(foreign_key="beli_product.id")
    request_key: str = Field(unique=True, max_length=190)
    quantity: int = 1
    amount: Decimal = Field(sa_column=Column(Numeric(16, 2), nullable=False))
    status: str = Field(default="pending", index=True)
    product_snapshot: dict = Field(default_factory=dict, sa_column=Column(JSON))
    delivery: str = ""
    tracking: str = ""
    comment: str = ""
    reviewer_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
