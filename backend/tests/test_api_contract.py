"""Comprehensive API contract and schema validation suite for all 13 endpoints."""

import base64
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import re
import socket

from fastapi.testclient import TestClient
import jwt
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateIndex, CreateTable

from app.config import get_settings
from app.database import get_db
from app.main import app as fastapi_app
from app.models import Appointment, User
from app.security import decode_access_token
from scripts.seed_admin import seed_admin

UTC_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def _register_and_login(
    client: TestClient,
    *,
    full_name: str = "Sara Ahmed",
    email: str = "sara.ahmed@example.com",
    password: str = "ClinicUser#2026",
) -> dict:
    reg = client.post(
        "/api/v1/auth/register",
        json={"full_name": full_name, "email": email, "password": password},
    )
    assert reg.status_code == 201, reg.text
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["data"]


def _login_seeded_admin(client: TestClient, db_session: Session) -> dict:
    seed_admin(db_session)
    settings = get_settings()
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": settings.admin_email,
            "password": settings.admin_password,
        },
    )
    assert login.status_code == 200, login.text
    return login.json()["data"]


# ---------------------------------------------------------------------------
# PostgreSQL DDL & Schema Verification (docs/Table.md)
# ---------------------------------------------------------------------------


def test_postgresql_ddl_matches_table_spec() -> None:
    """Verify SQLAlchemy models compile to exact PostgreSQL 16 DDL in Table.md."""
    pg_dialect = postgresql.dialect()
    users_ddl = str(CreateTable(User.__table__).compile(dialect=pg_dialect))
    appts_ddl = str(CreateTable(Appointment.__table__).compile(dialect=pg_dialect))
    index_ddls = [
        str(CreateIndex(idx).compile(dialect=pg_dialect))
        for idx in Appointment.__table__.indexes
    ]

    assert "CREATE TABLE users" in users_ddl
    assert "id SERIAL NOT NULL" in users_ddl
    assert "full_name VARCHAR(120) NOT NULL" in users_ddl
    assert "email VARCHAR(255) NOT NULL" in users_ddl
    assert "password_hash TEXT NOT NULL" in users_ddl
    assert "role VARCHAR(16) DEFAULT 'user' NOT NULL" in users_ddl
    assert "created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL" in users_ddl
    assert "CONSTRAINT uq_users_email UNIQUE (email)" in users_ddl
    assert "CONSTRAINT ck_users_role CHECK (role IN ('user', 'admin'))" in users_ddl

    assert "CREATE TABLE appointments" in appts_ddl
    assert "id SERIAL NOT NULL" in appts_ddl
    assert "patient_name VARCHAR(120) NOT NULL" in appts_ddl
    assert "department VARCHAR(80) NOT NULL" in appts_ddl
    assert "appointment_date TIMESTAMP WITH TIME ZONE NOT NULL" in appts_ddl
    assert "medical_notes_enc TEXT NOT NULL" in appts_ddl
    assert "status VARCHAR(20) DEFAULT 'scheduled' NOT NULL" in appts_ddl
    assert "FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE" in appts_ddl
    assert (
        "CONSTRAINT ck_appointments_status CHECK "
        "(status IN ('scheduled', 'confirmed', 'completed', 'cancelled'))"
    ) in appts_ddl
    assert any("ix_appointments_user_id" in ddl for ddl in index_ddls)
    assert any("ix_appointments_status" in ddl for ddl in index_ddls)


# ---------------------------------------------------------------------------
# Endpoint 1: GET /api/v1/health
# ---------------------------------------------------------------------------


def test_health_ok(client: TestClient) -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["data"]["hostname"] == socket.gethostname()
    assert body["data"]["ip"] == "192.168.67.20"
    assert body["data"]["db_reachable"] is True


