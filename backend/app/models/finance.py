"""
Finance Module Models
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Column, JSON, SQLModel
from sqlalchemy import DECIMAL
from app.models.base import BaseDBModel


class AccountCategory(str, Enum):
    """Account category"""
    PUBLIC = "public"
    PRIVATE = "private"


class AccountStatus(str, Enum):
    """Account status"""
    ACTIVE = "active"
    INACTIVE = "inactive"


class TransactionDirection(str, Enum):
    """Transaction direction"""
    IN = "in"
    OUT = "out"


class ReconcileStatus(str, Enum):
    """Reconcile status"""
    UNRECONCILED = "unreconciled"
    RECONCILED = "reconciled"


class InvoiceKind(str, Enum):
    """Invoice kind"""
    OUTPUT = "output"  # 销项
    INPUT = "input"    # 进项


class InvoiceMedium(str, Enum):
    """Invoice medium"""
    PAPER = "paper"
    ELECTRONIC = "electronic"


class OCRStatus(str, Enum):
    """OCR status"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"


class InvoiceRequestStatus(str, Enum):
    """Invoice request status"""
    DRAFT = "draft"
    IN_APPROVAL = "in_approval"
    APPROVED = "approved"
    ISSUED = "issued"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ReimbursementStatus(str, Enum):
    """Reimbursement status"""
    DRAFT = "draft"
    IN_APPROVAL = "in_approval"
    APPROVED = "approved"
    PAID = "paid"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class FinanceAccount(BaseDBModel, table=True):
    """Finance account"""
    __tablename__ = "finance_account"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    account_category: AccountCategory = Field(nullable=False)
    account_name: str = Field(nullable=False)
    
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    account_no_encrypted: Optional[str] = None  # Encrypted account number
    account_no_masked: Optional[str] = None     # Masked for display
    
    currency: str = Field(default="CNY", nullable=False)
    status: AccountStatus = Field(default=AccountStatus.ACTIVE, nullable=False)
    is_default: bool = Field(default=False, nullable=False)
    
    shareholder_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")


class FinanceTransaction(BaseDBModel, table=True):
    """Finance transaction"""
    __tablename__ = "finance_transaction"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    account_id: UUID = Field(foreign_key="finance_account.id", nullable=False, index=True)
    
    txn_direction: TransactionDirection = Field(nullable=False)
    amount: Decimal = Field(sa_column=Column(DECIMAL(18, 2), nullable=False))
    currency: str = Field(default="CNY", nullable=False)
    txn_date: date = Field(nullable=False, index=True)
    
    counterparty_id: Optional[UUID] = Field(default=None, foreign_key="counterparty.id")
    purpose: Optional[str] = None
    channel: Optional[str] = None
    reference_no: Optional[str] = None
    
    attachments: list = Field(default=[], sa_column=Column(JSON))
    reconcile_status: ReconcileStatus = Field(default=ReconcileStatus.UNRECONCILED, nullable=False)
    
    related_object_type: Optional[str] = None
    related_object_id: Optional[UUID] = None
    
    created_by_user_id: UUID = Field(foreign_key="user.id", nullable=False)


class FinanceInvoice(BaseDBModel, table=True):
    """Finance invoice"""
    __tablename__ = "finance_invoice"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    invoice_kind: InvoiceKind = Field(nullable=False)
    invoice_medium: InvoiceMedium = Field(nullable=False)
    
    invoice_no: Optional[str] = Field(default=None, index=True)
    issue_date: Optional[date] = None
    amount_with_tax: Optional[Decimal] = Field(default=None, sa_column=Column(DECIMAL(18, 2)))
    
    files: list = Field(sa_column=Column(JSON))
    
    ocr_status: OCRStatus = Field(default=OCRStatus.PENDING, nullable=False)
    ocr_confidence: Optional[float] = None
    ocr_raw_result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    ocr_extracted_fields: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    related_contract_id: Optional[UUID] = Field(default=None, foreign_key="contract.id")
    related_payment_plan_id: Optional[UUID] = Field(default=None, foreign_key="contract_payment_plan.id")


class InvoiceRequest(BaseDBModel, table=True):
    """Invoice request (开票申请)"""
    __tablename__ = "invoice_request"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    contract_id: Optional[UUID] = Field(default=None, foreign_key="contract.id")
    payment_plan_id: Optional[UUID] = Field(default=None, foreign_key="contract_payment_plan.id")
    
    requester_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    amount_with_tax: Decimal = Field(sa_column=Column(DECIMAL(18, 2), nullable=False))
    
    status: InvoiceRequestStatus = Field(default=InvoiceRequestStatus.DRAFT, nullable=False)
    issued_invoice_id: Optional[UUID] = Field(default=None, foreign_key="finance_invoice.id")


class Reimbursement(BaseDBModel, table=True):
    """Reimbursement (报销)"""
    __tablename__ = "reimbursement"
    
    our_entity_id: UUID = Field(foreign_key="our_entity.id", nullable=False, index=True)
    requester_user_id: UUID = Field(foreign_key="user.id", nullable=False)
    
    project_id: Optional[UUID] = Field(default=None, foreign_key="project.id")
    contract_id: Optional[UUID] = Field(default=None, foreign_key="contract.id")
    
    total_amount: Decimal = Field(sa_column=Column(DECIMAL(18, 2), nullable=False))
    expense_lines: list = Field(sa_column=Column(JSON))
    
    status: ReimbursementStatus = Field(default=ReimbursementStatus.DRAFT, nullable=False)
    paid_txn_id: Optional[UUID] = Field(default=None, foreign_key="finance_transaction.id")
