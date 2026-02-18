"""
Todo API endpoints
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
from app.models.todo import (
    TodoItem, TodoStatus, TodoSourceType, TodoActionType,
    NotificationLog, NotificationChannel, NotificationStatus
)
from app.schemas.todo import TodoCreate, TodoUpdate, TodoReviewAction, TodoResponse

router = APIRouter(prefix="/todo", tags=["Todo"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_todo(todo: TodoItem, session: Session) -> TodoResponse:
    """Build TodoResponse with resolved assignee/creator names."""
    assignee = session.get(User, todo.assignee_user_id)
    creator = session.get(User, todo.creator_user_id)
    data = TodoResponse.model_validate(todo)
    data.assignee_name = assignee.display_name if assignee else None
    data.creator_name = creator.display_name if creator else None
    return data


def _notify_manager(user_id: UUID, todo: TodoItem, session: Session):
    """Create an in-app notification for the user's manager (if they have one)."""
    user = session.get(User, user_id)
    if not user or not user.manager_user_id:
        return
    log = NotificationLog(
        todo_id=todo.id,
        channel=NotificationChannel.IN_APP,
        status=NotificationStatus.SENT,
        sent_at=datetime.utcnow(),
    )
    session.add(log)


def _is_direct_manager(manager: User, subordinate: User) -> bool:
    """Check if manager is the direct manager of subordinate."""
    return subordinate.manager_user_id == manager.id


# ─── Create ──────────────────────────────────────────────────────────────────