def test_health_db_unreachable_returns_500_with_data_envelope(
    client: TestClient,
) -> None:
    class BrokenSession:
        def execute(self, *_args, **_kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    def _broken_db():
        yield BrokenSession()

    previous = fastapi_app.dependency_overrides.get(get_db)
    fastapi_app.dependency_overrides[get_db] = _broken_db
    try:
        res = client.get("/api/v1/health")
    finally:
        if previous is not None:
            fastapi_app.dependency_overrides[get_db] = previous

    assert res.status_code == 500
    body = res.json()
    assert body["status"] == "error"
    assert body["error"]["code"] == "DB_UNREACHABLE"
    assert body["data"] == {
        "hostname": socket.gethostname(),
        "ip": "192.168.67.20",
        "db_reachable": False,
    }


# ---------------------------------------------------------------------------
# Endpoint 2: POST /api/v1/auth/register
# ---------------------------------------------------------------------------


def test_register_success_normalization_argon2id_and_no_role_escalation(
    client: TestClient, db_session: Session
) -> None:
    res = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "  Sara Ahmed  ",
            "email": "  SARA.AHMED@Example.COM ",
            "password": "ClinicUser#2026",
            "role": "admin",  # Privilege escalation attempt must be ignored
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "ok"
    data = body["data"]
    assert data["full_name"] == "Sara Ahmed"
    assert data["email"] == "sara.ahmed@example.com"
    assert data["role"] == "user"
    assert "password_hash" not in data
    assert "password" not in data
    assert UTC_ISO_RE.match(data["created_at"])

    db_user = db_session.scalar(
        select(User).where(User.email == "sara.ahmed@example.com")
    )
    assert db_user is not None
    assert db_user.password_hash.startswith("$argon2id$")
    assert "ClinicUser#2026" not in db_user.password_hash

    # Case-insensitive duplicate registration must return 400 EMAIL_ALREADY_EXISTS
    dup = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Another Sara",
            "email": "Sara.Ahmed@example.com",
            "password": "AnotherPass#2026",
        },
    )
    assert dup.status_code == 400
    assert dup.json()["status"] == "error"
    assert dup.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_register_validation_errors_return_400_envelope(client: TestClient) -> None:
    bad_cases = [
        {"full_name": "A", "email": "ok@example.com", "password": "ValidPass#2026"},
        {"full_name": "Sara Ahmed", "email": "not-an-email", "password": "ValidPass#2026"},
        {"full_name": "Sara Ahmed", "email": "ok@example.com", "password": "short"},
    ]
    for payload in bad_cases:
        res = client.post("/api/v1/auth/register", json=payload)
        assert res.status_code == 400
        body = res.json()
        assert body["status"] == "error"
        assert body["error"]["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# Endpoints 3, 4, 5: login, me, logout & strict cookie-only JWT rules
# ---------------------------------------------------------------------------


def test_login_cookie_flags_jwt_claims_and_errors(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sara Ahmed",
            "email": "sara@example.com",
            "password": "ClinicUser#2026",
        },
    )
    assert reg.status_code == 201
    user_id = reg.json()["data"]["id"]

    # Malformed email -> 400 VALIDATION_ERROR
    bad_email = client.post(
        "/api/v1/auth/login",
        json={"email": "bad-email", "password": "ClinicUser#2026"},
    )
    assert bad_email.status_code == 400
    assert bad_email.json()["error"]["code"] == "VALIDATION_ERROR"

    # Wrong password -> 401 INVALID_CREDENTIALS
    wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"email": "sara@example.com", "password": "WrongPassword!"},
    )
    assert wrong_pw.status_code == 401
    assert wrong_pw.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # Unknown email -> 401 INVALID_CREDENTIALS
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "ClinicUser#2026"},
    )
    assert unknown.status_code == 401
    assert unknown.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # Valid login -> 200 + strict HttpOnly/Secure/SameSite=Lax/Path=/Max-Age=1800 cookie
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "SARA@example.com", "password": "ClinicUser#2026"},
    )
    assert res.status_code == 200
    assert res.json() == {
        "status": "ok",
        "data": {
            "id": user_id,
            "full_name": "Sara Ahmed",
            "email": "sara@example.com",
            "role": "user",
        },
    }

    set_cookie = res.headers.get("set-cookie", "")
    lower_cookie = set_cookie.lower()
    assert "access_token=" in set_cookie
    assert "httponly" in lower_cookie
    assert "secure" in lower_cookie
    assert "samesite=lax" in lower_cookie
    assert "path=/" in lower_cookie
    assert "max-age=1800" in lower_cookie

    token = res.cookies.get("access_token")
    assert token is not None
    claims = decode_access_token(token)
    assert claims["sub"] == str(user_id)
    assert claims["role"] == "user"
    assert isinstance(claims["iat"], int)
    assert isinstance(claims["exp"], int)
    assert claims["exp"] - claims["iat"] == 1800


