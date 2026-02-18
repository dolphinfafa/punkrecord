"""
Migration script to add org structure columns to existing tables.
Safe to run multiple times - uses IF NOT EXISTS / IGNORE errors.
"""
from app.core.database import engine
from sqlmodel import text

migrations = [
    # Create job_title table if not exists
    """CREATE TABLE IF NOT EXISTS job_title (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        level INT NOT NULL DEFAULT 0,
        description TEXT,
        created_at DATETIME(6) DEFAULT NOW(6),
        updated_at DATETIME(6) DEFAULT NOW(6)
    )""",
    # Add description to org_unit
    "ALTER TABLE org_unit ADD COLUMN description TEXT",
    # Add org fields to user
    "ALTER TABLE user ADD COLUMN manager_user_id CHAR(36)",
    "ALTER TABLE user ADD COLUMN job_title_id CHAR(36)",
    "ALTER TABLE user ADD COLUMN department_id CHAR(36)",
]

with engine.begin() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"OK: {sql[:70]}")
        except Exception as e:
            err = str(e)
            if "Duplicate column" in err or "already exists" in err or "1060" in err:
                print(f"SKIP (already exists): {sql[:70]}")
            else:
                print(f"ERROR: {err[:120]}")

print("\nMigration complete!")
