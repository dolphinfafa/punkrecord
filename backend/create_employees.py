#!/usr/bin/env python3
"""
Create employee accounts for 黄金梅丽号 department
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, select
from app.core.database import engine
from app.core.security import get_password_hash
from app.models.iam import (
    User, UserStatus, JobTitle, OrgUnit, UserRole, Role, ScopeType,
)


def create_employees():
    print("=" * 60)
    print("Creating Employee Accounts")
    print("=" * 60)

    with Session(engine) as session:
        # ---- 1. Find or create department 黄金梅丽号 ----
        dept = session.exec(select(OrgUnit).where(OrgUnit.name == "黄金梅丽号")).first()
        if not dept:
            dept = OrgUnit(name="黄金梅丽号", description="黄金梅丽号部门")
            session.add(dept)
            session.commit()
            session.refresh(dept)
            print(f"✓ Created department: {dept.name}")
        else:
            print(f"✓ Department already exists: {dept.name}")

        # ---- 2. Find or create job titles ----
        title_names = ["产品经理", "前端工程师", "实习生", "测试员"]
        titles = {}
        for name in title_names:
            jt = session.exec(select(JobTitle).where(JobTitle.name == name)).first()
            if not jt:
                jt = JobTitle(name=name)
                session.add(jt)
                session.commit()
                session.refresh(jt)
                print(f"✓ Created job title: {name}")
            else:
                print(f"✓ Job title already exists: {name}")
            titles[name] = jt

        # ---- 3. Find manager 杨喆 ----
        yangzhe = session.exec(select(User).where(User.display_name == "杨喆")).first()
        if not yangzhe:
            print("⚠ Manager '杨喆' not found, will leave manager_user_id as None for employees reporting to 杨喆")
        else:
            print(f"✓ Found manager: {yangzhe.display_name} ({yangzhe.username})")

        # ---- 4. Find employee role ----
        employee_role = session.exec(select(Role).where(Role.code == "employee")).first()

        # ---- 5. Define employees ----
        employees_data = [
            {
                "display_name": "殷萄",
                "username": "yintao",
                "password": "yintao123",
                "email": "yintao@punkrecord.com",
                "phone": "13800000001",
                "job_title": "产品经理",
                "manager": yangzhe,
                "birthday": "1995-06-15",
                "education_level": "bachelor",
                "graduation_school": "浙江大学",
            },
            {
                "display_name": "小泽",
                "username": "xiaoze",
                "password": "xiaoze123",
                "email": "xiaoze@punkrecord.com",
                "phone": "13800000002",
                "job_title": "前端工程师",
                "manager": yangzhe,
                "birthday": "1997-03-22",
                "education_level": "bachelor",
                "graduation_school": "华南理工大学",
            },
            {
                "display_name": "李辰欣",
                "username": "lichenxin",
                "password": "lichenxin123",
                "email": "lichenxin@punkrecord.com",
                "phone": "13800000003",
                "job_title": "实习生",
                "manager": None,  # 殷萄 - will be set after creation
                "birthday": "2002-11-08",
                "education_level": "bachelor",
                "graduation_school": "中山大学",
            },
            {
                "display_name": "小雪",
                "username": "xiaoxue",
                "password": "xiaoxue123",
                "email": "xiaoxue@punkrecord.com",
                "phone": "13800000004",
                "job_title": "测试员",
                "manager": None,  # 殷萄 - will be set after creation
                "birthday": "1999-01-20",
                "education_level": "associate",
                "graduation_school": "深圳职业技术大学",
            },
        ]

        created_users = {}

        for emp in employees_data:
            # Check if already exists
            existing = session.exec(select(User).where(User.username == emp["username"])).first()
            if existing:
                print(f"⚠ User '{emp['username']}' already exists, skipping")
                created_users[emp["display_name"]] = existing
                continue

            user = User(
                display_name=emp["display_name"],
                username=emp["username"],
                email=emp["email"],
                phone=emp["phone"],
                hashed_password=get_password_hash(emp["password"][:72]),
                status=UserStatus.ACTIVE,
                is_shareholder=False,
                profile_completed=True,
                must_change_password=False,
                birthday=emp["birthday"],
                education_level=emp.get("education_level"),
                graduation_school=emp.get("graduation_school"),
                manager_user_id=emp["manager"].id if emp["manager"] else None,
                job_title_id=titles[emp["job_title"]].id,
                department_id=dept.id,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            created_users[emp["display_name"]] = user
            print(f"✓ Created user: {emp['display_name']} ({emp['username']})")

            # Assign employee role
            if employee_role:
                ur = UserRole(
                    user_id=user.id,
                    role_id=employee_role.id,
                    scope_type=ScopeType.GLOBAL,
                )
                session.add(ur)
                session.commit()

        # ---- 6. Set 殷萄 as manager for 李辰欣 and 小雪 ----
        yintao_user = created_users.get("殷萄")
        if yintao_user:
            for name in ["李辰欣", "小雪"]:
                u = created_users.get(name)
                if u and not u.manager_user_id:
                    u.manager_user_id = yintao_user.id
                    session.add(u)
            session.commit()
            print(f"✓ Set 殷萄 as manager for 李辰欣 and 小雪")

        print("\n" + "=" * 60)
        print("Employee Accounts Created Successfully!")
        print("=" * 60)
        print("\nLogin Credentials:")
        print(f"  殷萄     | yintao     | yintao123     | 产品经理   | 上级: 杨喆")
        print(f"  小泽     | xiaoze     | xiaoze123     | 前端工程师 | 上级: 杨喆")
        print(f"  李辰欣   | lichenxin  | lichenxin123  | 实习生     | 上级: 殷萄")
        print(f"  小雪     | xiaoxue    | xiaoxue123    | 测试员     | 上级: 殷萄")
        print(f"\n  部门: 黄金梅丽号")
        print(f"  首次登录无需填表 (profile_completed=True)")
        print("=" * 60)


if __name__ == "__main__":
    try:
        create_employees()
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