def test_me_and_logout_enforce_cookie_only_auth(
    make_client: Callable[[], TestClient],
) -> None:
    c1 = make_client()
    user = _register_and_login(c1)
    token = c1.cookies.get("access_token")
    assert token is not None

    # Authenticated via cookie -> 200
    me = c1.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["email"] == user["email"]

    # Ground rule #2: Authorization: Bearer header MUST NOT authenticate!
    c_bearer = make_client()
    bearer_res = c_bearer.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bearer_res.status_code == 401
    assert bearer_res.json()["error"]["code"] == "UNAUTHORIZED"

    # Expired token in cookie -> 401
    settings = get_settings()
    expired_jwt = jwt.encode(
        {
            "sub": str(user["id"]),
            "role": "user",
            "iat": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    c_expired = make_client()
    c_expired.cookies.set("access_token", expired_jwt)
    assert c_expired.get("/api/v1/auth/me").status_code == 401

    # Tampered token in cookie -> 401
    c_tampered = make_client()
    c_tampered.cookies.set("access_token", token + "tampered")
    assert c_tampered.get("/api/v1/auth/me").status_code == 401

    # Unauthenticated logout -> 401
    c_anon = make_client()
    assert c_anon.post("/api/v1/auth/logout").status_code == 401

    # Authenticated logout -> 200 + Max-Age=0, subsequent /me -> 401
    out = c1.post("/api/v1/auth/logout")
    assert out.status_code == 200
    assert out.json() == {
        "status": "ok",
        "data": {"message": "Logged out successfully."},
    }
    out_cookie = out.headers.get("set-cookie", "").lower()
    assert "max-age=0" in out_cookie
    assert "httponly" in out_cookie
    assert "secure" in out_cookie
    assert "samesite=lax" in out_cookie
    assert "path=/" in out_cookie

    assert c1.get("/api/v1/auth/me").status_code == 401


# ---------------------------------------------------------------------------
# Endpoint 6: PATCH /api/v1/auth/change-password
# ---------------------------------------------------------------------------


def test_change_password_flow_and_errors(client: TestClient) -> None:
    # Unauthenticated -> 401
    assert (
        client.patch(
            "/api/v1/auth/change-password",
            json={"current_password": "Old", "new_password": "NewSecurePass#2026"},
        ).status_code
        == 401
    )

    _register_and_login(client, email="sara@example.com", password="ClinicUser#2026")

    # Weak new password -> 400 VALIDATION_ERROR
    weak = client.patch(
        "/api/v1/auth/change-password",
        json={"current_password": "ClinicUser#2026", "new_password": "short"},
    )
    assert weak.status_code == 400
    assert weak.json()["error"]["code"] == "VALIDATION_ERROR"

    # Unchanged password -> 400 VALIDATION_ERROR
    same = client.patch(
        "/api/v1/auth/change-password",
        json={"current_password": "ClinicUser#2026", "new_password": "ClinicUser#2026"},
    )
    assert same.status_code == 400
    assert same.json()["error"]["code"] == "VALIDATION_ERROR"

    # Wrong current password -> 401 INVALID_CREDENTIALS
    wrong = client.patch(
        "/api/v1/auth/change-password",
        json={
            "current_password": "WrongPassword#2026",
            "new_password": "NewSecurePass#2026",
        },
    )
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # Valid change -> 200, old fails login, new succeeds login
    ok = client.patch(
        "/api/v1/auth/change-password",
        json={
            "current_password": "ClinicUser#2026",
            "new_password": "NewSecurePass#2026",
        },
    )
    assert ok.status_code == 200
    assert ok.json()["data"]["message"] == "Password updated successfully."

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "sara@example.com", "password": "ClinicUser#2026"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "sara@example.com", "password": "NewSecurePass#2026"},
    )
    assert new_login.status_code == 200


# ---------------------------------------------------------------------------
# Endpoints 7, 8, 9, 10: Patient Appointments + AES-256-GCM Nonce Rotation
# ---------------------------------------------------------------------------


