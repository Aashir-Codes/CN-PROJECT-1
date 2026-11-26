"""Pydantic v2 request/response schemas and shared serialization helpers."""

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.models import Appointment
from app.security import decrypt_text

Department = Literal[
    "Cardiology",
    "General Medicine",
    "Orthopedics",
    "Pediatrics",
    "Dermatology",
    "Neurology",
]

AppointmentStatus = Literal[
    "scheduled",
    "confirmed",
    "completed",
    "cancelled",
]


def _strip_string(value: Any) -> Any:
    """Trim surrounding whitespace on string inputs before validation."""
    if isinstance(value, str):
        return value.strip()
    return value


def _normalize_email(value: Any) -> Any:
    """Trim and lowercase email inputs before EmailStr validation."""
    if isinstance(value, str):
        return value.strip().lower()
    return value


TrimmedName = Annotated[
    str,
    BeforeValidator(_strip_string),
    Field(min_length=2, max_length=120),
]

TrimmedNotes = Annotated[
    str,
    BeforeValidator(_strip_string),
    Field(min_length=1, max_length=4000),
]

NormalizedEmail = Annotated[
    EmailStr,
    BeforeValidator(_normalize_email),
]


def to_utc(dt: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def format_utc_iso(dt: datetime) -> str:
    """Format a datetime strictly as ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`)."""
    return to_utc(dt).strftime("%Y-%m-%dT%H:%M:%SZ")


def success_response(data: Any) -> dict[str, Any]:
    """Wrap response payload in the unified success envelope."""
    return {"status": "ok", "data": data}


class RegisterRequest(BaseModel):
    """Public patient registration request body."""

    full_name: TrimmedName
    email: NormalizedEmail
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def check_email_length(cls, value: EmailStr) -> EmailStr:
        if len(str(value)) > 255:
            raise ValueError("Email address must be at most 255 characters.")
        return value


class LoginRequest(BaseModel):
    """User/admin login request body."""

    email: NormalizedEmail
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def check_email_length(cls, value: EmailStr) -> EmailStr:
        if len(str(value)) > 255:
            raise ValueError("Email address must be at most 255 characters.")
        return value


class ChangePasswordRequest(BaseModel):
    """Authenticated user password rotation request body."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def verify_password_changed(self) -> "ChangePasswordRequest":
        if self.new_password == self.current_password:
            raise ValueError("New password must differ from current password.")
        return self


class UserPublic(BaseModel):
    """Publicly safe user identity payload returned by /auth/login and /auth/me."""

    id: int
    full_name: str
    email: str
    role: str


class UserRegistered(UserPublic):
    """User payload returned on 201 registration."""

    created_at: str


class AppointmentCreateRequest(BaseModel):
    """4-field patient intake form payload for creating an appointment."""

    patient_name: TrimmedName
    department: Department
    appointment_date: AwareDatetime
    medical_notes: TrimmedNotes


class AppointmentUpdateRequest(BaseModel):
    """Partial owner update payload for rescheduling or cancelling an appointment."""

    appointment_date: AwareDatetime | None = None
    department: Department | None = None
    medical_notes: TrimmedNotes | None = None
    status: AppointmentStatus | None = None

    @model_validator(mode="after")
    def ensure_non_empty_patch(self) -> "AppointmentUpdateRequest":
        if (
            self.appointment_date is None
            and self.department is None
            and self.medical_notes is None
            and self.status is None
        ):
            raise ValueError("At least one field must be provided for update.")
        return self


class AdminStatusUpdateRequest(BaseModel):
    """Admin-only payload for changing appointment lifecycle status."""

    status: AppointmentStatus


class AppointmentOut(BaseModel):
    """Serialized appointment response with decrypted medical_notes."""

    id: int
    user_id: int
    patient_name: str
    department: str
    appointment_date: str
    medical_notes: str
    status: str
    created_at: str
    updated_at: str


def serialize_appointment(appointment: Appointment) -> dict[str, Any]:
    """Decrypt medical_notes_enc and serialize an Appointment row to contract JSON."""
    return AppointmentOut(
        id=appointment.id,
        user_id=appointment.user_id,
        patient_name=appointment.patient_name,
        department=appointment.department,
        appointment_date=format_utc_iso(appointment.appointment_date),
        medical_notes=decrypt_text(appointment.medical_notes_enc),
        status=appointment.status,
        created_at=format_utc_iso(appointment.created_at),
        updated_at=format_utc_iso(appointment.updated_at),
    ).model_dump()
