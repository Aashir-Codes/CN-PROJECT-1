"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for database, cryptography, JWT cookies, and admin seeding."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    lab_ip: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiry_seconds: int = 1800
    cookie_name: str = "access_token"
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    encryption_key: str
    admin_full_name: str = "Clinic Administrator"
    admin_email: str = ""
    admin_password: str = ""


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