def test_appointments_create_encrypt_list_and_validation(
    make_client: Callable[[], TestClient], db_session: Session
) -> None:
    anon = make_client()
    assert anon.get("/api/v1/appointments").status_code == 401
    assert (
        anon.post(
            "/api/v1/appointments",
            json={
                "patient_name": "Sara Ahmed",
                "department": "Cardiology",
                "appointment_date": "2026-12-01T10:30:00Z",
                "medical_notes": "Chest tightness",
            },
        ).status_code
        == 401
    )

    sara_client = make_client()
    sara = _register_and_login(sara_client, email="sara@example.com")

    other_client = make_client()
    _register_and_login(
        other_client, full_name="Bilal Raza", email="bilal@example.com"
    )

    # Validation errors -> 400 VALIDATION_ERROR
    invalid_payloads = [
        {
            "patient_name": "Sara Ahmed",
            "department": "UnknownDept",
            "appointment_date": "2026-12-01T10:30:00Z",
            "medical_notes": "Symptoms",
        },
        {
            "patient_name": "Sara Ahmed",
            "department": "Cardiology",
            "appointment_date": "2026-12-01T10:30:00",  # naive timestamp
            "medical_notes": "Symptoms",
        },
        {
            "patient_name": "Sara Ahmed",
            "department": "Cardiology",
            "appointment_date": "2026-12-01T10:30:00Z",
            "medical_notes": "   ",  # blank after trim
        },
    ]
    for bad in invalid_payloads:
        r = sara_client.post("/api/v1/appointments", json=bad)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    # Create two appointments for Sara (earlier then later date)
    secret_note = "Mild chest tightness during brisk walking for 3 days."
    first = sara_client.post(
        "/api/v1/appointments",
        json={
            "patient_name": "Sara Ahmed",
            "department": "Cardiology",
            "appointment_date": "2026-12-01T10:30:00Z",
            "medical_notes": secret_note,
        },
    )
    assert first.status_code == 201
    d1 = first.json()["data"]
    assert d1["user_id"] == sara["id"]
    assert d1["status"] == "scheduled"
    assert d1["medical_notes"] == secret_note
    assert d1["appointment_date"] == "2026-12-01T10:30:00Z"
    assert UTC_ISO_RE.match(d1["created_at"])
    assert UTC_ISO_RE.match(d1["updated_at"])

    # Verify DB stores ciphertext (not plaintext) in AES-256-GCM frame (>= 28B)
    row = db_session.scalar(select(Appointment).where(Appointment.id == d1["id"]))
    assert row is not None
    assert secret_note not in row.medical_notes_enc
    raw_bytes = base64.b64decode(row.medical_notes_enc)
    assert len(raw_bytes) >= 12 + len(secret_note.encode("utf-8")) + 16

    second = sara_client.post(
        "/api/v1/appointments",
        json={
            "patient_name": "Sara Ahmed",
            "department": "Neurology",
            "appointment_date": "2026-12-10T15:00:00+05:00",  # converts to 10:00Z
            "medical_notes": "Recurring headaches.",
        },
    )
    assert second.status_code == 201
    assert second.json()["data"]["appointment_date"] == "2026-12-10T10:00:00Z"

    # Create appointment for Bilal to verify isolation
    bilal_appt = other_client.post(
        "/api/v1/appointments",
        json={
            "patient_name": "Bilal Raza",
            "department": "Orthopedics",
            "appointment_date": "2026-12-05T09:00:00Z",
            "medical_notes": "Right knee pain.",
        },
    )
    assert bilal_appt.status_code == 201

    # Sara sees ONLY her own appointments ordered by appointment_date DESC
    listed = sara_client.get("/api/v1/appointments")
    assert listed.status_code == 200
    appts = listed.json()["data"]["appointments"]
    assert [a["id"] for a in appts] == [second.json()["data"]["id"], d1["id"]]


