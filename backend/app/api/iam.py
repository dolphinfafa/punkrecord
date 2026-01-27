"""
IAM API endpoints (Users, Roles, Entities)
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException
from app.core.response import success_response, PaginatedResponse
from app.models.iam import User, OurEntity, Role, UserStatus
from app.schemas import (
    UserCreate, UserUpdate, UserResponse,
    OurEntityCreate, OurEntityResponse
)

router = APIRouter(prefix="/iam", tags=["IAM"])


# User endpoints

@router.post("/users", response_model=dict)
async def create_user(
    user_data: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new user"""
    new_user = User(
        display_name=user_data.display_name,
        username=user_data.username,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        is_shareholder=user_data.is_shareholder,
        status=UserStatus.ACTIVE
    )
    
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    return success_response(UserResponse.model_validate(new_user))


@router.get("/users", response_model=dict)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List users with pagination"""
    offset = (page - 1) * page_size
    
    users = session.exec(select(User).offset(offset).limit(page_size)).all()
    total = session.exec(select(User)).all()
    
    return success_response({
        "items": [UserResponse.model_validate(u) for u in users],
        "total": len(total),
        "page": page,
        "page_size": page_size,
        "pages": (len(total) + page_size - 1) // page_size
    })


@router.get("/users/{user_id}", response_model=dict)
async def get_user(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get user by ID"""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    
    return success_response(UserResponse.model_validate(user))


@router.patch("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update user"""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundException("未找到用户")
    
    if user_data.display_name is not None:
        user.display_name = user_data.display_name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.is_shareholder is not None:
        user.is_shareholder = user_data.is_shareholder
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return success_response(UserResponse.model_validate(user))


# OurEntity endpoints

@router.post("/our-entities", response_model=dict)
async def create_our_entity(
    entity_data: OurEntityCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create our entity"""
    from app.models.iam import OurEntityType, OurEntityStatus
    
    new_entity = OurEntity(
        name=entity_data.name,
        type=OurEntityType(entity_data.type),
        legal_name=entity_data.legal_name,
        uscc=entity_data.uscc,
        address=entity_data.address,
        default_currency=entity_data.default_currency,
        status=OurEntityStatus.ACTIVE
    )
    
    session.add(new_entity)
    session.commit()
    session.refresh(new_entity)
    
    return success_response(OurEntityResponse.model_validate(new_entity))


@router.get("/our-entities", response_model=dict)
async def list_our_entities(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List our entities"""
    entities = session.exec(select(OurEntity)).all()
    return success_response([OurEntityResponse.model_validate(e) for e in entities])
