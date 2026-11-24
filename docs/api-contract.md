# REST API Contract (`/api/v1`)

**Shared Interface Between:**
- **Frontend Consumer:** Abdullah Saeed (`BSCS25067` — React + Vite)
- **Backend Producer:** Muhammad Aashir Khan (`BSCS25079` — FastAPI + PostgreSQL)

**Base URLs:**
- **Frontend relative path (same-origin via Nginx):** `/api/v1`
- **VM1 HTTPS Entrypoint (Deployment 1):** `https://192.168.67.10/api/v1`
- **VM3 Docker HTTPS Entrypoint (Deployment 2):** `https://192.168.67.30/api/v1`
- **Local Dev (via Vite proxy):** `/api/v1` → `http://127.0.0.1:8000`

---

## 1. Locked-In Contract Defaults

| Setting | Agreed Value |
| :--- | :--- |
| **Auth Cookie Name** | `access_token` |
| **Cookie Attributes** | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800` |
| **JWT Signing Algorithm** | `HS256` (signed with `JWT_SECRET` from `.env`) |
| **JWT Expiry** | `30` minutes (`1800` seconds) |
| **JWT Claims Payload** | `{ "sub": "<user_id>", "role": "user" \| "admin", "iat": <unix>, "exp": <unix> }` |
| **Password Policy** | Minimum `8` characters, maximum `128` characters (Argon2id hashed) |
| **Email Normalization** | Trimmed and lowercased on registration & login |
| **Allowed `department` Enum** | `Cardiology`, `General Medicine`, `Orthopedics`, `Pediatrics`, `Dermatology`, `Neurology` |
| **Allowed `status` Enum** | `scheduled`, `confirmed`, `completed`, `cancelled` |
| **Frontend Fetch Mode** | `fetch("/api/v1/...", { credentials: "include" })` — never `localStorage`, never `Authorization: Bearer` |
| **Timestamp Format** | ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`) |

---

## 2. Unified JSON Response Envelope

Every API endpoint returns JSON in one of these two formats:

### Success Response
```json
{
  "status": "ok",
  "data": { }
}
```

### Error Response
```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of what went wrong."
  }
}
```

### Standardized Error Codes

| HTTP Status | `error.code` | When Returned |
| :---: | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Missing/invalid fields, bad department enum, weak password (< 8 chars), invalid date format, or empty PATCH payload. |
| `400` | `EMAIL_ALREADY_EXISTS` | Registration attempted with an email already in `users`. |
| `400` | `APPOINTMENT_NOT_CANCELLED` | Admin attempted `DELETE /api/v1/admin/appointments/{id}` while `status != "cancelled"`. |
| `400` | `INVALID_STATUS_CHANGE` | Patient attempted to set an unsupported status (patients may only set `"cancelled"`), or attempted to reschedule/cancel an already `completed` appointment. |
| `401` | `INVALID_CREDENTIALS` | Wrong email/password on login, or wrong current password on `change-password`. |
| `401` | `UNAUTHORIZED` | Missing, malformed, expired, or invalid `access_token` cookie. |
| `403` | `FORBIDDEN` | Authenticated user lacks required role (`admin`) or does not own the requested appointment. |
| `404` | `NOT_FOUND` | Appointment ID does not exist. |
| `429` | `RATE_LIMITED` | Nginx login rate limit exceeded (`5r/m`, `burst=3 nodelay`) on `POST /api/v1/auth/login`. |
| `500` | `DB_UNREACHABLE` | Database connectivity failure (e.g., `GET /api/v1/health` reports `db_reachable: false`). |
| `500` | `INTERNAL_ERROR` | Unexpected server error. |

> [!NOTE]
> **Proxy & WAF Non-JSON Responses:** Nginx (`429` login rate limit) and ModSecurity (`403` WAF block in Bonus 2) return HTML error pages by default unless Nginx explicitly defines a JSON `error_page` handler (e.g., `error_page 429 = @rate_limited;` in [design-doc.md](./design-doc.md)). To prevent JSON parse crashes on the client, `frontend/src/api/client.js` **must** inspect `res.status` and the `Content-Type` header before calling `res.json()` so `/login` cleanly displays `429 Too many attempts` (and WAF blocks display a clear `403` error).

