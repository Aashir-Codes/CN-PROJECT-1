"""Pytest fixtures for validating the Clinic API against docs/api-contract.md."""

import base64
from collections.abc import Callable, Generator
import os

# Set deterministic test-only settings BEFORE importing app modules.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://clinic_app:test_only@127.0.0.1:5432/clinic_db",
)
os.environ.setdefault("LAB_IP", "192.168.67.20")
os.environ.setdefault(
    "JWT_SECRET",
    "test-only-jwt-secret-key-at-least-32-bytes-long-0123456789",
)
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRY_SECONDS", "1800")
os.environ.setdefault("COOKIE_NAME", "access_token")
os.environ.setdefault("COOKIE_SECURE", "true")
os.environ.setdefault("COOKIE_SAMESITE", "lax")
os.environ.setdefault(
    "ENCRYPTION_KEY",
    base64.b64encode(b"0123456789abcdef0123456789abcdef").decode("ascii"),
)
os.environ.setdefault("ADMIN_FULL_NAME", "Clinic Staff Admin")
os.environ.setdefault("ADMIN_EMAIL", "admin@clinic.example.com")
os.environ.setdefault("ADMIN_PASSWORD", "AdminPass#2026")

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as _models  # noqa: F401
from app.config import get_settings
from app.database import Base, get_db
from app.main import app as fastapi_app


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a clean isolated database session per test.

    If TEST_DATABASE_URL is set (e.g. against PostgreSQL 16 on VM2/Docker),
    tests run directly against that database; otherwise an isolated in-memory
    SQLAlchemy database is used for local contract validation.
    """
    get_settings.cache_clear()
    test_db_url = os.environ.get("TEST_DATABASE_URL")
    if test_db_url:
        engine = create_engine(test_db_url, pool_pre_ping=True, future=True)
    else:
        engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )

        @event.listens_for(engine, "connect")
        def _enable_sqlite_fks(dbapi_conn, _connection_record) -> None:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def make_client(
    db_session: Session,
) -> Generator[Callable[[], TestClient], None, None]:
    """Factory producing HTTPS TestClients backed by the test db_session."""

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    clients: list[TestClient] = []

    def _factory() -> TestClient:
        # Use https:// base_url so httpx sends Secure cookies in follow-up requests.
        c = TestClient(fastapi_app, base_url="https://testserver")
        clients.append(c)
        return c

    try:
        yield _factory
    finally:
        for c in clients:
            c.close()
        fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client(make_client: Callable[[], TestClient]) -> TestClient:
    """Default HTTPS TestClient with an isolated cookie jar."""
    return make_client()
