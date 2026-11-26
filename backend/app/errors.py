"""Custom API exception class mapped to the unified JSON error envelope."""

from typing import Any


class APIError(Exception):
    """Application-level HTTP error rendered into the unified JSON error response."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.data = data
