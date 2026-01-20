"""
Models package initialization
Import all models here for easy access
"""
from app.models.base import BaseDBModel, UUIDModel, TimestampModel
from app.models.iam import (
    User, Role, Permission, RolePermission, UserRole,
    OurEntity, OrgUnit, OrgMembership,
    UserStatus, OurEntityType, OurEntityStatus, ScopeType
)
from app.models.approval import (
    ApprovalFlow, ApprovalInstance, ApprovalStep,
    ApprovalObjectType, ApprovalStatus, ApprovalStepStatus
)
from app.models.todo import (
    TodoItem, NotificationLog,
    TodoSourceType, TodoActionType, TodoPriority, TodoStatus,
    NotificationChannel, NotificationStatus
)
from app.models.contract import (
    Counterparty, Contract, ContractPaymentPlan,
    ContractType, ContractStatus, CounterpartyType,
    PaymentDirection, PaymentPlanStatus
)
from app.models.project import (
    Project, ProjectStage, ProjectMember,
    ProjectType, ProjectStatus, StageStatus
)
from app.models.finance import (
    FinanceAccount, FinanceTransaction, FinanceInvoice,
    InvoiceRequest, Reimbursement,
    AccountCategory, AccountStatus, TransactionDirection,
    ReconcileStatus, InvoiceKind, InvoiceMedium, OCRStatus,
    InvoiceRequestStatus, ReimbursementStatus
)
from app.models.shared import (
    AuditLog, FileMetadata, WeChatUserBinding, WeChatMessageTemplate,
    SubscribeStatus
)

__all__ = [
    # Base
    "BaseDBModel", "UUIDModel", "TimestampModel",
    
    # IAM
    "User", "Role", "Permission", "RolePermission", "UserRole",
    "OurEntity", "OrgUnit", "OrgMembership",
    "UserStatus", "OurEntityType", "OurEntityStatus", "ScopeType",
    
    # Approval
    "ApprovalFlow", "ApprovalInstance", "ApprovalStep",
    "ApprovalObjectType", "ApprovalStatus", "ApprovalStepStatus",
    
    # Todo
    "TodoItem", "NotificationLog",
    "TodoSourceType", "TodoActionType", "TodoPriority", "TodoStatus",
    "NotificationChannel", "NotificationStatus",
    
    # Contract
    "Counterparty", "Contract", "ContractPaymentPlan",
    "ContractType", "ContractStatus", "CounterpartyType",
    "PaymentDirection", "PaymentPlanStatus",
    
    # Project
    "Project", "ProjectStage", "ProjectMember",
    "ProjectType", "ProjectStatus", "StageStatus",
    
    # Finance
    "FinanceAccount", "FinanceTransaction", "FinanceInvoice",
    "InvoiceRequest", "Reimbursement",
    "AccountCategory", "AccountStatus", "TransactionDirection",
    "ReconcileStatus", "InvoiceKind", "InvoiceMedium", "OCRStatus",
    "InvoiceRequestStatus", "ReimbursementStatus",
    
    # Shared
    "AuditLog", "FileMetadata", "WeChatUserBinding", "WeChatMessageTemplate",
    "SubscribeStatus"
]