---

## 3. Endpoint Summary Table

| # | Method | Endpoint | Auth / Role | Status Codes | Purpose |
| :-: | :---: | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/v1/health` | Public | `200`, `500` | Return `{ hostname, ip, db_reachable }` |
| 2 | `POST` | `/api/v1/auth/register` | Public | `201`, `400` | Register new `user` account (Argon2id hash) |
| 3 | `POST` | `/api/v1/auth/login` | Public *(Nginx rate-limited)* | `200`, `400`, `401`, `429` | Verify credentials, issue `access_token` JWT cookie |
| 4 | `POST` | `/api/v1/auth/logout` | Authenticated | `200`, `401` | Clear `access_token` cookie |
| 5 | `GET` | `/api/v1/auth/me` | Authenticated | `200`, `401` | Return `{ id, full_name, email, role }` |
| 6 | `PATCH` | `/api/v1/auth/change-password` | Authenticated | `200`, `400`, `401` | Verify current password, save new Argon2id hash |
| 7 | `GET` | `/api/v1/appointments` | `user` / `admin` | `200`, `401` | List current user's appointments (decrypted notes) |
| 8 | `POST` | `/api/v1/appointments` | `user` / `admin` | `201`, `400`, `401` | Book appointment (encrypts `medical_notes`) |
| 9 | `GET` | `/api/v1/appointments/{id}` | Owner / `admin` | `200`, `401`, `403`, `404` | Get single appointment (decrypted notes) |
| 10 | `PATCH` | `/api/v1/appointments/{id}` | Owner | `200`, `400`, `401`, `403`, `404` | Reschedule or cancel (`status: "cancelled"`) |
| 11 | `GET` | `/api/v1/admin/appointments` | `admin` only | `200`, `401`, `403` | View all appointments across all patients |
| 12 | `PATCH` | `/api/v1/admin/appointments/{id}/status` | `admin` only | `200`, `400`, `401`, `403`, `404` | Update any appointment's status |
| 13 | `DELETE` | `/api/v1/admin/appointments/{id}` | `admin` only | `200`, `400`, `401`, `403`, `404` | Delete a `cancelled` appointment |

---

## 4. Detailed Endpoint Specifications

### 4.1 System Health

#### `GET /api/v1/health`
- **Auth:** Public
- **Notes:** `ip` is read from `LAB_IP` env var or lab NIC (never `socket.gethostbyname(socket.gethostname())`).

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "hostname": "bscs25067-api",
    "ip": "192.168.67.20",
    "db_reachable": true
  }
}
```

**Response `500 Internal Server Error` (when DB is down):**

> [!NOTE]
> `GET /api/v1/health` `500` is the **sole intentional exception** to the strict error-only envelope: it returns `"data"` (`{ "hostname", "ip", "db_reachable": false }`) alongside `"error"` so health checks and Part 6 Fault #2 (`db_reachable: false`) can inspect the status payload cleanly.

```json
{
  "status": "error",
  "error": {
    "code": "DB_UNREACHABLE",
    "message": "Database connectivity check failed."
  },
  "data": {
    "hostname": "bscs25067-api",
    "ip": "192.168.67.20",
    "db_reachable": false
  }
}
```

```bash
curl -v --cacert web.crt https://192.168.67.10/api/v1/health
```

---

### 4.2 Authentication & Session Endpoints

#### `POST /api/v1/auth/register`
- **Auth:** Public
- **Behavior:** Always creates `role = "user"`. Lowercases `email`. Hashes `password` with Argon2id.

**Request Body:**
```json
{
  "full_name": "Sara Ahmed",
  "email": "sara.ahmed@example.com",
  "password": "ClinicUser#2026"
}
```
- `full_name`: string, 2–120 chars.
- `email`: valid email format, max 255 chars, unique.
- `password`: string, 8–128 chars.