def test_get_and_patch_appointment_permissions_and_fresh_nonce(
    make_client: Callable[[], TestClient], db_session: Session
) -> None:
    sara_client = make_client()
    _register_and_login(sara_client, email="sara@example.com")

    bilal_client = make_client()
    _register_and_login(bilal_client, full_name="Bilal Raza", email="bilal@example.com")

    admin_client = make_client()
    _login_seeded_admin(admin_client, db_session)

    created = sara_client.post(
        "/api/v1/appointments",
        json={
            "patient_name": "Sara Ahmed",
            "department": "Cardiology",
            "appointment_date": "2026-12-01T10:30:00Z",
            "medical_notes": "Original symptom note.",
        },
    )
    appt_id = created.json()["data"]["id"]

    # Endpoint 9: GET /api/v1/appointments/{id}
    assert make_client().get(f"/api/v1/appointments/{appt_id}").status_code == 401
    assert sara_client.get(f"/api/v1/appointments/{appt_id}").status_code == 200
    assert admin_client.get(f"/api/v1/appointments/{appt_id}").status_code == 200
    assert bilal_client.get(f"/api/v1/appointments/{appt_id}").status_code == 403
    assert sara_client.get("/api/v1/appointments/99999").status_code == 404

    # Capture original AES-GCM ciphertext and 12-byte nonce
    row_before = db_session.scalar(select(Appointment).where(Appointment.id == appt_id))
    assert row_before is not None
    old_enc = row_before.medical_notes_enc
    old_nonce = base64.b64decode(old_enc)[:12]

    # Endpoint 10: PATCH /api/v1/appointments/{id}
    # Empty PATCH -> 400 VALIDATION_ERROR
    empty_patch = sara_client.patch(f"/api/v1/appointments/{appt_id}", json={})
    assert empty_patch.status_code == 400
    assert empty_patch.json()["error"]["code"] == "VALIDATION_ERROR"

    # Non-owner patient -> 403 FORBIDDEN
    assert (
        bilal_client.patch(
            f"/api/v1/appointments/{appt_id}", json={"status": "cancelled"}
        ).status_code
        == 403
    )

    # Admin on patient PATCH route -> 403 FORBIDDEN (owner-only route per contract)
    assert (
        admin_client.patch(
            f"/api/v1/appointments/{appt_id}", json={"status": "cancelled"}
        ).status_code
        == 403
    )

    # Nonexistent ID -> 404 NOT_FOUND
    assert (
        sara_client.patch(
            "/api/v1/appointments/99999", json={"status": "cancelled"}
        ).status_code
        == 404
    )

    # Patient setting non-cancelled status -> 400 INVALID_STATUS_CHANGE
    bad_status = sara_client.patch(
        f"/api/v1/appointments/{appt_id}", json={"status": "confirmed"}
    )
    assert bad_status.status_code == 400
    assert bad_status.json()["error"]["code"] == "INVALID_STATUS_CHANGE"

    # Reschedule with IDENTICAL note text MUST produce a fresh 12-byte nonce!
    resched = sara_client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={
            "appointment_date": "2026-12-03T14:00:00Z",
            "department": "General Medicine",
            "medical_notes": "Original symptom note.",
        },
    )
    assert resched.status_code == 200
    assert resched.json()["data"]["department"] == "General Medicine"
    assert resched.json()["data"]["appointment_date"] == "2026-12-03T14:00:00Z"
    assert resched.json()["data"]["medical_notes"] == "Original symptom note."

    db_session.expire_all()
    row_after = db_session.scalar(select(Appointment).where(Appointment.id == appt_id))
    assert row_after is not None
    new_enc = row_after.medical_notes_enc
    new_nonce = base64.b64decode(new_enc)[:12]
    assert new_enc != old_enc
    assert new_nonce != old_nonce

    # Owner cancel -> 200 status == cancelled
    cancelled = sara_client.patch(
        f"/api/v1/appointments/{appt_id}", json={"status": "cancelled"}
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "cancelled"

    # Once completed by admin, owner cannot modify or cancel -> 400 INVALID_STATUS_CHANGE
    mark_completed = admin_client.patch(
        f"/api/v1/admin/appointments/{appt_id}/status",
        json={"status": "completed"},
    )
    assert mark_completed.status_code == 200

    modify_completed = sara_client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "cancelled"},
    )
    assert modify_completed.status_code == 400
    assert modify_completed.json()["error"]["code"] == "INVALID_STATUS_CHANGE"


# ---------------------------------------------------------------------------
# Endpoints 11, 12, 13: Admin Endpoints + RBAC (401 vs 403)
# ---------------------------------------------------------------------------


