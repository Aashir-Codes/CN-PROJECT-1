"""FastAPI authentication and role-based access control dependencies."""

from fastapi import Depends, Request
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.errors import APIError
from app.models import User
from app.security import decode_access_token


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Authenticate request strictly via HttpOnly access_token cookie."""
    cookie_name = get_settings().cookie_name
    token = request.cookies.get(cookie_name)
    if not token:
        raise APIError(401, "UNAUTHORIZED", "Authentication required.")

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise APIError(401, "UNAUTHORIZED", "Invalid or expired authentication token.")

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise APIError(401, "UNAUTHORIZED", "User account no longer exists.")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require authenticated user to hold the clinic staff 'admin' role."""
    if current_user.role != "admin":
        raise APIError(403, "FORBIDDEN", "Administrator privileges required.")
    return current_user