**Response `201 Created`:**
```json
{
  "status": "ok",
  "data": {
    "id": 2,
    "full_name": "Sara Ahmed",
    "email": "sara.ahmed@example.com",
    "role": "user",
    "created_at": "2026-11-24T14:30:00Z"
  }
}
```

**Response `400 Bad Request`:** `VALIDATION_ERROR` or `EMAIL_ALREADY_EXISTS`.

```bash
curl -vk -X POST https://192.168.67.10/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Sara Ahmed","email":"sara.ahmed@example.com","password":"ClinicUser#2026"}'
```

---

#### `POST /api/v1/auth/login`
- **Auth:** Public *(Nginx rate-limited: `5r/m`, `burst=3 nodelay` → `429`)*

**Request Body:**
```json
{
  "email": "sara.ahmed@example.com",
  "password": "ClinicUser#2026"
}
```

**Response Headers (`200 OK`):**
```http
Set-Cookie: access_token=<signed-jwt>; HttpOnly; Max-Age=1800; Path=/; SameSite=Lax; Secure
```

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "id": 2,
    "full_name": "Sara Ahmed",
    "email": "sara.ahmed@example.com",
    "role": "user"
  }
}
```

**Error Responses:**
- `400 Bad Request` (`VALIDATION_ERROR`) — malformed email or missing field.
- `401 Unauthorized` (`INVALID_CREDENTIALS`) — email not found or wrong password.
- `429 Too Many Requests` (`RATE_LIMITED`) — Nginx rate limit triggered.

> [!NOTE]
> Nginx returns HTML for `429` by default unless configured with a JSON `error_page 429 = @rate_limited;` block (see [design-doc.md](./design-doc.md)). `frontend/src/api/client.js` must still check `res.status` and `Content-Type` before calling `res.json()` so `/login` cleanly renders `429 Too many attempts` without a JSON parse `SyntaxError`.

```bash
# Save cookie jar for subsequent authenticated requests
curl -vk -c cookies.txt -X POST https://192.168.67.10/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sara.ahmed@example.com","password":"ClinicUser#2026"}'
```

---

#### `POST /api/v1/auth/logout`
- **Auth:** Authenticated (`Cookie: access_token=...`)

**Response Headers (`200 OK`):**
```http
Set-Cookie: access_token=; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure
```

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "message": "Logged out successfully."
  }
}
```

**Error Responses:** `401 Unauthorized` (`UNAUTHORIZED`).

```bash
curl -vk -b cookies.txt -c cookies.txt -X POST https://192.168.67.10/api/v1/auth/logout
```

---

#### `GET /api/v1/auth/me`
- **Auth:** Authenticated (`Cookie: access_token=...`)
- **Frontend Usage:** Called on app load by `AuthContext.jsx` to hydrate user session state.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "id": 2,
    "full_name": "Sara Ahmed",
    "email": "sara.ahmed@example.com",
    "role": "user"
  }
}
```

**Error Responses:** `401 Unauthorized` (`UNAUTHORIZED`).

```bash
curl -vk -b cookies.txt https://192.168.67.10/api/v1/auth/me
```

---

#### `PATCH /api/v1/auth/change-password`
- **Auth:** Authenticated (`Cookie: access_token=...`)

**Request Body:**
```json
{
  "current_password": "ClinicUser#2026",
  "new_password": "NewSecurePass#2026"
}
```
- `new_password`: 8–128 chars; must differ from `current_password`.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "message": "Password updated successfully."
  }
}
```

**Error Responses:**
- `400 Bad Request` (`VALIDATION_ERROR`) — weak or unchanged `new_password`.
- `401 Unauthorized` (`UNAUTHORIZED` or `INVALID_CREDENTIALS`).

```bash
curl -vk -b cookies.txt -X PATCH https://192.168.67.10/api/v1/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{"current_password":"ClinicUser#2026","new_password":"NewSecurePass#2026"}'
```

---

### 4.3 Patient Appointment Endpoints