def test_admin_endpoints_and_rbac(
    make_client: Callable[[], TestClient], db_session: Session
) -> None:
    anon = make_client()
    user_client = make_client()
    _register_and_login(user_client, email="sara@example.com")

    user2_client = make_client()
    _register_and_login(
        user2_client, full_name="Bilal Raza", email="bilal@example.com"
    )

    admin_client = make_client()
    _login_seeded_admin(admin_client, db_session)

    a1 = user_client.post(
        "/api/v1/appointments",
        json={
            "patient_name": "Sara Ahmed",
            "department": "Cardiology",
            "appointment_date": "2026-12-01T10:30:00Z",
            "medical_notes": "Sara notes.",
        },
    ).json()["data"]["id"]

    a2 = user2_client.post(
        "/api/v1/appointments",
        json={
            "patient_name": "Bilal Raza",
            "department": "Dermatology",
            "appointment_date": "2026-12-02T11:00:00Z",
            "medical_notes": "Bilal notes.",
        },
    ).json()["data"]["id"]

    # RBAC checks across all 3 admin endpoints: 401 unauthenticated, 403 regular user
    assert anon.get("/api/v1/admin/appointments").status_code == 401
    assert user_client.get("/api/v1/admin/appointments").status_code == 403
    assert (
        user_client.patch(
            f"/api/v1/admin/appointments/{a1}/status", json={"status": "confirmed"}
        ).status_code
        == 403
    )
    assert user_client.delete(f"/api/v1/admin/appointments/{a1}").status_code == 403

    # Endpoint 11: GET /api/v1/admin/appointments returns all patients' bookings (newest first)
    all_res = admin_client.get("/api/v1/admin/appointments")
    assert all_res.status_code == 200
    all_appts = all_res.json()["data"]["appointments"]
    assert [a["id"] for a in all_appts] == [a2, a1]
    assert all_appts[0]["medical_notes"] == "Bilal notes."
    assert all_appts[1]["medical_notes"] == "Sara notes."

    # Endpoint 12: PATCH /api/v1/admin/appointments/{id}/status
    bad_status = admin_client.patch(
        f"/api/v1/admin/appointments/{a1}/status", json={"status": "unknown"}
    )
    assert bad_status.status_code == 400
    assert bad_status.json()["error"]["code"] == "VALIDATION_ERROR"

    assert (
        admin_client.patch(
            "/api/v1/admin/appointments/99999/status", json={"status": "confirmed"}
        ).status_code
        == 404
    )

    for next_status in ("confirmed", "completed", "scheduled", "cancelled"):
        upd = admin_client.patch(
            f"/api/v1/admin/appointments/{a1}/status",
            json={"status": next_status},
        )
        assert upd.status_code == 200
        assert upd.json()["data"]["status"] == next_status

    # Endpoint 13: DELETE /api/v1/admin/appointments/{id}
    # Cannot delete scheduled/confirmed/completed appointment -> 400 APPOINTMENT_NOT_CANCELLED
    for blocked_status in ("scheduled", "confirmed", "completed"):
        admin_client.patch(
            f"/api/v1/admin/appointments/{a2}/status",
            json={"status": blocked_status},
        )
        del_blocked = admin_client.delete(f"/api/v1/admin/appointments/{a2}")
        assert del_blocked.status_code == 400
        assert del_blocked.json()["error"]["code"] == "APPOINTMENT_NOT_CANCELLED"

    assert admin_client.delete("/api/v1/admin/appointments/99999").status_code == 404

    # Deleting cancelled appointment (a1) -> 200 + permanently removed
    del_ok = admin_client.delete(f"/api/v1/admin/appointments/{a1}")
    assert del_ok.status_code == 200
    assert del_ok.json() == {
        "status": "ok",
        "data": {
            "deleted_id": a1,
            "message": "Cancelled appointment deleted.",
        },
    }
    assert admin_client.get(f"/api/v1/appointments/{a1}").status_code == 404


# ---------------------------------------------------------------------------
# Admin Seed Script Idempotency
# ---------------------------------------------------------------------------


def test_seed_admin_is_idempotent(db_session: Session) -> None:
    admin1, created1 = seed_admin(db_session)
    assert created1 is True
    assert admin1.role == "admin"
    assert admin1.password_hash.startswith("$argon2id$")

    admin2, created2 = seed_admin(db_session)
    assert created2 is False
    assert admin2.id == admin1.id

    all_admins = db_session.scalars(
        select(User).where(User.email == admin1.email)
    ).all()
    assert len(all_admins) == 1
