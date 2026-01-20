"""
Authentication dependencies
"""
from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.iam import User, UserStatus

# Security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
) -> User:
    """Get current authenticated user"""
    token = credentials.credentials
    
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise UnauthorizedException("Invalid authentication credentials")
    except Exception:
        raise UnauthorizedException("Invalid authentication credentials")
    
    # Get user from database
    user = session.get(User, UUID(user_id))
    if user is None:
        raise UnauthorizedException("User not found")
    
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("User is inactive")
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if current_user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("Inactive user")
    return current_user


def require_permission(permission_code: str):
    """Dependency to require specific permission"""
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        session: Session = Depends(get_session)
    ):
        # TODO: Implement permission checking logic
        # For now, just check if user is active
        # In full implementation, check user roles and permissions
        if current_user.status != UserStatus.ACTIVE:
            raise ForbiddenException("User does not have required permission")
        return current_user
    
    return permission_checker
