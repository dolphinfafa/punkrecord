"""
Finance module Pydantic schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class FinanceAccountCreate(BaseModel):
    """Finance account creation schema"""
    entity_id: UUID
    account_category: str  # public or private
    account_name: str
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    currency: str = "CNY"
    initial_balance: Decimal = 0
    shareholder_user_id: Optional[UUID] = None  # Required for private accounts


class FinanceAccountUpdate(BaseModel):
    """Finance account update schema"""
    entity_id: Optional[UUID] = None
    account_category: Optional[str] = None
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    currency: Optional[str] = None
    initial_balance: Optional[Decimal] = None
    shareholder_user_id: Optional[UUID] = None
    is_default: Optional[bool] = None
    status: Optional[str] = None
    account_no_masked: Optional[str] = None
class FinanceAccountResponse(BaseModel):
    """Finance account response schema"""
    id: UUID
    entity_id: UUID
    account_category: str
    account_name: str
    bank_name: Optional[str] = None
    currency: str
    initial_balance: Decimal
    balance: Decimal = 0 # Computed field
    status: str
    is_default: bool
    shareholder_user_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    """Transaction creation schema"""
    our_entity_id: UUID
    account_id: UUID
    txn_direction: str  # in or out
    amount: Decimal
    currency: str = "CNY"
    txn_date: date
    counterparty_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    purpose: Optional[str] = None
    channel: Optional[str] = None
    reference_no: Optional[str] = None


class TransactionResponse(BaseModel):
    """Transaction response schema"""
    id: UUID
    our_entity_id: UUID
    account_id: UUID
    txn_direction: str
    amount: Decimal
    currency: str
    txn_date: date
    counterparty_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    purpose: Optional[str] = None
    reconcile_status: str
    related_object_type: Optional[str] = None
    related_object_id: Optional[UUID] = None
    created_by_user_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    """Invoice creation schema"""
    our_entity_id: UUID
    invoice_kind: str  # output or input
    invoice_medium: str  # paper or electronic
    invoice_no: Optional[str] = None
    issue_date: Optional[date] = None
    amount_with_tax: Optional[Decimal] = None
    related_contract_id: Optional[UUID] = None
    related_payment_plan_id: Optional[UUID] = None


class InvoiceResponse(BaseModel):
    """Invoice response schema"""
    id: UUID
    our_entity_id: UUID
    invoice_kind: str
    invoice_medium: str
    invoice_no: Optional[str] = None
    issue_date: Optional[date] = None
    amount_with_tax: Optional[Decimal] = None
    ocr_status: str
    related_contract_id: Optional[UUID] = None
    related_payment_plan_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ReimbursementCreate(BaseModel):
    """Reimbursement creation schema"""
    our_entity_id: UUID
    project_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    total_amount: Decimal
    expense_lines: list  # Array of expense line items


class ReimbursementResponse(BaseModel):
    """Reimbursement response schema"""
    id: UUID
    our_entity_id: UUID
    requester_user_id: UUID
    project_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    total_amount: Decimal
    status: str
    paid_txn_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
