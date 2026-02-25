"""
Database connection and session management
"""
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
