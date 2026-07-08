"""
Contract API endpoints
"""
from typing import Optional
from app.models.base import now_cn
from uuid import UUID, uuid4
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user, require_permission
from app.core.exceptions import NotFoundException, ValidationException
from app.core.response import success_response
from app.core.storage import delete_file, get_download_url, get_file, save_file
from app.models.iam import User
from app.models.contract import (
    Contract, Counterparty, ContractPaymentPlan,
    ContractType, ContractStatus, CounterpartyType,
    PaymentDirection, PaymentPlanStatus
)
from app.schemas.contract import (
    CounterpartyCreate, CounterpartyResponse,
    ContractCreate, ContractUpdate, ContractResponse,
    ContractAttachmentResponse, PaymentPlanResponse
)

router = APIRouter(prefix="/contract", tags=["Contract"])

MAX_CONTRACT_ATTACHMENT_SIZE = 20 * 1024 * 1024
ALLOWED_CONTRACT_ATTACHMENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
}
ALLOWED_CONTRACT_ATTACHMENT_SUFFIXES = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
}


def _validate_contract_attachment(file: UploadFile, file_bytes: bytes) -> str:
    """Validate contract attachment and return the safe suffix."""
    if not file.filename:
        raise ValidationException("附件文件名不能为空")
    if not file_bytes:
        raise ValidationException("附件内容不能为空")
    if len(file_bytes) > MAX_CONTRACT_ATTACHMENT_SIZE:
        raise ValidationException("附件大小不能超过 20MB")

    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    suffix = Path(file.filename).suffix.lower()
    if (
        content_type not in ALLOWED_CONTRACT_ATTACHMENT_TYPES
        and suffix not in ALLOWED_CONTRACT_ATTACHMENT_SUFFIXES
    ):
        raise ValidationException("合同附件仅支持 PDF 或图片格式")
    return suffix[:20]


def _find_contract_attachment(contract: Contract, attachment_id: str) -> dict:
    attachment = next((a for a in (contract.attachments or []) if a.get("id") == attachment_id), None)
    if not attachment:
        raise NotFoundException("未找到附件")
    return attachment


def _attachment_response(attachment: dict) -> dict:
    """Return public attachment metadata for API responses."""
    return ContractAttachmentResponse(
        id=attachment.get("id", ""),
        file_name=attachment.get("file_name") or "attachment",
        content_type=attachment.get("content_type") or "application/octet-stream",
        size=int(attachment.get("size") or 0),
        uploaded_at=attachment.get("uploaded_at") or "",
    ).model_dump()


# Counterparty endpoints

@router.post("/counterparties", response_model=dict)
async def create_counterparty(
    data: CounterpartyCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.write"))
):
    """Create counterparty"""
    counterparty = Counterparty(
        name=data.name,
        type=data.type,  # Use string directly
        identifier=data.identifier,
        address=data.address,
        phone=data.phone,
        bank_name=data.bank_name,
        bank_account=data.bank_account
    )
    
    session.add(counterparty)
    session.commit()
    session.refresh(counterparty)
    
    return success_response(CounterpartyResponse.model_validate(counterparty))


