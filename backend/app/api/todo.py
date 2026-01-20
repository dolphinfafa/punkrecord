"""
Todo API endpoints
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, or_
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.iam import User
from app.models.todo import TodoItem, TodoStatus, TodoSourceType, TodoActionType
from app.schemas.todo import TodoCreate, TodoUpdate, TodoStatusUpdate, TodoResponse

router = APIRouter(prefix="/todo", tags=["Todo"])


@router.post("", response_model=dict)
async def create_todo(
    todo_data: TodoCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new todo item"""
    new_todo = TodoItem(
        our_entity_id=todo_data.our_entity_id,
        assignee_user_id=todo_data.assignee_user_id,
        creator_user_id=current_user.id,
        title=todo_data.title,
        description=todo_data.description,
        source_type=TodoSourceType(todo_data.source_type),
        source_id=todo_data.source_id,
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
    
    return success_response(TodoResponse.model_validate(new_todo))


@router.get("/my", response_model=dict)
async def get_my_todos(
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current user's todos"""
    query = select(TodoItem).where(TodoItem.assignee_user_id == current_user.id)
    
    # Apply filters
    if status:
        query = query.where(TodoItem.status == status)
    if source_type:
        query = query.where(TodoItem.source_type == source_type)
    
    # Order by priority and due date
    query = query.order_by(TodoItem.due_at)
    
    # Pagination
    offset = (page - 1) * page_size
    todos = session.exec(query.offset(offset).limit(page_size)).all()
    
    # Get total count
    count_query = select(TodoItem).where(TodoItem.assignee_user_id == current_user.id)
    if status:
        count_query = count_query.where(TodoItem.status == status)
    if source_type:
        count_query = count_query.where(TodoItem.source_type == source_type)
    total = len(session.exec(count_query).all())
    
    return success_response({
        "items": [TodoResponse.model_validate(t) for t in todos],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    })


@router.get("/{todo_id}", response_model=dict)
async def get_todo(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get todo by ID"""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("Todo not found")
    
    # Check if user has access
    if todo.assignee_user_id != current_user.id and todo.creator_user_id != current_user.id:
        raise NotFoundException("Todo not found")
    
    return success_response(TodoResponse.model_validate(todo))


@router.patch("/{todo_id}", response_model=dict)
async def update_todo(
    todo_id: UUID,
    todo_data: TodoUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update todo"""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("Todo not found")
    
    # Only assignee or creator can update
    if todo.assignee_user_id != current_user.id and todo.creator_user_id != current_user.id:
        raise NotFoundException("Todo not found")
    
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
    
    return success_response(TodoResponse.model_validate(todo))


@router.post("/{todo_id}/done", response_model=dict)
async def mark_todo_done(
    todo_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark todo as done"""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("Todo not found")
    
    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("Todo not found")
    
    # Cannot mark approval type todos as done directly
    if todo.action_type == TodoActionType.APPROVE:
        from app.core.exceptions import ValidationException
        raise ValidationException("Approval todos must be completed through approval API")
    
    todo.status = TodoStatus.DONE
    todo.done_at = datetime.utcnow()
    todo.done_by_user_id = current_user.id
    todo.updated_at = datetime.utcnow()
    
    session.add(todo)
    session.commit()
    session.refresh(todo)
    
    return success_response(TodoResponse.model_validate(todo))


@router.post("/{todo_id}/block", response_model=dict)
async def block_todo(
    todo_id: UUID,
    blocked_reason: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Block todo with reason"""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("Todo not found")
    
    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("Todo not found")
    
    todo.status = TodoStatus.BLOCKED
    todo.blocked_reason = blocked_reason
    todo.updated_at = datetime.utcnow()
    
    session.add(todo)
    session.commit()
    session.refresh(todo)
    
    return success_response(TodoResponse.model_validate(todo))


@router.post("/{todo_id}/dismiss", response_model=dict)
async def dismiss_todo(
    todo_id: UUID,
    dismiss_reason: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Dismiss todo"""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise NotFoundException("Todo not found")
    
    if todo.assignee_user_id != current_user.id:
        raise NotFoundException("Todo not found")
    
    todo.status = TodoStatus.DISMISSED
    todo.dismiss_reason = dismiss_reason
    todo.updated_at = datetime.utcnow()
    
    session.add(todo)
    session.commit()
    session.refresh(todo)
    
    return success_response(TodoResponse.model_validate(todo))
