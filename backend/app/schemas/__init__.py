"""
Pydantic schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List
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


# JobTitle schemas

class JobTitleCreate(BaseModel):
    """Job title creation schema"""
    name: str
    description: Optional[str] = None


class JobTitleUpdate(BaseModel):
    """Job title update schema"""
    name: Optional[str] = None
    description: Optional[str] = None


class JobTitleResponse(BaseModel):
    """Job title response schema"""
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Department (OrgUnit) schemas

class DepartmentCreate(BaseModel):
    """Department creation schema"""
    name: str
    description: Optional[str] = None
    parent_org_unit_id: Optional[UUID] = None


class DepartmentUpdate(BaseModel):
    """Department update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    parent_org_unit_id: Optional[UUID] = None


class DepartmentResponse(BaseModel):
    """Department response schema"""
    id: UUID
    name: str
    description: Optional[str] = None
    parent_org_unit_id: Optional[UUID] = None
    member_count: int = 0
    children: List["DepartmentResponse"] = []
    created_at: datetime

    class Config:
        from_attributes = True

DepartmentResponse.model_rebuild()


# User schemas

class UserCreate(BaseModel):
    """User creation schema"""
    display_name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    is_shareholder: bool = False
    manager_user_id: Optional[UUID] = None
    job_title_id: Optional[UUID] = None
    department_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    """User update schema"""
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_shareholder: Optional[bool] = None
    status: Optional[str] = None
    manager_user_id: Optional[UUID] = None
    job_title_id: Optional[UUID] = None
    department_id: Optional[UUID] = None


class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    display_name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    is_shareholder: bool
    level: int = 0  # Auto-calculated from manager chain depth
    manager_user_id: Optional[UUID] = None
    manager_name: Optional[str] = None
    job_title_id: Optional[UUID] = None
    job_title_name: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
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


# Org chart schemas

class OrgChartNode(BaseModel):
    """Org chart node"""
    id: UUID
    display_name: str
    job_title_name: Optional[str] = None
    department_name: Optional[str] = None
    is_shareholder: bool
    level: int = 0
    children: List["OrgChartNode"] = []

OrgChartNode.model_rebuild()