@router.patch("/counterparties/{counterparty_id}", response_model=dict)
async def update_counterparty(
    counterparty_id: UUID,
    data: CounterpartyCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.write"))
):
    """Update counterparty"""
    cp = session.get(Counterparty, counterparty_id)
    if not cp:
        raise NotFoundException("交易方不存在")
    for field in ["name", "type", "identifier", "address", "phone", "bank_name", "bank_account"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(cp, field, val)
    cp.updated_at = now_cn()
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return success_response(CounterpartyResponse.model_validate(cp))


@router.get("/counterparties", response_model=dict)
async def list_counterparties(
    type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List counterparties with pagination (accessible to all logged-in users)"""
    query = select(Counterparty)
    if type:
        query = query.where(Counterparty.type == type)

    all_items = session.exec(query.order_by(Counterparty.created_at.desc())).all()
    total = len(all_items)
    start = (page - 1) * page_size
    items = all_items[start:start + page_size]
    return success_response({
        "items": [CounterpartyResponse.model_validate(c) for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    })


# Contract endpoints

@router.post("/contracts", response_model=dict)
async def create_contract(
    data: ContractCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.write"))
):
    """Create contract"""
    # Auto-generate contract_no when omitted, consistent with the web page
    # default (CNT-<timestamp>); add a short random suffix to avoid collisions.
    contract_no = (data.contract_no or "").strip()
    if not contract_no:
        import secrets as _secrets
        contract_no = f"CNT-{int(now_cn().timestamp() * 1000)}-{_secrets.token_hex(2)}"

    contract = Contract(
        contract_no=contract_no,
        name=data.name,
        contract_type=ContractType(data.contract_type),
        status=ContractStatus.DRAFT,
        party_a_id=data.party_a_id,
        party_b_id=data.party_b_id,
        party_c_id=data.party_c_id,
        owner_user_id=current_user.id,
        pm_user_id=data.pm_user_id,
        amount_total=data.amount_total,
        pending_amount=data.amount_total,  # Initialize pending_amount to total amount
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
    page_size: int = Query(20, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.read"))
):
    """List contracts"""
    try:
        print(f"🔍 list_contracts called by user: {current_user.username}")
        print(f"   Parameters: status={status}, contract_type={contract_type}, page={page}, page_size={page_size}")
        
        query = select(Contract)
        
        if status:
            query = query.where(Contract.status == status)
        if contract_type:
            query = query.where(Contract.contract_type == contract_type)
        
        query = query.order_by(Contract.created_at.desc())
        
        offset = (page - 1) * page_size
        contracts = session.exec(query.offset(offset).limit(page_size)).all()
        print(f"   Found {len(contracts)} contracts")
        
        count_query = select(Contract)
        if status:
            count_query = count_query.where(Contract.status == status)
        if contract_type:
            count_query = count_query.where(Contract.contract_type == contract_type)
        total = len(session.exec(count_query).all())
        print(f"   Total count: {total}")
        
        print(f"   Converting contracts to response schema...")
        response_items = [ContractResponse.model_validate(c) for c in contracts]
        print(f"   ✅ Conversion successful")
        
        return success_response({
            "items": response_items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size
        })
    except Exception as e:
        print(f"   ❌ Error in list_contracts: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise


@router.get("/contracts/{contract_id}", response_model=dict)
async def get_contract(
    contract_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.read"))
):
    """Get contract by ID"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")
    
    return success_response(ContractResponse.model_validate(contract))


@router.get("/contracts/{contract_id}/attachments", response_model=dict)
async def list_contract_attachments(
    contract_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.read"))
):
    """List attachments for a contract."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")
    return success_response([_attachment_response(attachment) for attachment in (contract.attachments or [])])


@router.post("/contracts/{contract_id}/attachments", response_model=dict)
async def upload_contract_attachment(
    contract_id: UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.write"))
):
    """Upload a PDF/image attachment for a contract."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")

    file_bytes = await file.read()
    safe_suffix = _validate_contract_attachment(file, file_bytes)
    content_type = (file.content_type or "application/octet-stream").split(";", 1)[0].strip().lower()
    attachment_id = uuid4().hex
    stored_name = f"{contract_id}_{attachment_id}{safe_suffix}"
    save_file("contract-attachments", stored_name, file_bytes, content_type)

    attachment = {
        "id": attachment_id,
        "file_name": file.filename,
        "stored_name": stored_name,
        "content_type": content_type,
        "size": len(file_bytes),
        "uploaded_at": now_cn().isoformat(),
    }
    attachments = list(contract.attachments or [])
    attachments.append(attachment)
    contract.attachments = attachments
    contract.updated_at = now_cn()
    session.add(contract)
    session.commit()

    return success_response(_attachment_response(attachment))


