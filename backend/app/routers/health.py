"""Health check endpoint reporting hostname, configured LAB_IP, and DB status."""

import socket
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.errors import APIError
from app.schemas import success_response

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Verify PostgreSQL connectivity and return node identity metadata."""
    settings = get_settings()
    hostname = socket.gethostname()
    # Read LAB_IP from configuration rather than resolving hostname via /etc/hosts.
    ip = settings.lab_ip

    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise APIError(
            status_code=500,
            code="DB_UNREACHABLE",
            message="Database connectivity check failed.",
            data={
                "hostname": hostname,
                "ip": ip,
                "db_reachable": False,
            },
        ) from exc

    return success_response(
        {
            "hostname": hostname,
            "ip": ip,
            "db_reachable": True,
        }
    )
