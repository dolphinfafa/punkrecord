"""
Main FastAPI application
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import create_db_and_tables
from app.core.exceptions import AtlasException
from app.core.response import error_response
from app.api import auth, iam, todo, contract, project, finance, ai, kb, meeting, changelog, wechat_notify
from app.api.mcp_server import mcp as mcp_server

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifespan: init DB and run the MCP streamable-http session manager."""
    if settings.AUTO_CREATE_TABLES_ON_STARTUP or settings.AUTO_RUN_MIGRATIONS_ON_STARTUP:
        create_db_and_tables(
            run_schema_create=settings.AUTO_CREATE_TABLES_ON_STARTUP,
            run_alembic_migrations=settings.AUTO_RUN_MIGRATIONS_ON_STARTUP,
        )
    async with mcp_server.session_manager.run():
        yield


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Mount the MCP server (Streamable HTTP) at /api/v1/mcp (reuses nginx /api/ proxy).
app.mount("/api/v1/mcp", mcp_server.streamable_http_app())

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(iam.router, prefix="/api/v1")
app.include_router(todo.router, prefix="/api/v1")
app.include_router(contract.router, prefix="/api/v1")
app.include_router(project.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(kb.router, prefix="/api/v1")
app.include_router(meeting.router, prefix="/api/v1")
app.include_router(changelog.router, prefix="/api/v1")
app.include_router(wechat_notify.router, prefix="/api/v1")

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


# MCP service info (for the frontend MCP page)
@app.get("/api/v1/mcp-info")
async def mcp_info():
    """Public MCP endpoint URL + available tool list (for the MCP page)."""
    from app.core.response import success_response
    tools = await mcp_server.list_tools()
    return success_response({
        "url": settings.MCP_PUBLIC_URL,
        "tools": [
            {"name": t.name, "description": (t.description or "").strip().split("\n")[0]}
            for t in tools
        ],
    })


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
