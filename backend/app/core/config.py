"""
Application configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional
from urllib.parse import quote_plus


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Atlas Enterprise Management System"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    
    # Database
    DB_TYPE: str = "sqlite"  # sqlite or mysql
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "punkrecord"
    DB_USER: str = "admin"
    DB_PASSWORD: str = ""
    SQLITE_DB_PATH: str = "./atlas.db"  # SQLite database file path
    
    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "lax"

    # Runtime controls
    AUTO_CREATE_TABLES_ON_STARTUP: bool = False
    AUTO_RUN_MIGRATIONS_ON_STARTUP: bool = False
    ENFORCE_RBAC: bool = False
    
    # AI
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"

    # Knowledge Base
    CHROMADB_PATH: str = "./data/chromadb"
    KB_CHUNK_SIZE: int = 1000
    KB_CHUNK_OVERLAP: int = 200
    KB_RAG_TOP_K: int = 5

    # Volcengine ASR
    VOLC_ASR_APP_KEY: str = "7858270680"
    VOLC_ASR_ACCESS_KEY: str = "jWugJCpq3wc-7-lWclvF69r23YjDVKXP"
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]
    
    # File storage
    STORAGE_BACKEND: str = "local"  # "local" or "tos"
    UPLOAD_DIR: str = "./data/files"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # TOS (Volcengine Object Storage)
    TOS_ACCESS_KEY: Optional[str] = None
    TOS_SECRET_KEY: Optional[str] = None
    TOS_ENDPOINT: Optional[str] = None
    TOS_REGION: Optional[str] = None
    TOS_BUCKET: Optional[str] = None
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    @property
    def DATABASE_URL(self) -> str:
        """Construct database URL from components"""
        if self.DB_TYPE.lower() == "sqlite":
            # SQLite database URL
            return f"sqlite:///{self.SQLITE_DB_PATH}"
        else:
            # MySQL database URL
            # URL-encode the password to handle special characters like @
            encoded_password = quote_plus(self.DB_PASSWORD)
            return f"mysql+pymysql://{self.DB_USER}:{encoded_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
