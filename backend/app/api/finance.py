"""
Finance API endpoints
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
from app.models.finance import (
    FinanceAccount, FinanceTransaction, FinanceInvoice, Reimbursement,
    AccountCategory, AccountStatus, TransactionDirection,
    ReconcileStatus, InvoiceKind, InvoiceMedium, OCRStatus,
    ReimbursementStatus
)
from app.schemas.finance import (
    FinanceAccountCreate, FinanceAccountUpdate, FinanceAccountResponse,
    TransactionCreate, TransactionResponse,
    InvoiceCreate, InvoiceResponse,
    ReimbursementCreate, ReimbursementResponse
)

router = APIRouter(prefix="/finance", tags=["Finance"])


# Account endpoints

@router.post("/accounts", response_model=dict)
async def create_account(
    data: FinanceAccountCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create finance account"""
    account = FinanceAccount(
        entity_id=data.entity_id,
        account_category=AccountCategory(data.account_category),
        account_name=data.account_name,
        bank_name=data.bank_name,
        bank_branch=data.bank_branch,
        currency=data.currency,
        initial_balance=data.initial_balance,
        status=AccountStatus.ACTIVE,
        shareholder_user_id=data.shareholder_user_id
    )
    
    session.add(account)
    session.commit()
    session.refresh(account)
    
    return success_response(FinanceAccountResponse.model_validate(account))


@router.get("/accounts", response_model=dict)
async def list_accounts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List finance accounts"""
    accounts = session.exec(select(FinanceAccount).where(FinanceAccount.status == AccountStatus.ACTIVE)).all()
    
    results = []
    for account in accounts:
        # Calculate balance: initial_balance + sum(transactions)
        # In: +amount, Out: -amount
        
        # This is N+1, optimize later if needed
        txns = session.exec(select(FinanceTransaction).where(FinanceTransaction.account_id == account.id)).all()
        
        current_balance = account.initial_balance
        for txn in txns:
            if txn.txn_direction == TransactionDirection.IN:
                current_balance += txn.amount
            else:
                current_balance -= txn.amount
                
        # Create response object and set computed balance
        acc_resp = FinanceAccountResponse.model_validate(account)
        acc_resp.balance = current_balance
        results.append(acc_resp)
        
    return success_response(results)


@router.patch("/accounts/{account_id}", response_model=dict)
async def update_account(
    account_id: UUID,
    data: FinanceAccountUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update finance account"""
    account = session.get(FinanceAccount, account_id)
    if not account:
        raise NotFoundException("未找到账户")
    
    if data.entity_id is not None:
        account.entity_id = data.entity_id
    if data.account_category is not None:
        account.account_category = AccountCategory(data.account_category)
    if data.account_name is not None:
        account.account_name = data.account_name
    if data.bank_name is not None:
        account.bank_name = data.bank_name
    if data.bank_branch is not None:
        account.bank_branch = data.bank_branch
    if data.currency is not None:
        account.currency = data.currency
    if data.initial_balance is not None:
        account.initial_balance = data.initial_balance
    if data.shareholder_user_id is not None:
        account.shareholder_user_id = data.shareholder_user_id
    if data.is_default is not None:
        account.is_default = data.is_default
    if data.status is not None:
        account.status = AccountStatus(data.status)
    if data.account_no_masked is not None:
        account.account_no_masked = data.account_no_masked

    account.updated_at = datetime.utcnow()
    session.add(account)
    session.commit()
    session.refresh(account)
    
    return success_response(FinanceAccountResponse.model_validate(account))


# Transaction endpoints

