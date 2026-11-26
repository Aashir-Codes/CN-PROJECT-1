"""Cryptographic helpers for Argon2id passwords, AES-256-GCM notes, and HS256 JWT cookies."""

import base64
from datetime import datetime, timezone
import os
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Response
import jwt

from app.config import get_settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id with a random per-user salt."""
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verify a plaintext password against a stored Argon2id hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    """Return True if an existing hash should be upgraded to current Argon2id params."""
    return _password_hasher.check_needs_rehash(password_hash)


def _get_aes_key() -> bytes:
    """Decode and validate the 32-byte AES-256-GCM key from ENCRYPTION_KEY."""
    raw_key = get_settings().encryption_key.strip()
    # Support both standard (+/) and URL-safe (-_) Base64 encodings cleanly.
    normalized = raw_key.replace("-", "+").replace("_", "/")
    padding = (-len(normalized)) % 4
    if padding:
        normalized += "=" * padding
    key = base64.b64decode(normalized, validate=True)
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256.")
    return key


def encrypt_text(plaintext: str) -> str:
    """Encrypt UTF-8 text with AES-256-GCM using a fresh 12-byte nonce per write."""
    nonce = os.urandom(12)
    aesgcm = AESGCM(_get_aes_key())
    ct_and_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct_and_tag).decode("ascii")


def decrypt_text(ciphertext_b64: str) -> str:
    """Decrypt Base64(nonce[12] || ciphertext || tag[16]) back to UTF-8 text."""
    raw = base64.b64decode(ciphertext_b64, validate=True)
    if len(raw) < 28:
        raise ValueError("Encrypted payload is shorter than minimum AES-GCM frame.")
    nonce = raw[:12]
    ct_and_tag = raw[12:]
    aesgcm = AESGCM(_get_aes_key())
    plaintext_bytes = aesgcm.decrypt(nonce, ct_and_tag, None)
    return plaintext_bytes.decode("utf-8")


def create_access_token(user_id: int, role: str) -> str:
    """Sign an HS256 JWT containing sub, role, iat, and exp claims."""
    settings = get_settings()
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + settings.jwt_expiry_seconds,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify and decode an HS256 JWT, requiring sub, role, iat, and exp claims."""
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "role", "iat", "exp"]},
    )


def set_auth_cookie(response: Response, token: str) -> None:
    """Attach the signed JWT to the response inside an HttpOnly cookie."""
    settings = get_settings()
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
        max_age=settings.jwt_expiry_seconds,
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the authentication cookie on logout."""
    settings = get_settings()
    response.set_cookie(
        key=settings.cookie_name,
        value="",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
        max_age=0,
    )
