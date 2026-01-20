"""
Contract API endpoints
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.iam import User
from app.models.contract import (
    Contract, Counterparty, ContractPaymentPlan,
    ContractType, ContractStatus, CounterpartyType,
    PaymentDirection, PaymentPlanStatus
)
from app.schemas.contract import (
    CounterpartyCreate, CounterpartyResponse,
    ContractCreate, ContractUpdate, ContractResponse,
    PaymentPlanResponse
)

router = APIRouter(prefix="/contract", tags=["Contract"])


# Counterparty endpoints

@router.post("/counterparties", response_model=dict)
async def create_counterparty(
    data: CounterpartyCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create counterparty"""
    counterparty = Counterparty(
        name=data.name,
        type=CounterpartyType(data.type),
        identifier=data.identifier,
        address=data.address,
        contacts=data.contacts
    )
    
    session.add(counterparty)
    session.commit()
    session.refresh(counterparty)
    
    return success_response(CounterpartyResponse.model_validate(counterparty))


@router.get("/counterparties", response_model=dict)
async def list_counterparties(
    type: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List counterparties"""
    query = select(Counterparty)
    if type:
        query = query.where(Counterparty.type == type)
    
    counterparties = session.exec(query).all()
    return success_response([CounterpartyResponse.model_validate(c) for c in counterparties])


# Contract endpoints

@router.post("/contracts", response_model=dict)
async def create_contract(
    data: ContractCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create contract"""
    contract = Contract(
        our_entity_id=data.our_entity_id,
        contract_no=data.contract_no,
        name=data.name,
        contract_type=ContractType(data.contract_type),
        status=ContractStatus.DRAFT,
        owner_user_id=current_user.id,
        pm_user_id=data.pm_user_id,
        counterparty_id=data.counterparty_id,
        amount_total=data.amount_total,
        currency=data.currency,
        sign_date=data.sign_date,
        effective_date=data.effective_date,
        expire_date=data.expire_date,
        summary=data.summary,
        content_doc=data.content_doc
    )
    
    session.add(contract)
    session.commit()
    session.refresh(contract)
    
    # Create payment plans
    for plan_data in data.payment_plans:
        plan = ContractPaymentPlan(
            contract_id=contract.id,
            sequence_no=plan_data.sequence_no,
            direction=PaymentDirection(plan_data.direction),
            name=plan_data.name,
            amount=plan_data.amount,
            due_at=plan_data.due_at,
            is_final=plan_data.is_final,
            status=PaymentPlanStatus.PENDING
        )
        session.add(plan)
    
    session.commit()
    
    return success_response(ContractResponse.model_validate(contract))


@router.get("/contracts", response_model=dict)
async def list_contracts(
    status: Optional[str] = Query(None),
    contract_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List contracts"""
    query = select(Contract)
    
    if status:
        query = query.where(Contract.status == status)
    if contract_type:
        query = query.where(Contract.contract_type == contract_type)
    
    query = query.order_by(Contract.created_at.desc())
    
    offset = (page - 1) * page_size
    contracts = session.exec(query.offset(offset).limit(page_size)).all()
    
    count_query = select(Contract)
    if status:
        count_query = count_query.where(Contract.status == status)
    if contract_type:
        count_query = count_query.where(Contract.contract_type == contract_type)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [ContractResponse.model_validate(c) for c in contracts],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/contracts/{contract_id}", response_model=dict)
async def get_contract(
    contract_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get contract by ID"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("Contract not found")
    
    return success_response(ContractResponse.model_validate(contract))


@router.patch("/contracts/{contract_id}", response_model=dict)
async def update_contract(
    contract_id: UUID,
    data: ContractUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update contract"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("Contract not found")
    
    if data.name is not None:
        contract.name = data.name
    if data.summary is not None:
        contract.summary = data.summary
    if data.content_doc is not None:
        contract.content_doc = data.content_doc
    if data.sign_date is not None:
        contract.sign_date = data.sign_date
    if data.effective_date is not None:
        contract.effective_date = data.effective_date
    if data.expire_date is not None:
        contract.expire_date = data.expire_date
    
    contract.updated_at = datetime.utcnow()
    session.add(contract)
    session.commit()
    session.refresh(contract)
    
    return success_response(ContractResponse.model_validate(contract))


@router.get("/contracts/{contract_id}/payment-plans", response_model=dict)
async def get_contract_payment_plans(
    contract_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get contract payment plans"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("Contract not found")
    
    plans = session.exec(
        select(ContractPaymentPlan)
        .where(ContractPaymentPlan.contract_id == contract_id)
        .order_by(ContractPaymentPlan.sequence_no)
    ).all()
    
    return success_response([PaymentPlanResponse.model_validate(p) for p in plans])


@router.post("/contracts/{contract_id}/submit", response_model=dict)
async def submit_contract_for_approval(
    contract_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Submit contract for approval"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("Contract not found")
    
    if contract.status != ContractStatus.DRAFT:
        from app.core.exceptions import ValidationException
        raise ValidationException("Only draft contracts can be submitted")
    
    contract.status = ContractStatus.IN_APPROVAL
    contract.updated_at = datetime.utcnow()
    
    session.add(contract)
    session.commit()
    
    # TODO: Create approval instance and steps
    # This will be implemented when we add the approval service
    
    return success_response(ContractResponse.model_validate(contract))
