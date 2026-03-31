"""
Changelog API endpoints
"""
from typing import Optional
from uuid import UUID
from app.models.base import now_cn
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.exceptions import NotFoundException, ForbiddenException
from app.core.response import success_response
from app.models.iam import User
from app.models.shared import ChangeLog
from pydantic import BaseModel

router = APIRouter(prefix="/changelog", tags=["Changelog"])


class ChangeLogCreate(BaseModel):
    version: str
    title: str
    content: str


class ChangeLogUpdate(BaseModel):
    version: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


def _require_l0(user: User, session: Session):
    """Check that user is L0 (no manager = top level)"""
    if user.manager_user_id is not None:
        raise ForbiddenException("仅 L0 级别员工可执行此操作")


@router.get("/entries", response_model=dict)
async def list_changelog(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List changelog entries (newest first)"""
    query = select(ChangeLog).order_by(ChangeLog.published_at.desc())
    total = len(session.exec(select(ChangeLog)).all())
    offset = (page - 1) * page_size
    entries = session.exec(query.offset(offset).limit(page_size)).all()

    items = []
    for entry in entries:
        publisher = session.get(User, entry.published_by_user_id)
        items.append({
            "id": str(entry.id),
            "version": entry.version,
            "title": entry.title,
            "content": entry.content,
            "published_by_user_id": str(entry.published_by_user_id),
            "published_by_name": publisher.display_name if publisher else "未知",
            "published_at": entry.published_at.isoformat() if entry.published_at else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        })

    return success_response({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@router.post("/entries", response_model=dict)
async def create_changelog(
    data: ChangeLogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a changelog entry (L0 only)"""
    _require_l0(current_user, session)

    entry = ChangeLog(
        version=data.version,
        title=data.title,
        content=data.content,
        published_by_user_id=current_user.id,
        published_at=now_cn(),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    return success_response({
        "id": str(entry.id),
        "version": entry.version,
        "title": entry.title,
    })


@router.patch("/entries/{entry_id}", response_model=dict)
async def update_changelog(
    entry_id: UUID,
    data: ChangeLogUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a changelog entry (L0 only)"""
    _require_l0(current_user, session)

    entry = session.get(ChangeLog, entry_id)
    if not entry:
        raise NotFoundException("未找到更新日志")

    if data.version is not None:
        entry.version = data.version
    if data.title is not None:
        entry.title = data.title
    if data.content is not None:
        entry.content = data.content

    entry.updated_at = now_cn()
    session.add(entry)
    session.commit()
    session.refresh(entry)

    return success_response({
        "id": str(entry.id),
        "version": entry.version,
        "title": entry.title,
    })


@router.delete("/entries/{entry_id}", response_model=dict)
async def delete_changelog(
    entry_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a changelog entry (L0 only)"""
    _require_l0(current_user, session)

    entry = session.get(ChangeLog, entry_id)
    if not entry:
        raise NotFoundException("未找到更新日志")

    session.delete(entry)
    session.commit()

    return success_response({"deleted": True})
