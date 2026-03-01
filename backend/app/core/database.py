"""
Database connection and session management
"""
from pathlib import Path
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
    run_migrations()


def run_migrations():
    """Apply Alembic migrations to head."""
    try:
        from alembic import command
        from alembic.config import Config
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Alembic is required to run DB migrations. Install dependencies with: pip install -r requirements.txt"
        ) from exc

    backend_dir = Path(__file__).resolve().parents[2]
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "db_migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(alembic_cfg, "head")


def get_session():
    """Get database session"""
    with Session(engine) as session:
        yield session
