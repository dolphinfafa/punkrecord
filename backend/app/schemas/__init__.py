"""
Pydantic schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


# Auth schemas

class LoginRequest(BaseModel):
    """Login request schema"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    display_name: str


# User schemas

class UserCreate(BaseModel):
    """User creation schema"""
    display_name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    is_shareholder: bool = False


class UserUpdate(BaseModel):
    """User update schema"""
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_shareholder: Optional[bool] = None


class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    display_name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    is_shareholder: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# OurEntity schemas

class OurEntityCreate(BaseModel):
    """Our entity creation schema"""
    name: str
    type: str
    legal_name: Optional[str] = None
    uscc: Optional[str] = None
    address: Optional[str] = None
    default_currency: str = "CNY"


class OurEntityResponse(BaseModel):
    """Our entity response schema"""
    id: UUID
    name: str
    type: str
    legal_name: Optional[str] = None
    status: str
    default_currency: str
    created_at: datetime
    
    class Config:
        from_attributes = True
