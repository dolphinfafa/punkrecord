#!/usr/bin/env python3
"""
Initialize database tables
"""
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import create_db_and_tables
from app.core.config import settings

# Import all models to ensure they are registered with SQLModel
from app.models import (
    # IAM models
    User, Role, Permission, RolePermission, UserRole,
    OurEntity, OrgUnit, OrgMembership,
    # Todo models
    TodoItem, NotificationLog,
    # Contract models
    Counterparty, Contract, ContractPaymentPlan,
    # Project models
    Project, ProjectStage, ProjectMember,
    # Finance models
    FinanceAccount, FinanceTransaction, FinanceInvoice,
    InvoiceRequest, Reimbursement,
    # Approval models
    ApprovalFlow, ApprovalInstance, ApprovalStep,
    # Shared models
    AuditLog, FileMetadata, WeChatUserBinding, WeChatMessageTemplate
)

def init_database():
    """Initialize database tables"""
    print("=" * 60)
    print("Initializing Database Tables")
    print("=" * 60)
    print(f"\nDatabase: {settings.DB_NAME}")
    print(f"Host: {settings.DB_HOST}:{settings.DB_PORT}")
    print(f"\nCreating tables...")
    
    try:
        create_db_and_tables()
        print("\n✓ Database tables created successfully!")
        print("\n" + "=" * 60)
        print("Database initialization COMPLETED ✓")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n✗ Failed to create tables!")
        print(f"  Error: {str(e)}")
        print("\n" + "=" * 60)
        print("Database initialization FAILED ✗")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = init_database()
    sys.exit(0 if success else 1)
