"""
Main FastAPI application
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import create_db_and_tables
from app.core.exceptions import AtlasException
from app.core.response import error_response
from app.api import auth, iam, todo, contract, project, finance

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
    print(f"📥 Incoming request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        print(f"📤 Response status: {response.status_code}")
        return response
    except Exception as e:
        print(f"❌ Request failed: {type(e).__name__}: {str(e)}")
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
    return JSONResponse(
        status_code=500,
        content=error_response(500, "Internal server error")
    )


# Startup event
@app.on_event("startup")
def on_startup():
    """Initialize database on startup"""
    create_db_and_tables()


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