#### Shared Appointment Response Object
```json
{
  "id": 10,
  "user_id": 2,
  "patient_name": "Sara Ahmed",
  "department": "Cardiology",
  "appointment_date": "2026-12-01T10:30:00Z",
  "medical_notes": "Mild chest tightness during brisk walking for 3 days.",
  "status": "scheduled",
  "created_at": "2026-11-24T14:35:00Z",
  "updated_at": "2026-11-24T14:35:00Z"
}
```
*(Note: `medical_notes` is decrypted server-side from `appointments.medical_notes_enc` before returning.)*

---

#### `GET /api/v1/appointments`
- **Auth:** `user` / `admin`
- **Behavior:** Returns appointments where `appointments.user_id == current_user.id`, ordered by `appointment_date DESC`.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "appointments": [
      {
        "id": 10,
        "user_id": 2,
        "patient_name": "Sara Ahmed",
        "department": "Cardiology",
        "appointment_date": "2026-12-01T10:30:00Z",
        "medical_notes": "Mild chest tightness during brisk walking for 3 days.",
        "status": "scheduled",
        "created_at": "2026-11-24T14:35:00Z",
        "updated_at": "2026-11-24T14:35:00Z"
      }
    ]
  }
}
```

**Error Responses:** `401 Unauthorized`.

```bash
curl -vk -b cookies.txt https://192.168.67.10/api/v1/appointments
```

---

#### `POST /api/v1/appointments`
- **Auth:** `user` / `admin`
- **Behavior:** Validates all 4 intake fields, generates a fresh 12-byte nonce, encrypts `medical_notes` with AES-256-GCM into `medical_notes_enc`, and sets `status = "scheduled"`.

**Request Body:**
```json
{
  "patient_name": "Sara Ahmed",
  "department": "Cardiology",
  "appointment_date": "2026-12-01T10:30:00Z",
  "medical_notes": "Mild chest tightness during brisk walking for 3 days."
}
```

**Response `201 Created`:**
```json
{
  "status": "ok",
  "data": {
    "id": 10,
    "user_id": 2,
    "patient_name": "Sara Ahmed",
    "department": "Cardiology",
    "appointment_date": "2026-12-01T10:30:00Z",
    "medical_notes": "Mild chest tightness during brisk walking for 3 days.",
    "status": "scheduled",
    "created_at": "2026-11-24T14:35:00Z",
    "updated_at": "2026-11-24T14:35:00Z"
  }
}
```

**Error Responses:** `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized`.

```bash
curl -vk -b cookies.txt -X POST https://192.168.67.10/api/v1/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "Sara Ahmed",
    "department": "Cardiology",
    "appointment_date": "2026-12-01T10:30:00Z",
    "medical_notes": "Mild chest tightness during brisk walking for 3 days."
  }'
```

---

#### `GET /api/v1/appointments/{id}`
- **Auth:** Owner (`appointments.user_id == current_user.id`) or `admin`

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "id": 10,
    "user_id": 2,
    "patient_name": "Sara Ahmed",
    "department": "Cardiology",
    "appointment_date": "2026-12-01T10:30:00Z",
    "medical_notes": "Mild chest tightness during brisk walking for 3 days.",
    "status": "scheduled",
    "created_at": "2026-11-24T14:35:00Z",
    "updated_at": "2026-11-24T14:35:00Z"
  }
}
```

**Error Responses:** `401 Unauthorized`, `403 Forbidden` (not owner & not admin), `404 Not Found`.

```bash
curl -vk -b cookies.txt https://192.168.67.10/api/v1/appointments/10
```

---

#### `PATCH /api/v1/appointments/{id}`
- **Auth:** Owner only (`appointments.user_id == current_user.id`)
- **Behavior:** Allows partial update of `appointment_date`, `department`, `medical_notes` (re-encrypted with a **new** 12-byte nonce), or cancelling (`status: "cancelled"`). At least one field must be provided. Setting any status other than `"cancelled"`, or attempting to reschedule or cancel an already `completed` appointment, returns `400 INVALID_STATUS_CHANGE` (matching [PRD.md](./PRD.md)).

