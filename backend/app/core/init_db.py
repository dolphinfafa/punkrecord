"""
Database initialization and seed data
"""
from sqlmodel import Session, select
from app.core.database import engine, create_db_and_tables
from app.core.security import get_password_hash
from app.models import *


def init_database():
    """Initialize database with tables and seed data"""
    print("Creating database tables...")
    create_db_and_tables()
    print("Database tables created successfully!")
    
    with Session(engine) as session:
        # Check if admin user already exists
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if admin:
            print("Seed data already exists, skipping...")
            return
        
        print("Inserting seed data...")
        
        # Create default our_entity
        our_entity = OurEntity(
            name="Default Company",
            type=OurEntityType.COMPANY,
            legal_name="Default Company Ltd.",
            default_currency="CNY",
            status=OurEntityStatus.ACTIVE
        )
        session.add(our_entity)
        session.commit()
        session.refresh(our_entity)
        print(f"Created default entity: {our_entity.name}")
        
        # Create admin user
        admin_user = User(
            display_name="Administrator",
            username="admin",
            email="admin@atlas.com",
            hashed_password=get_password_hash("admin123"[:72]),  # bcrypt max length
            status=UserStatus.ACTIVE,
            is_shareholder=True
        )
        session.add(admin_user)
        session.commit()
        session.refresh(admin_user)
        print(f"Created admin user: {admin_user.username}")
        
        # Create default roles
        roles_data = [
            {"code": "admin", "name": "Administrator", "description": "System administrator"},
            {"code": "finance", "name": "Finance", "description": "Finance personnel"},
            {"code": "cashier", "name": "Cashier", "description": "Cashier"},
            {"code": "shareholder", "name": "Shareholder", "description": "Company shareholder"},
            {"code": "pm", "name": "Project Manager", "description": "Project manager"},
            {"code": "owner", "name": "Business Owner", "description": "Business owner/sales"},
            {"code": "employee", "name": "Employee", "description": "Regular employee"},
            {"code": "approver", "name": "Approver", "description": "Approver"},
            {"code": "legal", "name": "Legal", "description": "Legal personnel"},
            {"code": "seal_admin", "name": "Seal Administrator", "description": "Seal administrator"},
        ]
        
        for role_data in roles_data:
            role = Role(**role_data)
            session.add(role)
        session.commit()
        print(f"Created {len(roles_data)} default roles")
        
        # Create default permissions
        permissions_data = [
            # IAM
            {"code": "iam.user.read", "name": "Read Users", "module": "iam"},
            {"code": "iam.user.write", "name": "Write Users", "module": "iam"},
            {"code": "iam.role.read", "name": "Read Roles", "module": "iam"},
            {"code": "iam.role.write", "name": "Write Roles", "module": "iam"},
            
            # Todo
            {"code": "todo.read", "name": "Read Todos", "module": "todo"},
            {"code": "todo.write", "name": "Write Todos", "module": "todo"},
            
            # Contract
            {"code": "contract.read", "name": "Read Contracts", "module": "contract"},
            {"code": "contract.write", "name": "Write Contracts", "module": "contract"},
            
            # Project
            {"code": "project.read", "name": "Read Projects", "module": "project"},
            {"code": "project.write", "name": "Write Projects", "module": "project"},
            
            # Finance
            {"code": "finance.account.read", "name": "Read Accounts", "module": "finance"},
            {"code": "finance.account.write", "name": "Write Accounts", "module": "finance"},
            {"code": "finance.transaction.read", "name": "Read Transactions", "module": "finance"},
            {"code": "finance.transaction.write", "name": "Write Transactions", "module": "finance"},
            {"code": "finance.invoice.read", "name": "Read Invoices", "module": "finance"},
            {"code": "finance.invoice.write", "name": "Write Invoices", "module": "finance"},
        ]
        
        for perm_data in permissions_data:
            permission = Permission(**perm_data)
            session.add(permission)
        session.commit()
        print(f"Created {len(permissions_data)} default permissions")
        
        # Assign admin role to admin user
        admin_role = session.exec(select(Role).where(Role.code == "admin")).first()
        if admin_role:
            user_role = UserRole(
                user_id=admin_user.id,
                role_id=admin_role.id,
                scope_type=ScopeType.GLOBAL
            )
            session.add(user_role)
            session.commit()
            print("Assigned admin role to admin user")
        
        # Create a default approval flow for contract
        contract_flow = ApprovalFlow(
            flow_code="contract_v1",
            name="Contract Approval Flow V1",
            object_type=ApprovalObjectType.CONTRACT,
            steps=[
                {"step_no": 1, "step_name": "Legal Review", "approver_resolver": "fixed"},
                {"step_no": 2, "step_name": "Finance Review", "approver_resolver": "finance"},
                {"step_no": 3, "step_name": "Seal Approval", "approver_resolver": "seal_admin"},
            ],
            is_active=True
        )
        session.add(contract_flow)
        session.commit()
        print("Created default contract approval flow")
        
        print("Seed data inserted successfully!")


if __name__ == "__main__":
    init_database()
