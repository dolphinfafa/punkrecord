"""
Authentication API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import verify_password, create_access_token
from app.core.exceptions import UnauthorizedException
from app.models.iam import User, UserStatus
from app.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    session: Session = Depends(get_session)
):
    """User login endpoint"""
    # Find user by username
    user = session.exec(select(User).where(User.username == login_data.username)).first()
    
    if not user:
        raise UnauthorizedException("Incorrect username or password")
    
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("User is inactive")
    
    if not user.hashed_password:
        raise UnauthorizedException("Password not set for this user")
    
    # Verify password
    if not verify_password(login_data.password, user.hashed_password):
        raise UnauthorizedException("Incorrect username or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        display_name=user.display_name
    )
