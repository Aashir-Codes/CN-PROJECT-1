"""SQLAlchemy 2.x database engine, session factory, and schema initialization."""

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Declarative base class for all ORM models."""


@lru_cache
def get_engine() -> Engine:
    """Create and cache the SQLAlchemy engine from configured DATABASE_URL."""
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        future=True,
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    """Create and cache the SQLAlchemy session factory."""
    return sessionmaker(
        bind=get_engine(),
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def get_db() -> Generator[Session, None, None]:
    """Yield a per-request database session and ensure it always closes."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables if they do not already exist."""
    import app.models  # noqa: F401  Ensure ORM models are registered on Base.metadata

    Base.metadata.create_all(bind=get_engine())
