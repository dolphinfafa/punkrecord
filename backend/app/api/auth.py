"""
Authentication API endpoints
"""
from fastapi import APIRouter, Depends, Response
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.exceptions import UnauthorizedException, ValidationException
from app.core.auth import get_current_user, get_user_permissions
from app.core.response import success_response
from app.models.iam import User, UserStatus, EducationLevel
from app.schemas import LoginRequest, TokenResponse, ProfileCompleteRequest, ChangePasswordRequest
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    response: Response,
    session: Session = Depends(get_session)
):
    """User login endpoint"""
    # Find user by username
    user = session.exec(select(User).where(User.username == login_data.username)).first()
    
    if not user:
        raise UnauthorizedException("用户名或密码错误")
    
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("用户已停用")
    
    if not user.hashed_password:
        raise UnauthorizedException("该用户未设置密码")
    
    # Verify password
    if not verify_password(login_data.password, user.hashed_password):
        raise UnauthorizedException("用户名或密码错误")
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # Set HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE
    )
    
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        display_name=user.display_name,
        profile_completed=user.profile_completed,
        must_change_password=user.must_change_password,
    )


@router.post("/logout", response_model=dict)
async def logout(response: Response):
    """User logout endpoint"""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE
    )
    return {"message": "Successfully logged out"}


@router.post("/complete-profile", response_model=dict)
async def complete_profile(
    data: ProfileCompleteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """First-time login: fill in profile info and set new password."""
    if not data.new_password or len(data.new_password) < 6:
        raise ValidationException("新密码长度不能少于6位")

    if data.email:
        current_user.email = data.email
    if data.phone:
        current_user.phone = data.phone
    if data.birthday:
        current_user.birthday = data.birthday
    if data.id_number:
        current_user.id_number = data.id_number
    if data.home_address:
        current_user.home_address = data.home_address
    if data.graduation_school:
        current_user.graduation_school = data.graduation_school
    if data.education_level:
        current_user.education_level = EducationLevel(data.education_level)

    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.profile_completed = True
    current_user.must_change_password = False

    session.add(current_user)
    session.commit()
    return success_response({"message": "档案已完善，密码已更新"})


@router.post("/change-password", response_model=dict)
async def change_password(
    data: ChangePasswordRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Change current user's password."""
    if not data.new_password or len(data.new_password) < 6:
        raise ValidationException("新密码长度不能少于6位")
    if not verify_password(data.old_password, current_user.hashed_password):
        raise UnauthorizedException("原密码错误")

    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.must_change_password = False
    session.add(current_user)
    session.commit()
    return success_response({"message": "密码修改成功"})


@router.get("/me", response_model=dict)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get current authenticated user's profile"""
    from app.models.iam import JobTitle
    permissions = get_user_permissions(current_user, session)
    job_title_name = None
    if current_user.job_title_id:
        jt = session.get(JobTitle, current_user.job_title_id)
        if jt:
            job_title_name = jt.name
    return success_response({
        "id": str(current_user.id),
        "display_name": current_user.display_name,
        "username": current_user.username,
        "email": current_user.email,
        "status": current_user.status,
        "profile_completed": current_user.profile_completed,
        "must_change_password": current_user.must_change_password,
        "permissions": permissions,
        "job_title_name": job_title_name,
    })


# ─── Agent Token Management ─────────────────────────────────────────────────

@router.post("/agent-tokens", response_model=dict)
async def create_agent_token(
    data: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Generate a new Agent Token for the current user."""
    import secrets
    from datetime import datetime, timedelta
    from app.models.shared import AgentToken
    from app.models.base import now_cn

    name = data.get("name", "").strip() or "Agent Token"
    expires_in_days = data.get("expires_in_days")  # None = never expires

    token_value = "pat_" + secrets.token_hex(32)
    expires_at = None
    if expires_in_days:
        expires_at = now_cn() + timedelta(days=int(expires_in_days))

    agent_token = AgentToken(
        user_id=current_user.id,
        token=token_value,
        name=name,
        expires_at=expires_at,
        is_active=True,
    )
    session.add(agent_token)
    session.commit()
    session.refresh(agent_token)

    return success_response({
        "id": str(agent_token.id),
        "name": agent_token.name,
        "token": token_value,  # Only returned once
        "expires_at": agent_token.expires_at.isoformat() if agent_token.expires_at else None,
        "created_at": agent_token.created_at.isoformat(),
    })


@router.get("/agent-tokens", response_model=dict)
async def list_agent_tokens(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all Agent Tokens for the current user."""
    from app.models.shared import AgentToken

    tokens = session.exec(
        select(AgentToken)
        .where(AgentToken.user_id == current_user.id)
        .order_by(AgentToken.created_at.desc())
    ).all()

    return success_response([
        {
            "id": str(t.id),
            "name": t.name,
            "token_preview": t.token[:8] + "****" + t.token[-4:],
            "is_active": t.is_active,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None,
            "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
            "created_at": t.created_at.isoformat(),
        }
        for t in tokens
    ])


@router.delete("/agent-tokens/{token_id}", response_model=dict)
async def revoke_agent_token(
    token_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Revoke (deactivate) an Agent Token."""
    from uuid import UUID as _UUID
    from app.models.shared import AgentToken

    agent_token = session.get(AgentToken, _UUID(token_id))
    if not agent_token or agent_token.user_id != current_user.id:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Token not found")

    agent_token.is_active = False
    session.add(agent_token)
    session.commit()

    return success_response({"message": "Token has been revoked"})