@router.post("/transactions", response_model=dict)
async def create_transaction(
    data: TransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create transaction"""
    transaction = FinanceTransaction(
        our_entity_id=data.our_entity_id,
        account_id=data.account_id,
        txn_direction=TransactionDirection(data.txn_direction),
        amount=data.amount,
        currency=data.currency,
        txn_date=data.txn_date,
        counterparty_id=data.counterparty_id,
        contract_id=data.contract_id,
        purpose=data.purpose,
        channel=data.channel,
        reference_no=data.reference_no,
        reconcile_status=ReconcileStatus.UNRECONCILED,
        created_by_user_id=current_user.id
    )
    
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    
    # Update contract pending_amount if transaction is linked to a contract
    if data.contract_id:
        from app.models.contract import Contract, ContractType
        contract = session.get(Contract, data.contract_id)
        if contract:
            # Calculate pending amount change based on contract type and transaction direction
            # Sales contract: income decreases pending (customer payment), expense increases pending (refund)
            # Purchase contract: expense decreases pending (our payment), income increases pending (supplier refund)
            
            if contract.contract_type == ContractType.SALES:
                if data.txn_direction == 'in':
                    # Customer payment - decrease pending amount
                    contract.pending_amount -= data.amount
                else:  # 'out'
                    # Refund to customer - increase pending amount
                    contract.pending_amount += data.amount
            elif contract.contract_type == ContractType.PURCHASE:
                if data.txn_direction == 'out':
                    # Our payment - decrease pending amount
                    contract.pending_amount -= data.amount
                else:  # 'in'
                    # Supplier refund - increase pending amount
                    contract.pending_amount += data.amount
            # For THIRD_PARTY contracts, we don't update pending_amount for now
            
            session.add(contract)
            session.commit()
    
    return success_response(TransactionResponse.model_validate(transaction))


@router.get("/transactions", response_model=dict)
async def list_transactions(
    account_id: Optional[UUID] = Query(None),
    txn_direction: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List transactions"""
    query = select(FinanceTransaction)
    
    if account_id:
        query = query.where(FinanceTransaction.account_id == account_id)
    if txn_direction:
        query = query.where(FinanceTransaction.txn_direction == txn_direction)
    
    query = query.order_by(FinanceTransaction.txn_date.desc())
    
    offset = (page - 1) * page_size
    transactions = session.exec(query.offset(offset).limit(page_size)).all()
    
    count_query = select(FinanceTransaction)
    if account_id:
        count_query = count_query.where(FinanceTransaction.account_id == account_id)
    if txn_direction:
        count_query = count_query.where(FinanceTransaction.txn_direction == txn_direction)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [TransactionResponse.model_validate(t) for t in transactions],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/transactions/{txn_id}", response_model=dict)
async def get_transaction(
    txn_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get transaction"""
    transaction = session.get(FinanceTransaction, txn_id)
    if not transaction:
        raise NotFoundException("未找到交易")
    
    return success_response(TransactionResponse.model_validate(transaction))


# Invoice endpoints

@router.post("/invoices", response_model=dict)
async def create_invoice(
    data: InvoiceCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create invoice"""
    invoice = FinanceInvoice(
        our_entity_id=data.our_entity_id,
        invoice_kind=InvoiceKind(data.invoice_kind),
        invoice_medium=InvoiceMedium(data.invoice_medium),
        invoice_no=data.invoice_no,
        issue_date=data.issue_date,
        amount_with_tax=data.amount_with_tax,
        files=[],  # Files will be uploaded separately
        ocr_status=OCRStatus.PENDING,
        related_contract_id=data.related_contract_id,
        related_payment_plan_id=data.related_payment_plan_id
    )
    
    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    
    return success_response(InvoiceResponse.model_validate(invoice))


@router.get("/invoices", response_model=dict)
async def list_invoices(
    invoice_kind: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List invoices"""
    query = select(FinanceInvoice)
    
    if invoice_kind:
        query = query.where(FinanceInvoice.invoice_kind == invoice_kind)
    
    query = query.order_by(FinanceInvoice.created_at.desc())
    
    offset = (page - 1) * page_size
    invoices = session.exec(query.offset(offset).limit(page_size)).all()
    
    count_query = select(FinanceInvoice)
    if invoice_kind:
        count_query = count_query.where(FinanceInvoice.invoice_kind == invoice_kind)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [InvoiceResponse.model_validate(i) for i in invoices],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


# Reimbursement endpoints

@router.post("/reimbursements", response_model=dict)
async def create_reimbursement(
    data: ReimbursementCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create reimbursement"""
    reimbursement = Reimbursement(
        our_entity_id=data.our_entity_id,
        requester_user_id=current_user.id,
        project_id=data.project_id,
        contract_id=data.contract_id,
        total_amount=data.total_amount,
        expense_lines=data.expense_lines,
        status=ReimbursementStatus.DRAFT
    )
    
    session.add(reimbursement)
    session.commit()
    session.refresh(reimbursement)
    
    return success_response(ReimbursementResponse.model_validate(reimbursement))


@router.get("/reimbursements", response_model=dict)
async def list_reimbursements(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List reimbursements"""
    query = select(Reimbursement).where(Reimbursement.requester_user_id == current_user.id)
    
    if status:
        query = query.where(Reimbursement.status == status)
    
    query = query.order_by(Reimbursement.created_at.desc())
    
    offset = (page - 1) * page_size
    reimbursements = session.exec(query.offset(offset).limit(page_size)).all()
    
    count_query = select(Reimbursement).where(Reimbursement.requester_user_id == current_user.id)
    if status:
        count_query = count_query.where(Reimbursement.status == status)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [ReimbursementResponse.model_validate(r) for r in reimbursements],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })
