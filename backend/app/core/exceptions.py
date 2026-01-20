"""
Custom exceptions
"""


class AtlasException(Exception):
    """Base exception for Atlas application"""
    def __init__(self, message: str, code: int = 400):
        self.message = message
        self.code = code
        super().__init__(self.message)


class NotFoundException(AtlasException):
    """Resource not found exception"""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, code=404)


class UnauthorizedException(AtlasException):
    """Unauthorized exception"""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, code=401)


class ForbiddenException(AtlasException):
    """Forbidden exception"""
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, code=403)


class ValidationException(AtlasException):
    """Validation exception"""
    def __init__(self, message: str = "Validation error", errors: list = None):
        super().__init__(message, code=400)
        self.errors = errors or []
