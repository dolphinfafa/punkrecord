"""
Unified response format
"""
from typing import Any, Optional, TypeVar, Generic
from pydantic import BaseModel

T = TypeVar('T')


class ResponseModel(BaseModel, Generic[T]):
    """Unified API response model"""
    code: int = 0
    message: str = "success"
    data: Optional[T] = None


class ErrorResponse(BaseModel):
    """Error response model"""
    code: int
    message: str
    errors: Optional[list] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response model"""
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


def success_response(data: Any = None, message: str = "success") -> dict:
    """Create success response"""
    return {
        "code": 0,
        "message": message,
        "data": data
    }


def error_response(code: int, message: str, errors: list = None) -> dict:
    """Create error response"""
    return {
        "code": code,
        "message": message,
        "errors": errors
    }
