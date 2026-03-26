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
