"""Patient appointment CRUD endpoints (/api/v1/appointments/*)."""

from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.errors import APIError
from app.models import Appointment, User, utc_now
from app.schemas import (
    AppointmentCreateRequest,
    AppointmentUpdateRequest,
    serialize_appointment,
    success_response,
    to_utc,
)
from app.security import encrypt_text

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("")
def list_my_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """List appointments owned by the authenticated user ordered newest first."""
    rows = db.scalars(
        select(Appointment)
        .where(Appointment.user_id == current_user.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.id.desc())
    ).all()
    return success_response(
        {"appointments": [serialize_appointment(appt) for appt in rows]}
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create a new appointment with AES-256-GCM encrypted medical notes."""
    appointment = Appointment(
        user_id=current_user.id,
        patient_name=payload.patient_name,
        department=payload.department,
        appointment_date=to_utc(payload.appointment_date),
        medical_notes_enc=encrypt_text(payload.medical_notes),
        status="scheduled",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return success_response(serialize_appointment(appointment))


@router.get("/{appointment_id}")
def get_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Fetch a single appointment if owned by caller or caller is admin."""
    appointment = db.scalar(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    if appointment is None:
        raise APIError(404, "NOT_FOUND", "Appointment not found.")

    if appointment.user_id != current_user.id and current_user.role != "admin":
        raise APIError(
            403,
            "FORBIDDEN",
            "You do not have permission to access this appointment.",
        )

    return success_response(serialize_appointment(appointment))


@router.patch("/{appointment_id}")
def update_my_appointment(
    appointment_id: int,
    payload: AppointmentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Allow the owning patient to reschedule fields or cancel a non-completed booking."""
    appointment = db.scalar(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    if appointment is None:
        raise APIError(404, "NOT_FOUND", "Appointment not found.")

    if appointment.user_id != current_user.id:
        raise APIError(
            403,
            "FORBIDDEN",
            "Only the appointment owner can modify this appointment.",
        )

    if appointment.status == "completed":
        raise APIError(
            400,
            "INVALID_STATUS_CHANGE",
            "Completed appointments cannot be modified or cancelled.",
        )

    if payload.status is not None and payload.status != "cancelled":
        raise APIError(
            400,
            "INVALID_STATUS_CHANGE",
            "Patients may only update appointment status to 'cancelled'.",
        )

    if payload.appointment_date is not None:
        appointment.appointment_date = to_utc(payload.appointment_date)
    if payload.department is not None:
        appointment.department = payload.department
    if payload.medical_notes is not None:
        # Generate a fresh 12-byte nonce on every encrypted field update.
        appointment.medical_notes_enc = encrypt_text(payload.medical_notes)
    if payload.status is not None:
        appointment.status = payload.status

    appointment.updated_at = utc_now()
    db.commit()
    db.refresh(appointment)
    return success_response(serialize_appointment(appointment))
