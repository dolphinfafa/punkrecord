"""
Contract module Pydantic schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class CounterpartyCreate(BaseModel):
    """Counterparty creation schema"""
    name: str
    type: str
    identifier: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None


class CounterpartyResponse(BaseModel):
    """Counterparty response schema"""
    id: UUID
    name: str
    type: str
    identifier: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class PaymentPlanCreate(BaseModel):
    """Payment plan creation schema"""
    sequence_no: int
    direction: str
    name: str
    amount: Decimal
    due_at: Optional[datetime] = None
    is_final: bool = False


class PaymentPlanResponse(BaseModel):
    """Payment plan response schema"""
    id: UUID
    contract_id: UUID
    sequence_no: int
    direction: str
    name: str
    amount: Decimal
    due_at: Optional[datetime] = None
    is_final: bool
    paid_amount: Decimal
    paid_at: Optional[datetime] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ContractCreate(BaseModel):
    """Contract creation schema"""
    contract_no: str
    name: str
    contract_type: str
    party_a_id: UUID  # 甲方 (Our Entity)
    party_b_id: UUID  # 乙方 (Counterparty)
    party_c_id: Optional[UUID] = None  # 丙方 (Optional third party)
    amount_total: Decimal
    currency: str = "CNY"
    pm_user_id: Optional[UUID] = None
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expire_date: Optional[date] = None
    summary: Optional[str] = None
    content_doc: Optional[str] = None
    payment_plans: list[PaymentPlanCreate] = []


class ContractUpdate(BaseModel):
    """Contract update schema"""
    name: Optional[str] = None
    summary: Optional[str] = None
    content_doc: Optional[str] = None
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expire_date: Optional[date] = None


class ContractResponse(BaseModel):
    """Contract response schema"""
    id: UUID
    contract_no: str
    name: str
    contract_type: str
    status: str
    party_a_id: UUID  # 甲方
    party_b_id: UUID  # 乙方
    party_c_id: Optional[UUID] = None  # 丙方
    owner_user_id: UUID
    pm_user_id: Optional[UUID] = None
    amount_total: Decimal
    currency: str
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expire_date: Optional[date] = None
    summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
