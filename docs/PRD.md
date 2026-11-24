# Product Requirements Document (PRD)

**Project:** Clinic Patient Appointment & Intake Portal  
**Course:** Data Communication & Computer Networks Lab — Department of Computer Science, ITU  
**Team:**
- **Partner A (Frontend / VM1):** Abdullah Saeed (`BSCS25067`)
- **Partner B (Backend / VM2):** Muhammad Aashir Khan (`BSCS25079`)

**Deliverables:** `Project01_BSCS25067_BSCS25079.pdf` & `Project01_BSCS25067_BSCS25079.zip`

---

## 1. Executive Summary & Problem Statement

The **Clinic Patient Appointment & Intake Portal** is a full-stack web application that collects and manages sensitive patient appointment bookings, symptoms, and medical notes (Personal Health Information / PHI).

Because medical intake records are highly sensitive, the product is designed around **defense-in-depth** across every layer of the stack:
- **Transport security:** TLS 1.2/1.3 termination at the edge (and end-to-end TLS to the API in Bonus 1).
- **Session security:** Signed JWTs delivered strictly via `HttpOnly; Secure; SameSite=Lax` cookies.
- **Access control:** Role-Based Access Control (RBAC) separating `user` (Patient) and `admin` (Clinic Staff) capabilities.
- **Data-at-rest security:** Argon2id password hashing and AES-256-GCM field-level encryption for medical notes.
- **Network & host hardening:** Least-privilege UFW firewalling on VMs, login rate limiting (`429`), ModSecurity WAF + OWASP CRS (Bonus 2), and isolated Docker bridge networking.

---

## 2. Target Users & Roles

| Role | Identifier | Description | Provisioning |
| :--- | :--- | :--- | :--- |
| **Patient** | `user` | Clinic patients registering, logging in, submitting 4-field appointment intake forms, and managing their own bookings. | Self-service via `POST /api/v1/auth/register` (always assigns `role = 'user'`). |
| **Clinic Staff** | `admin` | Authorized clinic staff viewing all patients' appointments, updating appointment lifecycle statuses, and cleaning up cancelled records. | Provisioned securely via `backend/scripts/seed_admin.py` using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. |

---

## 3. Functional Requirements

### 3.1 Feature & Role Matrix

| ID | Feature | `user` (Patient) | `admin` (Clinic Staff) |
| :--- | :--- | :---: | :---: |
| FR-01 | Register a new patient account | Yes | Yes |
| FR-02 | Log in (cookie-based JWT session, rate-limited) | Yes | Yes |
| FR-03 | Log out (clear auth cookie) | Yes | Yes |
| FR-04 | Change own password (verify current password first) | Yes | Yes |
| FR-05 | Fetch current authenticated user & role (`GET /api/v1/auth/me`) | Yes | Yes |
| FR-06 | Book a new appointment via 4-field intake form | Yes | Yes |
| FR-07 | View own appointments with decrypted `medical_notes` | Yes | Yes |
| FR-08 | View single appointment details (owner or admin) | Own only (`403` others) | All |
| FR-09 | Reschedule (`appointment_date`, `department`, `medical_notes`) or cancel (`status: "cancelled"`) own appointment | Own only (`403` others) | Own only via patient route |
| FR-10 | View **all** clinic appointments across all patients | `403 Forbidden` | Yes |
| FR-11 | Update any appointment's status (`scheduled` / `confirmed` / `completed` / `cancelled`) | `403 Forbidden` | Yes |
| FR-12 | Delete cancelled appointment records (rejected with `400` if status ≠ `cancelled`) | `403 Forbidden` | Yes |
| FR-13 | Public health check exposing `{ hostname, ip, db_reachable }` | Public | Public |

### 3.2 Intake Form Fields & Validation Rules

| Field | Key | Validation & Constraints |
| :--- | :--- | :--- |
| **Form Field 1 — Patient Name** | `patient_name` | Required string, 2–120 characters, trimmed. |
| **Form Field 2 — Department** | `department` | Required fixed enum: `Cardiology`, `General Medicine`, `Orthopedics`, `Pediatrics`, `Dermatology`, `Neurology`. |
| **Form Field 3 — Appointment Date** | `appointment_date` | Required ISO 8601 timestamp with timezone (`TIMESTAMPTZ`). |
| **Form Field 4 — Medical Notes / Symptoms** | `medical_notes` | Required non-empty string (1–4000 chars); encrypted at rest with AES-256-GCM before DB storage. |

### 3.3 Appointment Status Lifecycle

- Valid statuses: `scheduled` (default on creation), `confirmed`, `completed`, `cancelled`.
- Patients may transition their own non-completed appointment to `cancelled` via `PATCH /api/v1/appointments/{id}`.
- Admins may set any valid status via `PATCH /api/v1/admin/appointments/{id}/status`.
- Deletion (`DELETE /api/v1/admin/appointments/{id}`) is permitted **only** when `status == "cancelled"`; attempting to delete an active appointment returns `400 Bad Request`.

### 3.4 Required Frontend Pages (React + Vite)

| Route | Access | Required UI Capabilities |
| :--- | :--- | :--- |
| `/register` | Public | Patient sign-up form (`full_name`, `email`, `password`), inline validation error display. |
| `/login` | Public | Email/password login form; clearly distinguishes `401 Invalid credentials` and `429 Too many attempts`. |
| `/change-password` | Authenticated | Current password + new password form with confirmation and success/error feedback. |
| `/appointments` | Authenticated | 4-field Patient Intake Form + list of current user's booked appointments with **Reschedule** and **Cancel** actions. |
| `/admin` | `admin` only | Clinic staff dashboard showing all patients' appointments, status dropdown (`scheduled` / `confirmed` / `completed` / `cancelled`), and **Delete** button enabled for cancelled records. Backend strictly enforces `403` for non-admins. |

