"""FastAPI application entrypoint, router registration, and unified error handling."""

from contextlib import asynccontextmanager
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.database import init_db
from app.errors import APIError
from app.routers import admin, appointments, auth, health

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize schema on startup without blocking health endpoint if DB is down."""
    try:
        init_db()
    except SQLAlchemyError as exc:
        logger.warning("Database initialization skipped at startup: %s", exc)
    yield


app = FastAPI(
    title="Clinic Patient Appointment & Intake Portal API",
    version="1.0.0",
    lifespan=lifespan,
)


def _error_body(
    code: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the unified JSON error envelope."""
    payload: dict[str, Any] = {
        "status": "error",
        "error": {
            "code": code,
            "message": message,
        },
    }
    if data is not None:
        payload["data"] = data
    return payload


@app.exception_handler(APIError)
async def api_error_handler(_request: Request, exc: APIError) -> JSONResponse:
    """Render application-level APIError instances into the unified JSON envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.code, exc.message, exc.data),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Convert Pydantic/FastAPI 422 validation errors into HTTP 400 VALIDATION_ERROR."""
    messages: list[str] = []
    for err in exc.errors():
        loc_parts = [str(part) for part in err.get("loc", ()) if part != "body"]
        field_name = ".".join(loc_parts) if loc_parts else "request"
        detail = err.get("msg", "Invalid value")
        messages.append(f"{field_name}: {detail}")
    summary = "; ".join(messages) if messages else "Invalid request payload."
    return JSONResponse(
        status_code=400,
        content=_error_body("VALIDATION_ERROR", summary),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    _request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Normalize FastAPI/Starlette HTTP exceptions into the unified JSON envelope."""
    code_map = {
        400: "VALIDATION_ERROR",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
    }
    code = code_map.get(exc.status_code, "INTERNAL_ERROR")
    message = str(exc.detail) if exc.detail else "Request error."
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(code, message),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    """Catch unexpected errors without leaking internal details to clients."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content=_error_body(
            "INTERNAL_ERROR",
            "An unexpected internal error occurred.",
        ),
    )


app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