**Request Body (Reschedule Example):**
```json
{
  "appointment_date": "2026-12-03T14:00:00Z",
  "department": "General Medicine",
  "medical_notes": "Updated symptoms: mild fatigue and tightness."
}
```

**Request Body (Cancel Example):**
```json
{
  "status": "cancelled"
}
```

**Response `200 OK`:** Returns updated Appointment object in `{ "status": "ok", "data": { ... } }`.

**Error Responses:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (not owner), `404 Not Found`.

```bash
curl -vk -b cookies.txt -X PATCH https://192.168.67.10/api/v1/appointments/10 \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}'
```

---

### 4.4 Admin-Only Clinic Staff Endpoints

All `/api/v1/admin/*` endpoints strictly require `role == "admin"` verified from the JWT cookie via FastAPI dependency. Any authenticated `user` receives `403 Forbidden`.

#### `GET /api/v1/admin/appointments`
- **Auth:** `admin` only
- **Behavior:** Lists all appointments across all patients (decrypted `medical_notes` plus owner `user_email` / `user_full_name` metadata if helpful), ordered by `created_at DESC`.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "appointments": [
      {
        "id": 10,
        "user_id": 2,
        "patient_name": "Sara Ahmed",
        "department": "Cardiology",
        "appointment_date": "2026-12-01T10:30:00Z",
        "medical_notes": "Mild chest tightness during brisk walking for 3 days.",
        "status": "cancelled",
        "created_at": "2026-11-24T14:35:00Z",
        "updated_at": "2026-11-24T14:40:00Z"
      }
    ]
  }
}
```

**Error Responses:** `401 Unauthorized`, `403 Forbidden`.

```bash
curl -vk -b admin_cookies.txt https://192.168.67.10/api/v1/admin/appointments
```

---

#### `PATCH /api/v1/admin/appointments/{id}/status`
- **Auth:** `admin` only

**Request Body:**
```json
{
  "status": "confirmed"
}
```
- `status`: must be one of `scheduled`, `confirmed`, `completed`, `cancelled`.

**Response `200 OK`:** Returns updated Appointment object in `{ "status": "ok", "data": { ... } }`.

**Error Responses:** `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

```bash
curl -vk -b admin_cookies.txt -X PATCH https://192.168.67.10/api/v1/admin/appointments/10/status \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'
```

---

#### `DELETE /api/v1/admin/appointments/{id}`
- **Auth:** `admin` only
- **Behavior:** Permanently deletes the appointment **only if `status == "cancelled"`**. If the appointment is still `scheduled`, `confirmed`, or `completed`, returns `400 Bad Request` (`APPOINTMENT_NOT_CANCELLED`).

**Response `200 OK`:**
```json
{
  "status": "ok",
  "data": {
    "deleted_id": 10,
    "message": "Cancelled appointment deleted."
  }
}
```

**Error Responses:** `400 Bad Request` (`APPOINTMENT_NOT_CANCELLED`), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

```bash
curl -vk -b admin_cookies.txt -X DELETE https://192.168.67.10/api/v1/admin/appointments/10
```

---

## 5. Verification `curl` Snippets for Report Evidence

### Rate Limit Loop (`429 Too Many Requests` — Part 3)
```bash
for i in $(seq 1 10); do
  printf "Attempt %02d -> HTTP " "$i"
  curl -sk -o /dev/null -w "%{http_code}\n" \
    -X POST https://192.168.67.10/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@example.com","password":"wrongpassword"}'
done
```

### RBAC (`401` vs. `403`) Verification (Part 3)
```bash
# Unauthenticated -> 401
curl -sk -i https://192.168.67.10/api/v1/admin/appointments

# Authenticated patient -> 403
curl -sk -i -b cookies.txt https://192.168.67.10/api/v1/admin/appointments
```

### ModSecurity WAF SQLi Probe (`403 Forbidden` — Bonus 2)
```bash
curl -vk "https://192.168.67.10/api/v1/appointments?q=%27%20OR%201%3D1%20--"
```
