"""
Contract Module Models
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Column, JSON, SQLModel
from sqlalchemy import DECIMAL
from app.models.base import BaseDBModel


class ContractType(str, Enum):
    """Contract type"""
    SALES = "sales"
    PURCHASE = "purchase"
    THIRD_PARTY = "third_party"


class ContractStatus(str, Enum):
    """Contract status"""
    DRAFT = "draft"
    IN_APPROVAL = "in_approval"
    APPROVED = "approved"
    SIGNED = "signed"
    IN_DELIVERY = "in_delivery"
    ACCEPTED = "accepted"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class CounterpartyType(str, Enum):
    """Counterparty type"""
    CUSTOMER = "customer"
    SUPPLIER = "supplier"
    PARTNER = "partner"
    INDIVIDUAL = "individual"
    ORGANIZATION = "organization"
    OTHER = "other"


class PaymentDirection(str, Enum):
    """Payment direction"""
    RECEIVABLE = "receivable"
    PAYABLE = "payable"


class PaymentPlanStatus(str, Enum):
    """Payment plan status"""
    PENDING = "pending"
    DUE = "due"
    OVERDUE = "overdue"
    COMPLETED = "completed"


class Counterparty(BaseDBModel, table=True):
    """Counterparty (customer/supplier/partner)"""
    __tablename__ = "counterparty"
    
    name: str = Field(nullable=False)
    type: str = Field(nullable=False)
    identifier: Optional[str] = None  # Tax ID / USCC
    address: Optional[str] = None
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None


class Contract(BaseDBModel, table=True):
    """Contract model"""
    __tablename__ = "contract"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    contract_no: str = Field(nullable=False, unique=True, index=True)
    name: str = Field(nullable=False)
    contract_type: ContractType = Field(nullable=False)
    status: ContractStatus = Field(default=ContractStatus.DRAFT, nullable=False, index=True)
    
    owner_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    pm_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    
    counterparty_id: UUID = Field(foreign_key="counterparty.id", nullable=False)
    
    amount_total: Decimal = Field(sa_column=Column(DECIMAL(18, 2), nullable=False))
    currency: str = Field(default="CNY", nullable=False)
    
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expire_date: Optional[date] = None
    
    summary: Optional[str] = None
    content_doc: Optional[str] = None  # Markdown content
    attachments: list = Field(default=[], sa_column=Column(JSON))


class ContractPaymentPlan(BaseDBModel, table=True):
    """Contract payment plan (installment)"""
    __tablename__ = "contract_payment_plan"
    
    contract_id: UUID = Field(foreign_key="contract.id", nullable=False, index=True)
    sequence_no: int = Field(nullable=False)
    direction: PaymentDirection = Field(nullable=False)
    name: str = Field(nullable=False)
    amount: Decimal = Field(sa_column=Column(DECIMAL(18, 2), nullable=False))
    due_at: Optional[datetime] = None
    is_final: bool = Field(default=False, nullable=False)
    
    paid_amount: Decimal = Field(default=0, sa_column=Column(DECIMAL(18, 2), nullable=False, default=0))
    paid_at: Optional[datetime] = None
    status: PaymentPlanStatus = Field(default=PaymentPlanStatus.PENDING, nullable=False)