@router.post("", response_model=dict)
async def create_todo(
    todo_data: TodoCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new todo item. Notifies the assignee's manager."""
    import uuid as _uuid
    source_id = todo_data.source_id or str(_uuid.uuid4())

    new_todo = TodoItem(
        our_entity_id=todo_data.our_entity_id,
        assignee_user_id=todo_data.assignee_user_id,
        creator_user_id=current_user.id,
        title=todo_data.title,
        description=todo_data.description,
        source_type=TodoSourceType(todo_data.source_type),
        source_id=source_id,
        action_type=TodoActionType(todo_data.action_type),
        priority=todo_data.priority,
        status=TodoStatus.OPEN,
        due_at=todo_data.due_at,
        start_at=todo_data.start_at,
        tags=todo_data.tags,
        link=todo_data.link
    )

    session.add(new_todo)
    session.commit()
    session.refresh(new_todo)

    # Notify the assignee's manager
    _notify_manager(todo_data.assignee_user_id, new_todo, session)
    session.commit()

    return success_response(_enrich_todo(new_todo, session))


# ─── My todos ────────────────────────────────────────────────────────────────

@router.get("/my", response_model=dict)
async def get_my_todos(
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current user's todos (assigned to me)."""
    query = select(TodoItem).where(TodoItem.assignee_user_id == current_user.id)

    if status:
        if status == "open":
            # "open" filter includes open, in_progress, blocked
            from sqlmodel import or_
            query = query.where(or_(
                TodoItem.status == TodoStatus.OPEN,
                TodoItem.status == TodoStatus.IN_PROGRESS,
                TodoItem.status == TodoStatus.BLOCKED,
            ))
        else:
            query = query.where(TodoItem.status == status)
    if source_type:
        query = query.where(TodoItem.source_type == source_type)

    query = query.order_by(TodoItem.due_at)

    count_query = query
    total = len(session.exec(count_query).all())

    offset = (page - 1) * page_size
    todos = session.exec(query.offset(offset).limit(page_size)).all()

    return success_response({
        "items": [_enrich_todo(t, session) for t in todos],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


# ─── Team todos (manager view) ───────────────────────────────────────────────

@router.get("/team", response_model=dict)
async def get_team_todos(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get direct subordinates' todos (one level only)."""
    # Find direct subordinates
    subordinates = session.exec(
        select(User).where(User.manager_user_id == current_user.id)
    ).all()
    subordinate_ids = [u.id for u in subordinates]

    if not subordinate_ids:
        return success_response({"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 0})

    from sqlmodel import col
    query = select(TodoItem).where(col(TodoItem.assignee_user_id).in_(subordinate_ids))

    if status:
        query = query.where(TodoItem.status == status)

    query = query.order_by(TodoItem.due_at)

    total = len(session.exec(query).all())
    offset = (page - 1) * page_size
    todos = session.exec(query.offset(offset).limit(page_size)).all()

    return success_response({
        "items": [_enrich_todo(t, session) for t in todos],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "subordinates": [{"id": str(u.id), "display_name": u.display_name} for u in subordinates]
    })


# ─── Single todo ─────────────────────────────────────────────────────────────

@router.get("/{todo_id}", response_model=dict)
async def get_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get todo by ID."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    # Access: assignee, creator, or direct manager of assignee
    assignee = session.get(User, todo.assignee_user_id)
    is_manager = assignee and assignee.manager_user_id == current_user.id
    if (todo.assignee_user_id != current_user.id
            and todo.creator_user_id != current_user.id
            and not is_manager):
        raise NotFoundException("未找到待办事项")

    return success_response(_enrich_todo(todo, session))


# ─── Update ──────────────────────────────────────────────────────────────────

@router.patch("/{todo_id}", response_model=dict)
async def update_todo(
    todo_id: UUID,
    todo_data: TodoUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update todo (assignee or creator only)."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id and todo.creator_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    if todo_data.title is not None:
        todo.title = todo_data.title
    if todo_data.description is not None:
        todo.description = todo_data.description
    if todo_data.priority is not None:
        todo.priority = todo_data.priority
    if todo_data.due_at is not None:
        todo.due_at = todo_data.due_at
    if todo_data.start_at is not None:
        todo.start_at = todo_data.start_at
    if todo_data.tags is not None:
        todo.tags = todo_data.tags

    todo.updated_at = datetime.utcnow()
    session.add(todo)
    session.commit()
    session.refresh(todo)

    return success_response(_enrich_todo(todo, session))


# ─── Submit for review ───────────────────────────────────────────────────────

@router.post("/{todo_id}/submit", response_model=dict)
async def submit_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Employee submits task as complete → pending_review. Notifies manager."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("只有被分配人才能提交完成")

    if todo.status not in (TodoStatus.OPEN, TodoStatus.IN_PROGRESS, TodoStatus.BLOCKED):
        from app.core.exceptions import ValidationException
        raise ValidationException(f"当前状态 {todo.status} 不能提交完成")

    todo.status = TodoStatus.PENDING_REVIEW
    todo.review_comment = None  # Clear previous rejection comment
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    # Notify manager
    _notify_manager(current_user.id, todo, session)
    session.commit()

    return success_response(_enrich_todo(todo, session))


# ─── Approve ─────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/approve", response_model=dict)
async def approve_todo(
    todo_id: UUID,
    data: TodoReviewAction = TodoReviewAction(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Manager approves task completion → done."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    # Must be the direct manager of the assignee
    assignee = session.get(User, todo.assignee_user_id)
    if not assignee or assignee.manager_user_id != current_user.id:
        raise NotFoundException("只有直属上级才能审核")

    if todo.status != TodoStatus.PENDING_REVIEW:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有上报完成的任务才能审核")

    todo.status = TodoStatus.DONE
    todo.done_at = datetime.utcnow()
    todo.done_by_user_id = current_user.id
    todo.reviewed_by_user_id = current_user.id
    todo.review_comment = data.comment
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    return success_response(_enrich_todo(todo, session))


# ─── Reject ──────────────────────────────────────────────────────────────────

@router.post("/{todo_id}/reject", response_model=dict)
async def reject_todo(
    todo_id: UUID,
    data: TodoReviewAction,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Manager rejects task, sends it back with a comment."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    assignee = session.get(User, todo.assignee_user_id)
    if not assignee or assignee.manager_user_id != current_user.id:
        raise NotFoundException("只有直属上级才能退回")

    if todo.status != TodoStatus.PENDING_REVIEW:
        from app.core.exceptions import ValidationException
        raise ValidationException("只有上报完成的任务才能退回")

    todo.status = TodoStatus.OPEN
    todo.reviewed_by_user_id = current_user.id
    todo.review_comment = data.comment or "请修改后重新提交"
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    return success_response(_enrich_todo(todo, session))


# ─── Legacy actions ──────────────────────────────────────────────────────────

@router.post("/{todo_id}/done", response_model=dict)
async def mark_todo_done(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Direct done (kept for backward compatibility, now redirects to submit flow)."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    if todo.action_type == TodoActionType.APPROVE:
        from app.core.exceptions import ValidationException
        raise ValidationException("审批类型的待办事项必须通过审批API完成")

    # Use submit flow: go to pending_review
    todo.status = TodoStatus.PENDING_REVIEW
    todo.review_comment = None
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    _notify_manager(current_user.id, todo, session)
    session.commit()

    return success_response(_enrich_todo(todo, session))


@router.post("/{todo_id}/block", response_model=dict)
async def block_todo(
    todo_id: UUID,
    blocked_reason: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Block todo with reason."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    todo.status = TodoStatus.BLOCKED
    todo.blocked_reason = blocked_reason
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    return success_response(_enrich_todo(todo, session))


@router.post("/{todo_id}/dismiss", response_model=dict)
async def dismiss_todo(
    todo_id: UUID,
    dismiss_reason: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Dismiss todo."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("未找到待办事项")

    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("未找到待办事项")

    todo.status = TodoStatus.DISMISSED
    todo.dismiss_reason = dismiss_reason
    todo.updated_at = datetime.utcnow()

    session.add(todo)
    session.commit()
    session.refresh(todo)

    return success_response(_enrich_todo(todo, session))