---

## 4. Non-Functional & Security Requirements

### 4.1 Security Requirements

| Category | Requirement |
| :--- | :--- |
| **Password Hashing** | `argon2-cffi` (`PasswordHasher()`), Argon2id with automatic per-user salt. Plaintext passwords are never logged or stored. |
| **Field Encryption at Rest** | AES-256-GCM (`cryptography.hazmat.primitives.ciphers.aead.AESGCM`) using a 32-byte base64 `ENCRYPTION_KEY` from `.env`, with a fresh 12-byte `os.urandom(12)` nonce per insert/update. |
| **Session Management** | HS256-signed JWT (`sub`, `role`, `iat`, `exp`) with 30-minute expiry stored strictly in `access_token` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`). Zero use of `localStorage` or `Authorization: Bearer`. |
| **SQL Injection Prevention** | SQLAlchemy 2.x ORM parameterized queries exclusively — zero raw string-concatenated SQL. |
| **Input Validation** | Strict Pydantic v2 schemas returning `400 Bad Request` in the unified JSON error envelope on validation failure. |
| **Abuse Protection** | Nginx login rate limit (`5r/m`, `burst=3 nodelay`, HTTP `429`) on `/api/v1/auth/login`. |
| **WAF (Bonus 2)** | ModSecurity + OWASP Core Rule Set (`SecRuleEngine On`) on VM1 Nginx blocking SQLi probes with `403 Forbidden` before reaching FastAPI. |
| **Transport Security** | TLS 1.2/1.3 on VM1 and VM3 (`Port 80 → 301 HTTPS`). End-to-end TLS with upstream cert verification on VM1 → VM2 in Bonus 1. |

### 4.2 Non-Negotiable Lab Ground Rules

> [!CAUTION]
> Violating any rule below forfeits full marks on the affected lab section.

1. **Hostnames visible in EVERY terminal screenshot:** Prompts must display `bscs25067-web`, `bscs25067-api`, or `bscs25067-docker` (set via `sudo hostnamectl set-hostname <name>`).
2. **JWT in cookies ONLY:** Never store JWT in `localStorage` or send `Authorization: Bearer`.
3. **PostgreSQL from Part 2 onward:** Never use SQLite on VM2 or Docker. On VM2, PostgreSQL must listen on `127.0.0.1` only.
4. **Zero real secrets in Git, ZIP, or PDF:** Commit `.env.example` with placeholders (`<DB_PASSWORD>`, etc.); exclude `.env`, `*.key`, `*.crt`, `node_modules`, and `.venv`.
5. **One shared Git repository with commits from BOTH partners:** Regular commits from both Abdullah and Aashir under their own Git accounts.
6. **Do NOT enable UFW on `bscs25067-docker`:** Docker's published-port `iptables` rules bypass UFW.
7. **Health endpoint IP accuracy:** Never use `socket.gethostbyname(socket.gethostname())` (resolves to `127.0.1.1` on Ubuntu); read `LAB_IP` from `.env` or inspect the lab NIC.

---

## 5. Project Milestones & Acceptance Criteria

| Phase | Scope | Acceptance Criteria |
| :--- | :--- | :--- |
| **Phase 1 (Part 1)** | Full-Stack App Dev | Local React + FastAPI + PostgreSQL works end-to-end; all status codes (`200/201/400/401/403/404/500`) verified; admin seed script works. |
| **Phase 2 (Part 2)** | 2-VM Deployment | VM1 (`bscs25067-web`, `.10`) & VM2 (`bscs25067-api`, `.20`) configured on `192.168.67.0/24`; `ip addr/route/neigh`, bidirectional `ping`, `ss -tulnp`, and `/api/v1/health` through VM1 verified. |
| **Phase 3 (Parts 3–4)** | TLS, Rate Limit & UFW | OpenSSL CN+SAN cert, `80 → 301`, `429` loop, UFW on VM1 & VM2, before/after `nmap`, DB raw-row vs. decrypted API proof, and JWT cookie evidence captured. |
| **Phase 4 (Part 5)** | Docker on VM3 | `bscs25067-docker` (`.30`, no UFW) running `web`, `api`, `db` on `lab-net` with `pgdata` volume; only `443:443` published; Part 1 tests + Docker/iptables inspections complete. |
| **Phase 5 (Part 6)** | Break & Fix | 6 total faults (3 per partner via VMware console) diagnosed layer-by-layer and documented with symptoms, tools, root cause, fix, and time. |
| **Phase 6 (Bonus & Report)** | Bonus 1 & 2 + Submission | VM1→VM2 TLS (`tcpdump` before/after) + ModSecurity CRS SQLi block (`403`) implemented **after** Parts 2–4 screenshots; final PDF & ZIP verified secret-free; viva dry-run complete. |

---

## 6. Related Documentation

- [Technical Design Document](./design-doc.md) — Architecture, networking, TLS, UFW, Docker, and Bonus designs
- [Database Schema Tables](./Table.md) & [ER Diagram](./schema.svg) — PostgreSQL schema & crypto storage layout
- [REST API Contract](./api-contract.md) — Endpoint specifications, schemas, status codes, and `curl` examples
- [Partner Progress Checklist](./checklist.md) — Phase-by-phase tracker for Abdullah & Aashir