@router.get("/contracts/{contract_id}/attachments/{attachment_id}/view")
async def view_contract_attachment(
    contract_id: UUID,
    attachment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.read"))
):
    """View a PDF/image contract attachment inline."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")

    attachment = _find_contract_attachment(contract, attachment_id)
    stored_name = attachment.get("stored_name")
    if not stored_name:
        raise NotFoundException("附件元数据异常")

    url = get_download_url("contract-attachments", stored_name)
    if url:
        return RedirectResponse(url)

    try:
        _, local_path = get_file("contract-attachments", stored_name)
    except FileNotFoundError:
        raise NotFoundException("附件文件不存在")

    return FileResponse(
        path=local_path,
        media_type=attachment.get("content_type") or "application/octet-stream",
        filename=attachment.get("file_name") or "attachment",
        content_disposition_type="inline",
    )


@router.get("/contracts/{contract_id}/attachments/{attachment_id}/download")
async def download_contract_attachment(
    contract_id: UUID,
    attachment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.read"))
):
    """Download a contract attachment."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")

    attachment = _find_contract_attachment(contract, attachment_id)
    stored_name = attachment.get("stored_name")
    if not stored_name:
        raise NotFoundException("附件元数据异常")

    url = get_download_url("contract-attachments", stored_name)
    if url:
        return RedirectResponse(url)

    try:
        _, local_path = get_file("contract-attachments", stored_name)
    except FileNotFoundError:
        raise NotFoundException("附件文件不存在")

    return FileResponse(
        path=local_path,
        media_type=attachment.get("content_type") or "application/octet-stream",
        filename=attachment.get("file_name") or "attachment",
    )


@router.delete("/contracts/{contract_id}/attachments/{attachment_id}", response_model=dict)
async def delete_contract_attachment(
    contract_id: UUID,
    attachment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.write"))
):
    """Delete a contract attachment."""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")

    attachments = list(contract.attachments or [])
    idx = next((i for i, item in enumerate(attachments) if item.get("id") == attachment_id), None)
    if idx is None:
        raise NotFoundException("未找到附件")

    removed = attachments.pop(idx)
    stored_name = removed.get("stored_name")
    if stored_name:
        try:
            delete_file("contract-attachments", stored_name)
        except Exception:
            pass

    contract.attachments = attachments
    contract.updated_at = now_cn()
    session.add(contract)
    session.commit()

    return success_response({"message": "附件已删除"})


@router.patch("/contracts/{contract_id}", response_model=dict)
async def update_contract(
    contract_id: UUID,
    data: ContractUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.write"))
):
    """Update contract"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")
    
    if data.contract_no is not None:
        contract.contract_no = data.contract_no
    if data.name is not None:
        contract.name = data.name
    if data.contract_type is not None:
        contract.contract_type = data.contract_type
    if data.status is not None:
        contract.status = ContractStatus(data.status)
    if data.party_a_id is not None:
        contract.party_a_id = data.party_a_id
    if data.party_b_id is not None:
        contract.party_b_id = data.party_b_id
    if data.party_c_id is not None:
        contract.party_c_id = data.party_c_id
    if data.amount_total is not None:
        # Recalculate pending_amount: new_total - already_paid
        old_total = contract.amount_total
        already_paid = old_total - contract.pending_amount  # amount already settled
        contract.amount_total = data.amount_total
        contract.pending_amount = data.amount_total - already_paid
    if data.currency is not None:
        contract.currency = data.currency
    if data.pm_user_id is not None:
        contract.pm_user_id = data.pm_user_id
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
    
    contract.updated_at = now_cn()
    session.add(contract)
    session.commit()
    session.refresh(contract)
    
    return success_response(ContractResponse.model_validate(contract))


@router.get("/contracts/{contract_id}/payment-plans", response_model=dict)
async def get_contract_payment_plans(
    contract_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("contract.read"))
):
    """Get contract payment plans"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")
    
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
    current_user: User = Depends(require_permission("contract.write"))
):
    """Submit contract for approval"""
    contract = session.get(Contract, contract_id)
    if not contract:
        raise NotFoundException("未找到合同")
    
    if contract.status != ContractStatus.DRAFT:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有草稿状态的合同才能提交")
    
    contract.status = ContractStatus.IN_APPROVAL
    contract.updated_at = now_cn()
    
    session.add(contract)
    session.commit()
    
    # TODO: Create approval instance and steps
    # This will be implemented when we add the approval service
    
    return success_response(ContractResponse.model_validate(contract))
