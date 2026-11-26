"""Authentication and session management endpoints (/api/v1/auth/*)."""

from typing import Any

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.errors import APIError
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    UserPublic,
    UserRegistered,
    format_utc_iso,
    success_response,
)
from app.security import (
    clear_auth_cookie,
    create_access_token,
    hash_password,
    password_needs_rehash,
    set_auth_cookie,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Register a new patient account with role fixed to 'user'."""
    email = str(payload.email)
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise APIError(
            status_code=400,
            code="EMAIL_ALREADY_EXISTS",
            message="An account with this email address already exists.",
        )

    user = User(
        full_name=payload.full_name,
        email=email,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            status_code=400,
            code="EMAIL_ALREADY_EXISTS",
            message="An account with this email address already exists.",
        ) from exc

    db.refresh(user)
    return success_response(
        UserRegistered(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            created_at=format_utc_iso(user.created_at),
        ).model_dump()
    )


@router.post("/login")
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Verify user credentials and issue an HttpOnly JWT cookie."""
    email = str(payload.email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(user.password_hash, payload.password):
        raise APIError(
            status_code=401,
            code="INVALID_CREDENTIALS",
            message="Invalid email or password.",
        )

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()
        db.refresh(user)

    token = create_access_token(user_id=user.id, role=user.role)
    set_auth_cookie(response, token)

    return success_response(
        UserPublic(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
        ).model_dump()
    )


@router.post("/logout")
def logout(
    response: Response,
    _current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Clear the authenticated user's HttpOnly access_token cookie."""
    clear_auth_cookie(response)
    return success_response({"message": "Logged out successfully."})


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the currently authenticated user's profile and role."""
    return success_response(
        UserPublic(
            id=current_user.id,
            full_name=current_user.full_name,
            email=current_user.email,
            role=current_user.role,
        ).model_dump()
    )


@router.patch("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Verify current password and persist a new Argon2id password hash."""
    if not verify_password(current_user.password_hash, payload.current_password):
        raise APIError(
            status_code=401,
            code="INVALID_CREDENTIALS",
            message="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return success_response({"message": "Password updated successfully."})
