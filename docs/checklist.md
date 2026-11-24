# Partner Progress & Submission Checklist

**Project:** Clinic Patient Appointment & Intake Portal (`192.168.67.0/24`)  
**Partner A:** Abdullah Saeed (`BSCS25067` — Frontend / VM1)  
**Partner B:** Muhammad Aashir Khan (`BSCS25079` — Backend / VM2)

---

## 0. Non-Negotiable Ground Rules Audit (Check Continuously!)

- [ ] **Hostnames set & visible in EVERY terminal screenshot:** `bscs25067-web`, `bscs25067-api`, `bscs25067-docker` (`sudo hostnamectl set-hostname <name>`).
- [ ] **JWT in cookies ONLY:** `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax` (zero `localStorage`, zero `Authorization: Bearer`).
- [ ] **PostgreSQL from Part 2 onward:** No SQLite on VM2 or Docker; VM2 PostgreSQL bound strictly to `127.0.0.1:5432`.
- [ ] **Zero real secrets in Git, ZIP, or PDF:** `.env`, `*.key`, `*.crt`, `node_modules/`, `.venv/` ignored; only `.env.example` committed.
- [ ] **Regular Git commits from BOTH partners** under their own Git accounts.
- [ ] **UFW disabled on VM3 (`bscs25067-docker`).**
- [ ] **Health endpoint IP accurate:** Reads `LAB_IP` from `.env` or lab NIC (never `127.0.1.1`).

---

## Phase 1: Full-Stack Application Development (Part 1)

