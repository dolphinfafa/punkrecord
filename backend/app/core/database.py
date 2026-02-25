"""
Database connection and session management
"""
from datetime import datetime
from sqlmodel import create_engine, Session, SQLModel
from app.core.config import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=3600,  # Recycle connections after 1 hour
)


def create_db_and_tables():
    """Create database tables"""
    SQLModel.metadata.create_all(engine)
    _ensure_legacy_columns()


def _ensure_legacy_columns():
    """Backfill newly added columns in existing SQLite databases."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as conn:
        user_columns = {
            row[1] for row in conn.exec_driver_sql(
                "PRAGMA table_info('user')"
            ).fetchall()
        }
        user_leave_defaults = {
            "leave_annual_remaining": 5.0,
            "leave_maternity_remaining": 15.0,
            "leave_marriage_remaining": 3.0,
            "leave_personal_remaining": 3.0,
            "leave_sick_remaining": 3.0,
        }
        current_year = datetime.utcnow().year
        if "leave_balance_reset_year" not in user_columns:
            conn.exec_driver_sql(
                f"ALTER TABLE user ADD COLUMN leave_balance_reset_year INTEGER NOT NULL DEFAULT {current_year}"
            )
        conn.exec_driver_sql(
            f"UPDATE user SET leave_balance_reset_year = {current_year} WHERE leave_balance_reset_year IS NULL"
        )
        for col_name, default_val in user_leave_defaults.items():
            if col_name not in user_columns:
                conn.exec_driver_sql(
                    f"ALTER TABLE user ADD COLUMN {col_name} FLOAT NOT NULL DEFAULT {default_val}"
                )
            conn.exec_driver_sql(
                f"UPDATE user SET {col_name} = {default_val} WHERE {col_name} IS NULL"
            )

        project_columns = {
            row[1] for row in conn.exec_driver_sql(
                "PRAGMA table_info('project')"
            ).fetchall()
        }
        if "attachments" not in project_columns:
            conn.exec_driver_sql("ALTER TABLE project ADD COLUMN attachments JSON")
        conn.exec_driver_sql(
            "UPDATE project SET attachments = '[]' WHERE attachments IS NULL"
        )

        stage_columns = {
            row[1] for row in conn.exec_driver_sql(
                "PRAGMA table_info('project_stage')"
            ).fetchall()
        }
        if "attachments" not in stage_columns:
            conn.exec_driver_sql("ALTER TABLE project_stage ADD COLUMN attachments JSON")
        conn.exec_driver_sql(
            "UPDATE project_stage SET attachments = '[]' WHERE attachments IS NULL"
        )


def get_session():
    """Get database session"""
    with Session(engine) as session:
        yield session
