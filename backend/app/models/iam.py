"""
IAM Module Models
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from enum import Enum
from sqlmodel import Field, Relationship, SQLModel
from app.models.base import BaseDBModel


# Enums
class UserStatus(str, Enum):
    """User status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"


class OurEntityType(str, Enum):
    """Our entity type enumeration"""
    COMPANY = "company"
    BRANCH = "branch"
    STUDIO = "studio"
    OTHER = "other"


class OurEntityStatus(str, Enum):
    """Our entity status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"


class ScopeType(str, Enum):
    """Authorization scope type"""
    GLOBAL = "global"
    OUR_ENTITY = "our_entity"
    ALL_ENTITIES = "all_entities"


# Models

class OurEntity(BaseDBModel, table=True):
    """Our Entity (Company/Branch) model"""
    __tablename__ = "our_entity"
    
    name: str = Field(nullable=False)
    type: OurEntityType = Field(nullable=False)
    legal_name: Optional[str] = None
    uscc: Optional[str] = None  # Unified Social Credit Code
    address: Optional[str] = None
    default_currency: str = Field(default="CNY", nullable=False)
    status: OurEntityStatus = Field(default=OurEntityStatus.ACTIVE, nullable=False)
    
    # Default personnel
    default_finance_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    default_cashier_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    default_seal_admin_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    default_legal_user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")


class User(BaseDBModel, table=True):
    """User model"""
    __tablename__ = "user"
    
    display_name: str = Field(nullable=False)
    email: Optional[str] = Field(default=None, unique=True)
    phone: Optional[str] = None
    username: Optional[str] = Field(default=None, unique=True)
    hashed_password: Optional[str] = None
    status: UserStatus = Field(default=UserStatus.ACTIVE, nullable=False)
    is_shareholder: bool = Field(default=False, nullable=False)
    
    # Relationships
    user_roles: List["UserRole"] = Relationship(back_populates="user")


class Permission(BaseDBModel, table=True):
    """Permission model"""
    __tablename__ = "permission"
    
    code: str = Field(nullable=False, unique=True, index=True)
    name: str = Field(nullable=False)
    module: str = Field(nullable=False)  # iam, todo, contract, project, finance
    description: Optional[str] = None
    
    # Relationships
    role_permissions: List["RolePermission"] = Relationship(back_populates="permission")


class Role(BaseDBModel, table=True):
    """Role model"""
    __tablename__ = "role"
    
    code: str = Field(nullable=False, unique=True, index=True)
    name: str = Field(nullable=False)
    description: Optional[str] = None
    
    # Relationships
    role_permissions: List["RolePermission"] = Relationship(back_populates="role")
    user_roles: List["UserRole"] = Relationship(back_populates="role")


class RolePermission(BaseDBModel, table=True):
    """Role-Permission association"""
    __tablename__ = "role_permission"
    
    role_id: UUID = Field(foreign_key="role.id", nullable=False)
    permission_id: UUID = Field(foreign_key="permission.id", nullable=False)
    
    # Relationships
    role: Role = Relationship(back_populates="role_permissions")
    permission: Permission = Relationship(back_populates="role_permissions")


class UserRole(BaseDBModel, table=True):
    """User-Role association with scope"""
    __tablename__ = "user_role"
    
    user_id: UUID = Field(foreign_key="user.id", nullable=False)
    role_id: UUID = Field(foreign_key="role.id", nullable=False)
    scope_type: ScopeType = Field(nullable=False)
    our_entity_id: Optional[UUID] = Field(default=None, foreign_key="our_entity.id")
    
    # Relationships
    user: User = Relationship(back_populates="user_roles")
    role: Role = Relationship(back_populates="user_roles")


class OrgUnit(BaseDBModel, table=True):
    """Organization unit model"""
    __tablename__ = "org_unit"
    
    name: str = Field(nullable=False)
    parent_org_unit_id: Optional[UUID] = Field(default=None, foreign_key="org_unit.id")


class OrgMembership(BaseDBModel, table=True):
    """Organization membership"""
    __tablename__ = "org_membership"
    
    user_id: UUID = Field(foreign_key="user.id", nullable=False)
    org_unit_id: UUID = Field(foreign_key="org_unit.id", nullable=False)
    title: Optional[str] = None
    is_manager: bool = Field(default=False, nullable=False)
