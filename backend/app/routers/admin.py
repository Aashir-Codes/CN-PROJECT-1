"""Clinic staff admin-only appointment management endpoints (/api/v1/admin/*)."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.errors import APIError
from app.models import Appointment, User, utc_now
from app.schemas import (
    AdminStatusUpdateRequest,
    serialize_appointment,
    success_response,
)

router = APIRouter(prefix="/admin/appointments", tags=["admin"])


@router.get("")
def list_all_appointments(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """List all clinic appointments across all patients ordered by creation time."""
    rows = db.scalars(
        select(Appointment).order_by(
            Appointment.created_at.desc(), Appointment.id.desc()
        )
    ).all()
    return success_response(
        {"appointments": [serialize_appointment(appt) for appt in rows]}
    )


@router.patch("/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    payload: AdminStatusUpdateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Allow clinic staff to transition any appointment to a valid status."""
    appointment = db.scalar(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    if appointment is None:
        raise APIError(404, "NOT_FOUND", "Appointment not found.")

    appointment.status = payload.status
    appointment.updated_at = utc_now()
    db.commit()
    db.refresh(appointment)
    return success_response(serialize_appointment(appointment))


@router.delete("/{appointment_id}")
def delete_cancelled_appointment(
    appointment_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Permanently delete an appointment only when its status is 'cancelled'."""
    appointment = db.scalar(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    if appointment is None:
        raise APIError(404, "NOT_FOUND", "Appointment not found.")

    if appointment.status != "cancelled":
        raise APIError(
            400,
            "APPOINTMENT_NOT_CANCELLED",
            "Only appointments with status 'cancelled' can be deleted.",
        )

    db.delete(appointment)
    db.commit()
    return success_response(
        {
            "deleted_id": appointment_id,
            "message": "Cancelled appointment deleted.",
        }
    )
