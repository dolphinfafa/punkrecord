"""
Authentication API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import verify_password, create_access_token
from app.core.exceptions import UnauthorizedException
from app.core.auth import get_current_user
from app.core.response import success_response
from app.models.iam import User, UserStatus
from app.schemas import LoginRequest, TokenResponse
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
        samesite="lax",
        secure=False  # Set to True in production with HTTPS
    )
    
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        display_name=user.display_name
    )


@router.post("/logout", response_model=dict)
async def logout(response: Response):
    """User logout endpoint"""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=False
    )
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=dict)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user's profile"""
    return success_response({
        "id": str(current_user.id),
        "display_name": current_user.display_name,
        "username": current_user.username,
        "email": current_user.email,
        "status": current_user.status,
    })
