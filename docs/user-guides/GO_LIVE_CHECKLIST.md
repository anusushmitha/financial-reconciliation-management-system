# LENDGUARD AI — Production Go-Live Checklist & Cutover Plan

**Document Reference:** `docs/user-guides/GO_LIVE_CHECKLIST.md`  
**Classification:** DevOps & Release Management  
**Target Release:** v2.0-GA  

---

## 1. Pre-Deployment Verification Checklist (T - 24 Hours)

- [x] **Database Schema & Migrations:**
  - [x] Initial schema `001_initial_schema.sql` applied.
  - [x] Database immutability triggers `002_immutability_triggers.sql` applied and tested.
  - [x] Database user permissions restricted (read/write on application tables; no DDL in production).
- [x] **Production Secret Injection:**
  - [x] Production `JWT_SECRET` injected (minimum 512 bits entropy).
  - [x] Production `AI_SERVICE_KEY` configured in both Web API and AI service.
  - [x] Production database connection string configured with SSL enabled.
- [x] **Persistent Storage:**
  - [x] Persistent volume mounted at `storage/` with read/write permissions for container UID.
  - [x] Maximum upload size threshold verified (25MB).
- [x] **SSL / TLS Certificates:**
  - [x] Valid TLS 1.3 certificate installed on reverse proxy / ingress.
  - [x] HTTP to HTTPS redirection active.

---

## 2. Cutover & Deployment Execution Checklist (T - 0)

- [x] **Container Deployment:**
  - [x] Start PostgreSQL 16 cluster.
  - [x] Start Python FastAPI AI microservice (`http://localhost:8000`).
  - [x] Start ASP.NET Core Web API (`http://localhost:5000`).
  - [x] Start C# Background Worker.
  - [x] Start Nginx / React 18 frontend (`http://localhost:5173`).
- [x] **Liveness & Health Probe Validation:**
  - [x] `GET /health` returns `200 OK` (Healthy).
  - [x] `GET /internal/v1/health` returns `200 OK` (Healthy).
  - [x] Worker log confirms active polling for pending jobs with `FOR UPDATE SKIP LOCKED`.

---

## 3. Post-Deployment Smoke Verification (T + 1 Hour)

- [x] **Administrative Smoke Test:**
  - [x] Administrator login with corporate credentials.
  - [x] Verify `/dashboard` metrics render cleanly.
  - [x] Verify `/users` and `/audit-logs` render without errors.
- [x] **Reconciliation Golden Dataset Smoke Test:**
  - [x] Ingest sample internal and external CSV datasets via `/imports`.
  - [x] Confirm batch and execute reconciliation run.
  - [x] Verify matches and exceptions populate the queue.
- [x] **Analyst Access Verification:**
  - [x] Analyst login with analyst credentials.
  - [x] Verify analyst can view and investigate assigned exceptions.
  - [x] Verify analyst is blocked from `/users` and `/audit-logs` (HTTP 403 / redirect).
- [x] **Backup System Verification:**
  - [x] Scheduled backup job confirmed active.
  - [x] Disaster recovery runbook verified.

---

## 4. Rollback Plan

If unexpected catastrophic failures occur during cutover:
1. Revert container tags in `docker-compose.yml` to previous stable release image.
2. If database schema was altered, restore the pre-cutover logical backup via `scripts/restore/restore.ps1`.
3. Restart containers and run `/health` verification.
4. Notify the incident commander and technical steering committee.
