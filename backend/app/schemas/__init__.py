"""
Pydantic schemas for API requests and responses
"""
from datetime import datetime, date
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
    profile_completed: bool = False
    must_change_password: bool = True


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
    birthday: Optional[str] = None
    id_number: Optional[str] = None
    home_address: Optional[str] = None
    graduation_school: Optional[str] = None
    education_level: Optional[str] = None
    leave_annual_remaining: Optional[float] = None
    leave_maternity_remaining: Optional[float] = None
    leave_marriage_remaining: Optional[float] = None
    leave_personal_remaining: Optional[float] = None
    leave_sick_remaining: Optional[float] = None
    beili_adjust_action: Optional[str] = None  # add | subtract
    beili_adjust_amount: Optional[float] = None


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
    birthday: Optional[str] = None
    id_number: Optional[str] = None
    home_address: Optional[str] = None
    graduation_school: Optional[str] = None
    education_level: Optional[str] = None
    id_card_image: Optional[str] = None
    resume_file: Optional[str] = None
    profile_completed: bool = False
    must_change_password: bool = True
    leave_annual_remaining: float = 5.0
    leave_maternity_remaining: float = 15.0
    leave_marriage_remaining: float = 3.0
    leave_personal_remaining: float = 3.0
    leave_sick_remaining: float = 3.0
    beili_balance: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileCompleteRequest(BaseModel):
    """Profile completion request for first-time login"""
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    id_number: Optional[str] = None
    home_address: Optional[str] = None
    graduation_school: Optional[str] = None
    education_level: Optional[str] = None
    new_password: str


class ChangePasswordRequest(BaseModel):
    """Password change request"""
    old_password: str
    new_password: str


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


class BeliRuleCreate(BaseModel):
    name: str
    rule_type: str = "task_timeliness"
    enabled: bool = True
    early_days: int = 0
    reward_beili: float = 0.0
    late_days: int = 0
    penalty_beili: float = 0.0
    note: Optional[str] = None


class BeliRuleUpdate(BaseModel):
    name: Optional[str] = None
    rule_type: Optional[str] = None
    enabled: Optional[bool] = None
    early_days: Optional[int] = None
    reward_beili: Optional[float] = None
    late_days: Optional[int] = None
    penalty_beili: Optional[float] = None
    note: Optional[str] = None


class BeliRuleResponse(BaseModel):
    id: UUID
    name: str
    rule_type: str
    enabled: bool
    early_days: int
    reward_beili: float
    late_days: int
    penalty_beili: float
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
