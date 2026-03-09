"""
Authentication dependencies
"""
import logging
from typing import Optional
from uuid import UUID
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.config import settings
from app.models.iam import User, UserStatus, UserRole, Role, RolePermission, Permission, JobTitlePermission

# Security scheme
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: Session = Depends(get_session)
) -> User:
    """Get current authenticated user"""
    logger.debug("Authentication attempt")
    
    # Prefer explicit Bearer token from frontend, then fallback to cookie.
    # This avoids account-mismatch when stale cookies exist across logins.
    token = credentials.credentials if credentials else None
    if not token:
        token = request.cookies.get("access_token")
        
    if not token:
        logger.debug("No token found in cookie or header")
        raise UnauthorizedException("Not authenticated")
    
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.debug("No user_id in token payload")
            raise UnauthorizedException("Invalid authentication credentials")
        logger.debug("Authenticated user id from token: %s", user_id)
    except Exception as e:
        logger.debug("Token decode failed: %s: %s", type(e).__name__, str(e))
        raise UnauthorizedException("Invalid authentication credentials")
    
    # Get user from database
    user = session.get(User, UUID(user_id))
    if user is None:
        logger.debug("User not found in database")
        raise UnauthorizedException("User not found")
    
    if user.status != UserStatus.ACTIVE:
        logger.debug("User is not active: %s", user.status)
        raise UnauthorizedException("User is inactive")
    
    logger.debug("Authentication successful: %s", user.username)
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if current_user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("Inactive user")
    return current_user


def get_user_permissions(user: User, session: Session) -> list[str]:
    """Return the effective permission codes for a user (roles + job title merged)."""
    role_codes = session.exec(
        select(Role.code)
        .select_from(UserRole)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id == user.id)
    ).all()

    if "admin" in role_codes:
        # Admin gets all permissions
        return session.exec(select(Permission.code)).all()

    permission_codes: set[str] = set()

    # Permissions from user roles
    role_perms = session.exec(
        select(Permission.code)
        .select_from(UserRole)
        .join(Role, Role.id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(UserRole.user_id == user.id)
    ).all()
    permission_codes.update(role_perms)

    # Permissions from job title
    if user.job_title_id:
        jt_perms = session.exec(
            select(Permission.code)
            .select_from(JobTitlePermission)
            .join(Permission, Permission.id == JobTitlePermission.permission_id)
            .where(JobTitlePermission.job_title_id == user.job_title_id)
        ).all()
        permission_codes.update(jt_perms)

    return sorted(permission_codes)


def require_permission(permission_code: str):
    """Dependency to require specific permission"""
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        session: Session = Depends(get_session)
    ):
        if current_user.status != UserStatus.ACTIVE:
            raise ForbiddenException("User does not have required permission")

        # Soft rollout mode for legacy users without role assignment.
        if not settings.ENFORCE_RBAC:
            return current_user

        role_codes = session.exec(
            select(Role.code)
            .select_from(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(UserRole.user_id == current_user.id)
        ).all()
        if "admin" in role_codes:
            return current_user

        permission_codes = session.exec(
            select(Permission.code)
            .select_from(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .join(RolePermission, RolePermission.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(UserRole.user_id == current_user.id)
        ).all()

        # Also check permissions from job title
        if current_user.job_title_id:
            jt_permission_codes = session.exec(
                select(Permission.code)
                .select_from(JobTitlePermission)
                .join(Permission, Permission.id == JobTitlePermission.permission_id)
                .where(JobTitlePermission.job_title_id == current_user.job_title_id)
            ).all()
            permission_codes = list(set(permission_codes) | set(jt_permission_codes))

        if permission_code not in set(permission_codes):
            raise ForbiddenException(f"Missing permission: {permission_code}")
        return current_user
    
    return permission_checker
