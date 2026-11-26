"""Idempotent CLI script to seed the clinic staff 'admin' account from .env."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_session_factory, init_db
from app.models import User
from app.security import hash_password


def seed_admin(session: Session | None = None) -> tuple[User, bool]:
    """Ensure the configured admin user exists in the database.

    Returns a tuple of `(user, created)` where `created` is True when a new
    admin record was inserted and False when the account already existed.
    """
    settings = get_settings()
    admin_email = settings.admin_email.strip().lower()
    admin_password = settings.admin_password
    admin_full_name = settings.admin_full_name.strip() or "Clinic Administrator"

    if not admin_email or "@" not in admin_email:
        raise ValueError("ADMIN_EMAIL must be set to a valid email address in .env.")
    if not (8 <= len(admin_password) <= 128):
        raise ValueError("ADMIN_PASSWORD must be between 8 and 128 characters in .env.")

    owns_session = session is None
    db = session if session is not None else get_session_factory()()
    try:
        existing = db.scalar(select(User).where(User.email == admin_email))
        if existing is not None:
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
                db.refresh(existing)
            return existing, False

        admin_user = User(
            full_name=admin_full_name,
            email=admin_email,
            password_hash=hash_password(admin_password),
            role="admin",
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        return admin_user, True
    finally:
        if owns_session:
            db.close()


def main() -> None:
    """Initialize database tables and seed the clinic admin account."""
    init_db()
    admin_user, created = seed_admin()
    if created:
        print(f"Seeded clinic admin account: {admin_user.email} (id={admin_user.id})")
    else:
        print(f"Clinic admin account already exists: {admin_user.email} (id={admin_user.id})")


if __name__ == "__main__":
    main()
