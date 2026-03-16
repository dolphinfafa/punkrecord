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
        # Permission codes must match those used in require_permission() decorators
        permissions_data = [
            # IAM
            {"code": "iam.read", "name": "查看用户管理", "module": "iam"},
            {"code": "iam.write", "name": "编辑用户管理", "module": "iam"},

            # Todo
            {"code": "todo.read", "name": "查看待办事项", "module": "todo"},
            {"code": "todo.write", "name": "编辑待办事项", "module": "todo"},

            # Contract
            {"code": "contract.read", "name": "查看合同管理", "module": "contract"},
            {"code": "contract.write", "name": "编辑合同管理", "module": "contract"},

            # Project
            {"code": "project.read", "name": "查看项目管理", "module": "project"},
            {"code": "project.write", "name": "编辑项目管理", "module": "project"},

            # Finance
            {"code": "finance.read", "name": "查看财务管理", "module": "finance"},
            {"code": "finance.write", "name": "编辑财务管理", "module": "finance"},

            # Knowledge Base
            {"code": "kb.read", "name": "查看企业大脑", "module": "kb"},
            {"code": "kb.write", "name": "编辑企业大脑", "module": "kb"},

            # Meeting
            {"code": "meeting.read", "name": "查看会议记录", "module": "meeting"},
            {"code": "meeting.write", "name": "编辑会议记录", "module": "meeting"},
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