### Abdullah Saeed (`BSCS25067` — Frontend)
- [ ] Scaffold React + Vite app in `frontend/` with relative `/api/v1/...` proxy for local dev.
- [ ] Implement `src/api/client.js` using `fetch(..., { credentials: "include" })`.
- [ ] Implement `src/context/AuthContext.jsx` hydrating state via `GET /api/v1/auth/me`.
- [ ] Build `/register` page (Patient sign-up form + validation errors).
- [ ] Build `/login` page (clearly renders `401 Invalid credentials` and `429 Too many attempts`).
- [ ] Build `/change-password` page (current + new password form).
- [ ] Build `/appointments` page (4-field Intake Form + user's bookings list with Reschedule & Cancel actions).
- [ ] Build `/admin` portal (all patients' appointments, status dropdown, Delete button for `cancelled` records).
- [ ] Verify clean production build (`npm run build` outputs `dist/`).

### Muhammad Aashir Khan (`BSCS25079` — Backend & DB)
- [ ] Scaffold FastAPI project in `backend/` (`main.py`, `config.py`, `database.py`, `models.py`, `schemas.py`, `security.py`, `deps.py`, `routers/`).
- [ ] Define SQLAlchemy 2.x ORM models (`users`, `appointments`) — zero raw string-concatenated SQL.
- [ ] Implement Argon2id password hashing (`argon2-cffi`) and AES-256-GCM field encryption (fresh 12-byte `os.urandom(12)` nonce per write).
- [ ] Implement HS256 JWT (`30m` expiry) issued in `access_token` (`HttpOnly; Secure; SameSite=Lax`) cookie + RBAC dependencies (`401`/`403`).
- [ ] Implement strict Pydantic v2 schemas + global error handler returning `400` in unified JSON envelope.
- [ ] Implement all 13 endpoints matching [api-contract.md](./api-contract.md) (including `/api/v1/health` with `LAB_IP`).
- [ ] Implement `backend/scripts/seed_admin.py` reading `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.
- [ ] Create `backend/.env.example` with placeholders only.

### Phase 1 Joint Milestone
- [ ] Full app runs end-to-end locally against PostgreSQL; all status codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`) verified.

---

## Phase 2: Two-VM Deployment on VMware (Part 2)

### Abdullah Saeed (`BSCS25067` — VM1: `bscs25067-web`, `192.168.67.10`)
- [ ] Configure VMware Host-Only network (`192.168.67.0/24`, DHCP unticked, host = `.1`).
- [ ] Provision Ubuntu Server VM1 with 2 NICs (NAT + Host-Only) and hostname `bscs25067-web`.
- [ ] Configure Netplan static IP `192.168.67.10/24` (no gateway; disable cloud-init network reset if needed).
- [ ] Add `192.168.67.20 api.lab.local` to `/etc/hosts`.
- [ ] Deploy React `dist/` to `/var/www/app/` via `scp`.
- [ ] Configure Nginx serving `/var/www/app/` and proxying `/api/` to `http://api.lab.local:8000` (not raw IP).

### Muhammad Aashir Khan (`BSCS25079` — VM2: `bscs25067-api`, `192.168.67.20`)
- [ ] Provision Ubuntu Server VM2 with 2 NICs (NAT + Host-Only) and hostname `bscs25067-api`.
- [ ] Configure Netplan static IP `192.168.67.20/24` (no gateway).
- [ ] Configure PostgreSQL: `listen_addresses = 'localhost'`, `scram-sha-256` for `127.0.0.1/32`, dedicated least-privilege DB user `clinic_app`.
- [ ] Deploy FastAPI + run `seed_admin.py` and configure `clinic-api.service` (`systemd`) listening on `192.168.67.20:8000` with `--proxy-headers --forwarded-allow-ips="192.168.67.10,172.16.0.0/12"`.

### Phase 2 Joint Milestone (Capture Plain-HTTP VM1→VM2 Evidence!)
- [ ] Capture `ip addr`, `ip route`, `ip neigh`, bidirectional `ping`, `ss -tulnp` on VM1 & VM2.
- [ ] Verify `GET /api/v1/health` through VM1 returns `hostname: "bscs25067-api"`, `ip: "192.168.67.20"`, `db_reachable: true`.

---

## Phase 3: TLS, Login Rate Limiting & UFW Hardening (Parts 3–4)

### Abdullah Saeed (`BSCS25067` — VM1 TLS, Rate Limit & UFW)
- [ ] Generate OpenSSL self-signed cert `/etc/ssl/lab/web.crt` & `web.key` (`chmod 600`) with `CN=bscs25067-web` and `SAN=DNS:bscs25067-web,IP:192.168.67.10`.
- [ ] Configure Nginx `TLSv1.2 TLSv1.3` on `:443` and Port `80 → 301` HTTPS redirect.
- [ ] Configure login rate limit (`rate=5r/m`, `burst=3 nodelay`, `429`) on `location = /api/v1/auth/login`.
- [ ] Configure VM1 UFW (allow `22/tcp` from `.1`, `443/tcp` anywhere, `80/tcp` anywhere; default deny incoming).
- [ ] Save sanitized Nginx & UFW outputs to `infra/nginx/vm1-lab.conf` and `infra/ufw/`.

### Muhammad Aashir Khan (`BSCS25079` — VM2 UFW, Nmap & Crypto Proof)
- [ ] Configure VM2 UFW (allow `22/tcp` from `.1`, `8000/tcp` from `.10` ONLY; NO rule for `5432/tcp`; default deny incoming).
- [ ] Run `nmap -Pn -p 22,80,443,8000,5432` **before and after** UFW from Host PC (`.1`) and VM3 (`.30`) and record results table.
- [ ] Capture raw PostgreSQL row (`password_hash` + `medical_notes_enc`) next to decrypted API JSON response.
- [ ] Capture `Set-Cookie` flags (`HttpOnly`, `Secure`, `SameSite=Lax`) in `curl -v` & Browser DevTools + decoded JWT payload.
- [ ] Save VM2 UFW output to `infra/ufw/`.

### Phase 3 Joint Milestone
- [ ] Screenshot `curl -vk`, `openssl s_client`, `curl -v --cacert`, `429` loop + matching Nginx logs, `401`/`403` vs. firewall block comparison, and all Part 2–4 plain-HTTP VM1→VM2 screenshots **BEFORE starting Bonus tasks**.

---

## Phase 4: Docker Deployment on VM3 (Part 5)

### Abdullah Saeed (`BSCS25067` — VM3 Setup, Web Container & Inspection)
- [ ] Provision VM3 (`bscs25067-docker`, `192.168.67.30/24`, **UFW DISABLED**) with Docker Engine.
- [ ] Generate VM3 self-signed cert (`CN=bscs25067-docker`, `SAN=DNS:bscs25067-docker,IP:192.168.67.30`).
- [ ] Create `infra/nginx/docker-nginx.conf` serving compiled React `dist/` with TLS 1.2/1.3 + `429` login rate limit, proxying `/api/` to `http://api:8000`.
- [ ] Capture `docker network ls`, `docker network inspect lab-net`, `docker exec <web> getent hosts api`, `docker exec <web> getent hosts db`, `ip addr show`, `sudo iptables -t nat -L -n -v`.

### Muhammad Aashir Khan (`BSCS25079` — API Dockerfile, Compose & Tests)
- [ ] Create `backend/Dockerfile` (runs purely from image — zero host source bind-mount).
- [ ] Create `docker-compose.yml` (`web` publishing `443:443` only, `depends_on: [api]`; `api` no published ports; `db` `postgres:16-alpine` with `pgdata:/var/lib/postgresql/data`, no published ports; fixed network `name: lab-net`).
- [ ] Verify DB persistence across container restarts (`docker compose down && docker compose up -d`).
- [ ] Capture port-isolation proof (`nc -vz` / `nmap` showing `8000` & `5432` closed on `.30`) and repeat Part 1 login / rate-limit / `401` / `403` tests.

### Phase 4 Joint Milestone
- [ ] Docker stack passes all functional & security tests; VM vs. Docker comparison table completed.

---

## Phase 5: Break & Fix Troubleshooting (Part 6)

> Inject faults secretly from the **VMware console** (never over SSH), one at a time, while the other partner looks away.

### Fault Pool Reference (Pick 3 Distinct Faults Each)
1. Bind FastAPI to `127.0.0.1` instead of `192.168.67.20`.
2. Wrong DB user/host or wrong DB password (`/api/v1/health` reports `db_reachable: false`).
3. Wrong subnet mask on a VM's lab NIC (e.g., `/30` instead of `/24`).
4. UFW rule with wrong source IP, or a `deny` rule placed before an `allow` rule.
5. Certificate CN/SAN mismatch (fails `curl -v --cacert` without `-k`).
6. Wrong port in Nginx `proxy_pass`, or stopped `clinic-api` systemd service.
7. Login rate limit set too strict, or changed `JWT_SECRET` so existing tokens fail with `401`.

### 6-Fault Break-and-Fix Log

| # | Injected By | Diagnosed & Fixed By | Fault Description | Observed Symptoms | Tools Used (Layer Order) | Root Cause & Fix | Time Taken | Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | Abdullah | Aashir | *(TBD)* | | | | | [ ] |
| 2 | Abdullah | Aashir | *(TBD)* | | | | | [ ] |
| 3 | Abdullah | Aashir | *(TBD)* | | | | | [ ] |
| 4 | Aashir | Abdullah | *(TBD)* | | | | | [ ] |
| 5 | Aashir | Abdullah | *(TBD)* | | | | | [ ] |
| 6 | Aashir | Abdullah | *(TBD)* | | | | | [ ] |

---

## Phase 6: Bonus Tasks & Final Submission

> [!IMPORTANT]
> Start Bonus 1 & Bonus 2 **only after** all screenshots for Parts 2, 3, and 4 are finalized!

### Bonus 1: End-to-End TLS on VM1 → VM2 Hop
- [ ] **Aashir (VM2):** Capture "Before" plaintext `tcpdump -i <lab-iface> -A -s 0 port 8000` while Abdullah hits `https://192.168.67.10/api/v1/health`.
- [ ] **Aashir (VM2):** Generate `/etc/ssl/lab/api.key` (`chmod 600`) & `/etc/ssl/lab/api.crt` (`CN=api.lab.local`, `SAN=DNS:api.lab.local,IP:192.168.67.20`) and enable `--ssl-keyfile` / `--ssl-certfile` in `clinic-api.service`.
- [ ] **Abdullah (VM1):** Copy `api.crt` to VM1, switch `proxy_pass` to `https://api.lab.local:8000;`, enable `proxy_ssl_trusted_certificate`, `proxy_ssl_verify on`, `proxy_ssl_verify_depth 1`, `proxy_ssl_server_name on`, `proxy_ssl_protocols TLSv1.2 TLSv1.3;`, reload Nginx, save to `infra/nginx/vm1-lab-bonus.conf`.
- [ ] **Both:** Re-run identical `tcpdump` capture on VM2 and screenshot unreadable encrypted TLS frames.

### Bonus 2: ModSecurity + OWASP CRS on VM1 Nginx
- [ ] **Abdullah (VM1):** Install `libmodsecurity3` + Nginx ModSecurity connector + OWASP CRS; enable `modsecurity on;` and `SecRuleEngine On`.
- [ ] **Aashir (Client) + Abdullah (VM1 Logs):** Send `curl -vk "https://192.168.67.10/api/v1/appointments?q=%27%20OR%201%3D1%20--"`; screenshot `403 Forbidden` response + matching ModSecurity audit/error log entry with triggered OWASP CRS rule ID.

---

## Final Submission & Viva Readiness

### PDF Report (`Project01_BSCS25067_BSCS25079.pdf`)
- [ ] Every terminal screenshot clearly shows `bscs25067-web`, `bscs25067-api`, or `bscs25067-docker`.
- [ ] Addressing table + `ip addr`, `ip route`, `ip neigh`, `ping`, `ss -tulnp` + Part 2 written answers.
- [ ] REST API `curl -v` + Nginx/FastAPI logs + `401`/`403` vs. firewall block comparison.
- [ ] Cookie flags (`Secure`, `HttpOnly`, `SameSite`) in `curl -v` & DevTools + decoded JWT + note on signed vs. encrypted.
- [ ] Raw PostgreSQL row (`password_hash` + `medical_notes_enc`) next to decrypted API JSON response.
- [ ] Login rate-limit `curl` loop showing `429` + matching Nginx log lines.
- [ ] TLS verification (`curl -vk`, `openssl s_client`, `curl -v --cacert`) + Part 3 written answers.
- [ ] `ufw status verbose` & `numbered` (both VMs) + before/after `nmap` test table + Part 4 written answers.
- [ ] Docker inspection (`network ls/inspect`, `getent hosts`, `ip addr`, `iptables -t nat`) + VM vs. Docker table + Part 5 written answers.
- [ ] Break-and-Fix table (6 faults, who injected/fixed, time taken, tool order).
- [ ] Bonus 1 (VM1→VM2 TLS config + before/after `tcpdump`) & Bonus 2 (ModSecurity + OWASP CRS blocking `' OR 1=1 --`).
- [ ] Shared Git repo link + individual contribution statements for Abdullah Saeed (`BSCS25067`) and Muhammad Aashir Khan (`BSCS25079`).

### ZIP Archive (`Project01_BSCS25067_BSCS25079.zip`)
- [ ] Contains frontend & backend source code (**NO** `.env`, **NO** `*.key`, **NO** `node_modules/`, **NO** `.venv/`).
- [ ] Contains Nginx configs, `Dockerfile`, `docker-compose.yml`, and saved `ufw status` outputs from VM1 & VM2.

### Viva Readiness (30-Minute Partner Walkthrough)
- [ ] Both Abdullah and Aashir can explain every Nginx block, UFW rule, SQLAlchemy query, Argon2id/AES-GCM flow, JWT cookie flag, and Docker NAT rule.
- [ ] Both can perform a live change in the lab (e.g., `sudo ufw allow from <IP> to any port <P> proto tcp`).
