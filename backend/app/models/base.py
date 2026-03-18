"""
Base models with common fields
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel

CN_TZ = timezone(timedelta(hours=8))


def now_cn() -> datetime:
    return datetime.now(CN_TZ).replace(tzinfo=None)


class UUIDModel(SQLModel):
    """Base model with UUID primary key"""
    id: UUID = Field(default_factory=uuid4, primary_key=True)


class TimestampModel(SQLModel):
    """Base model with timestamp fields"""
    created_at: datetime = Field(default_factory=now_cn, nullable=False)
    updated_at: datetime = Field(default_factory=now_cn, nullable=False)


class BaseDBModel(UUIDModel, TimestampModel):
    """Base database model with UUID and timestamps"""
    pass
