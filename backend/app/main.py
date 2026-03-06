"""
Main FastAPI application
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import create_db_and_tables
from app.core.exceptions import AtlasException
from app.core.response import error_response
from app.api import auth, iam, todo, contract, project, finance, ai

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(iam.router, prefix="/api/v1")
app.include_router(todo.router, prefix="/api/v1")
app.include_router(contract.router, prefix="/api/v1")
app.include_router(project.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("Incoming request: %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        logger.info("Response status: %s", response.status_code)
        return response
    except Exception as e:
        logger.exception("Request failed: %s: %s", type(e).__name__, str(e))
        raise


# Exception handlers
@app.exception_handler(AtlasException)
async def atlas_exception_handler(request: Request, exc: AtlasException):
    """Handle Atlas custom exceptions"""
    return JSONResponse(
        status_code=exc.code,
        content=error_response(exc.code, exc.message)
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=error_response(500, "Internal server error")
    )


def _ensure_user_profile_columns():
    """Add new profile columns to user table if they don't exist (SQLite compat)."""
    from sqlalchemy import text, inspect
    from app.core.database import engine
    inspector = inspect(engine)
    existing = {col["name"] for col in inspector.get_columns("user")}
    new_columns = [
        ("birthday", "VARCHAR"),
        ("id_number", "VARCHAR"),
        ("home_address", "VARCHAR"),
        ("graduation_school", "VARCHAR"),
        ("education_level", "VARCHAR"),
        ("id_card_image", "VARCHAR"),
        ("resume_file", "VARCHAR"),
        ("profile_completed", "BOOLEAN DEFAULT 1"),  # existing users default to completed
        ("must_change_password", "BOOLEAN DEFAULT 0"),  # existing users don't need to change
    ]
    with engine.begin() as conn:
        for col_name, col_type in new_columns:
            if col_name not in existing:
                conn.execute(text(f"ALTER TABLE user ADD COLUMN {col_name} {col_type}"))
                logger.info("Added column user.%s", col_name)


# Startup event
@app.on_event("startup")
def on_startup():
    """Initialize database on startup"""
    if settings.AUTO_CREATE_TABLES_ON_STARTUP or settings.AUTO_RUN_MIGRATIONS_ON_STARTUP:
        create_db_and_tables(
            run_schema_create=settings.AUTO_CREATE_TABLES_ON_STARTUP,
            run_alembic_migrations=settings.AUTO_RUN_MIGRATIONS_ON_STARTUP,
        )
    _ensure_user_profile_columns()


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": settings.APP_VERSION}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }
