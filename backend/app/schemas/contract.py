"""
Contract module Pydantic schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, field_validator


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
    contract_no: Optional[str] = None  # Auto-generated (CNT-<ts>) when omitted
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
    payment_plans: List[PaymentPlanCreate] = []


class ContractUpdate(BaseModel):
    """Contract update schema"""
    contract_no: Optional[str] = None
    name: Optional[str] = None
    contract_type: Optional[str] = None
    status: Optional[str] = None
    party_a_id: Optional[UUID] = None
    party_b_id: Optional[UUID] = None
    party_c_id: Optional[UUID] = None
    amount_total: Optional[Decimal] = None
    currency: Optional[str] = None
    pm_user_id: Optional[UUID] = None
    summary: Optional[str] = None
    content_doc: Optional[str] = None
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expire_date: Optional[date] = None


class ContractAttachmentResponse(BaseModel):
    """Contract attachment metadata."""
    id: str
    file_name: str
    content_type: str
    size: int
    uploaded_at: str


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
    pending_amount: Decimal
    currency: str
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expire_date: Optional[date] = None
    summary: Optional[str] = None
    attachments: List[ContractAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

    @field_validator("attachments", mode="before")
    @classmethod
    def normalize_attachments(cls, value):
        normalized = []
        for item in value or []:
            normalized.append({
                "id": item.get("id", ""),
                "file_name": item.get("file_name") or "attachment",
                "content_type": item.get("content_type") or "application/octet-stream",
                "size": int(item.get("size") or 0),
                "uploaded_at": item.get("uploaded_at") or "",
            })
        return normalized
