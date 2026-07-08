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
    APP_VERSION: str = "2.0.4"
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

    # LiteLLM (meeting summary LLM)
    LITELLM_BASE_URL: str = "https://litellm.yios.cn/v1"
    LITELLM_API_KEY: str = "sk-pd8ihad3IQRHfn0TILW7Pg"
    LITELLM_MODEL: str = "gemini/gemini-3.1-flash-lite-preview"

    # Knowledge Base
    CHROMADB_PATH: str = "./data/chromadb"
    KB_CHUNK_SIZE: int = 1000
    KB_CHUNK_OVERLAP: int = 200
    KB_RAG_TOP_K: int = 5

    # Volcengine ASR
    VOLC_ASR_APP_KEY: str = "7858270680"
    VOLC_ASR_ACCESS_KEY: str = "jWugJCpq3wc-7-lWclvF69r23YjDVKXP"

    # Public base URL for ASR audio callback (Volcengine needs to fetch audio via URL)
    PUBLIC_BASE_URL: str = "https://dev-cn-01.yios.cn/punkrecord"
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:15173", "http://localhost:15030"]
    
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
    
    # WeChat Message Service (weixin-agent-sdk)
    WECHAT_MSG_SERVICE_URL: Optional[str] = None
    WECHAT_MSG_SERVICE_API_KEY: Optional[str] = None

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # MCP service
    # Internal REST base the MCP tools call in-process (forward caller's pat_ token).
    # dev: 15085 ; prod override to http://127.0.0.1:9086/api/v1
    INTERNAL_API_BASE_URL: str = "http://127.0.0.1:15085/api/v1"
    # Public MCP endpoint shown to users on the MCP page / docs.
    # Leave empty to auto-derive from the request (X-Forwarded-* / Host);
    # set explicitly per environment for reliability (recommended in prod).
    MCP_PUBLIC_URL: str = ""
    
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
