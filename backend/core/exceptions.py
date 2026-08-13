from fastapi import Request, status
from fastapi.responses import JSONResponse
from .logging import logger

class APIError(Exception):
    def __init__(self, message: str, status_code: int = 400, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}

async def api_error_handler(request: Request, exc: APIError):
    logger.error(
        f"API Error: {exc.message}",
        extra={"endpoint": request.url.path, "status_code": exc.status_code, "details": exc.details}
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "details": exc.details}
    )

async def global_exception_handler(request: Request, exc: Exception):
    # Catch-all for unhandled exceptions (No silent fallbacks, no raw 500 without clear message)
    logger.error(
        f"Unhandled Exception: {str(exc)}",
        exc_info=True,
        extra={"endpoint": request.url.path}
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "An unexpected internal server error occurred.", "details": str(exc)}
    )
