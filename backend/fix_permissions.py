#!/usr/bin/env python3
"""
One-time script to normalize permission codes in the database.

Merges granular permission codes (e.g. iam.user.read, finance.account.read)
into module-level codes (e.g. iam.read, finance.read) to match the codes
used in require_permission() decorators.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, select, text
from app.core.database import engine
from app.models.iam import Permission, JobTitlePermission

# Old granular codes -> new simple code
MERGE_MAP = {
    # IAM
    "iam.user.read": "iam.read",
    "iam.role.read": "iam.read",
    "iam.user.write": "iam.write",
    "iam.role.write": "iam.write",
    # Finance
    "finance.account.read": "finance.read",
    "finance.transaction.read": "finance.read",
    "finance.invoice.read": "finance.read",
    "finance.account.write": "finance.write",
    "finance.transaction.write": "finance.write",
    "finance.invoice.write": "finance.write",
}

# The canonical permission set after migration
CANONICAL_PERMISSIONS = [
    {"code": "iam.read", "name": "查看用户管理", "module": "iam"},
    {"code": "iam.write", "name": "编辑用户管理", "module": "iam"},
    {"code": "todo.read", "name": "查看待办事项", "module": "todo"},
    {"code": "todo.write", "name": "编辑待办事项", "module": "todo"},
    {"code": "contract.read", "name": "查看合同管理", "module": "contract"},
    {"code": "contract.write", "name": "编辑合同管理", "module": "contract"},
    {"code": "project.read", "name": "查看项目管理", "module": "project"},
    {"code": "project.write", "name": "编辑项目管理", "module": "project"},
    {"code": "finance.read", "name": "查看财务管理", "module": "finance"},
    {"code": "finance.write", "name": "编辑财务管理", "module": "finance"},
]


def fix_permissions():
    print("=" * 60)
    print("Normalizing permission codes")
    print("=" * 60)

    with Session(engine) as session:
        # 1. Ensure all canonical permissions exist
        for pdata in CANONICAL_PERMISSIONS:
            existing = session.exec(
                select(Permission).where(Permission.code == pdata["code"])
            ).first()
            if not existing:
                p = Permission(**pdata)
                session.add(p)
                print(f"✓ Created permission: {pdata['code']}")
            else:
                # Update name in case it changed
                existing.name = pdata["name"]
                session.add(existing)
        session.commit()

        # 2. Migrate job_title_permission references from old -> new
        for old_code, new_code in MERGE_MAP.items():
            old_perm = session.exec(
                select(Permission).where(Permission.code == old_code)
            ).first()
            if not old_perm:
                continue

            new_perm = session.exec(
                select(Permission).where(Permission.code == new_code)
            ).first()

            # Find all job_title_permissions pointing to the old permission
            jt_perms = session.exec(
                select(JobTitlePermission).where(
                    JobTitlePermission.permission_id == old_perm.id
                )
            ).all()

            for jtp in jt_perms:
                # Check if the new permission is already assigned to this job title
                existing = session.exec(
                    select(JobTitlePermission).where(
                        JobTitlePermission.job_title_id == jtp.job_title_id,
                        JobTitlePermission.permission_id == new_perm.id,
                    )
                ).first()
                if not existing:
                    jtp.permission_id = new_perm.id
                    session.add(jtp)
                    print(f"  Migrated job_title_permission: {old_code} -> {new_code}")
                else:
                    # Duplicate, just delete the old reference
                    session.delete(jtp)
            session.commit()

        # 3. Also migrate role_permission references
        from app.models.iam import RolePermission
        for old_code, new_code in MERGE_MAP.items():
            old_perm = session.exec(
                select(Permission).where(Permission.code == old_code)
            ).first()
            if not old_perm:
                continue

            new_perm = session.exec(
                select(Permission).where(Permission.code == new_code)
            ).first()

            rp_list = session.exec(
                select(RolePermission).where(
                    RolePermission.permission_id == old_perm.id
                )
            ).all()

            for rp in rp_list:
                existing = session.exec(
                    select(RolePermission).where(
                        RolePermission.role_id == rp.role_id,
                        RolePermission.permission_id == new_perm.id,
                    )
                ).first()
                if not existing:
                    rp.permission_id = new_perm.id
                    session.add(rp)
                else:
                    session.delete(rp)
            session.commit()

        # 4. Delete old granular permissions that are no longer needed
        for old_code in MERGE_MAP:
            old_perm = session.exec(
                select(Permission).where(Permission.code == old_code)
            ).first()
            if old_perm:
                session.delete(old_perm)
                print(f"✓ Removed old permission: {old_code}")
        session.commit()

        # 5. Verify final state
        all_perms = session.exec(select(Permission).order_by(Permission.code)).all()
        print(f"\nFinal permission list ({len(all_perms)} entries):")
        for p in all_perms:
            print(f"  {p.code:25s} {p.name}")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        fix_permissions()
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
