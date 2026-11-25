# LENDGUARD AI — PRODUCTION CUTOVER CHECKLIST

**Release Version:** `v1.0.0-rc.1`  
**Cutover Window:** Planned 60-Minute Maintenance Window  
**Target Architecture:** .NET 10 LTS, Python FastAPI, PostgreSQL 16 (HA Cluster)  
**Governance Standard:** Financial Services Change Advisory Board (CAB) Tier-1  

---

## 1. Pre-Cutover Readiness Gates (T-7 Days to T-24 Hours)

| # | Item Description | Verification Evidence | Owner | Sign-Off |
| :-: | :--- | :--- | :--- | :-: |
| **G1** | **CAB Approval** | Formal Change Request approved with zero open objections | Release Mgr | [ ] |
| **G2** | **Legal & Partner Boundary** | Banking settlement partner agreements & SFTP credentials verified | Legal / Ops | [ ] |
| **G3** | **.NET 10 Container Sign-off** | Container images built on official .NET 10 LTS base (`10.0-aspnet`) | Security | [ ] |
| **G4** | **Zero Vulnerability Audit** | `dotnet list package --vulnerable` & `npm audit` 0 high/critical | Security | [ ] |
| **G5** | **Cloud KMS Secret Setup** | JWT secret, DB credentials, and AI service keys provisioned in Vault | Cloud Eng | [ ] |
| **G6** | **Disaster Recovery Certified** | Cold backup and restore executed in < 3s with 100% SHA256 match | DBA | [ ] |
| **G7** | **Seed User Lockout** | `SEED_TEST_USERS=false` verified in production Helm / Compose files | Lead Dev | [ ] |
| **G8** | **Immutability Triggers Active** | `002_immutability_triggers.sql` tested on staging database | DBA | [ ] |

---

## 2. Cutover Timeline & Execution Schedule

### Phase 1: Pre-Cutover Preparation (T-60m to T-15m)
- [ ] **T-60m:** Convene Bridge Call (Incident Commander, Lead Dev, DBA, QA Lead, Infosec).
- [ ] **T-45m:** Notify operational users and post maintenance announcement banner on frontend.
- [ ] **T-30m:** Verify that all pending background jobs in `background_jobs` table have reached `COMPLETED` state:
  ```sql
  SELECT count(*) FROM background_jobs WHERE status IN ('PENDING', 'PROCESSING');
  -- Must return 0 before proceeding.
  ```
- [ ] **T-15m:** Terminate public ingress to old backend API instances (HTTP 503 Maintenance Page).

### Phase 2: Database Migration & Backup Freeze (T-15m to T-0)
- [ ] **T-15m:** Take full pre-cutover atomic snapshot of PostgreSQL database and storage directory:
  ```powershell
  ./scripts/backup/backup.ps1 -Database lendguard_prod -StorageDir /var/lendguard/storage -BackupDir /var/lendguard/backups
  ```
- [ ] **T-10m:** Verify backup archive integrity and confirm SHA256 checksums.
- [ ] **T-5m:** Apply production SQL migrations (`001_initial_schema.sql` and `002_immutability_triggers.sql`).
- [ ] **T-2m:** Confirm exactly 13 production tables exist and immutability triggers are enabled.

### Phase 3: Application Rollout & Verification (T-0 to T+30m)
- [ ] **T+0:** Deploy .NET 10 API and Worker container images (`v1.0.0-rc.1`).
- [ ] **T+5m:** Deploy Python AI microservice container image.
- [ ] **T+10m:** Deploy static React frontend production bundle to CDN / Nginx ingress.
- [ ] **T+15m:** Execute internal health checks:
  ```bash
  curl -f https://internal-api.lendguard.company.com/health
  # Must return: {"status":"Healthy"}
  ```
- [ ] **T+20m:** Authenticate with initial bootstrap admin account; verify JWT token issuance.
- [ ] **T+25m:** Execute synthetic smoke reconciliation run using golden test pair:
  - Verify exact match identification.
  - Verify amount mismatch exception generation.
  - Verify audit log record creation.

### Phase 4: Public Ingress Activation & Go-Live (T+30m to T+60m)
- [ ] **T+30m:** **GO / NO-GO DECISION GATE** (See Section 3).
- [ ] **T+35m:** Re-enable production ingress traffic and remove maintenance banner.
- [ ] **T+45m:** Monitor application metrics for 15 minutes (RPS, 5xx rate, CPU/Memory).
- [ ] **T+60m:** Formal cutover complete; sign off bridge call.

---

## 3. Go / No-Go Decision Gate Matrix

At **T+30m**, all stakeholders must cast an explicit vote based on the following criteria:

| Gate | Assessment Criteria | Required State | Actual State | Vote |
| :--- | :--- | :---: | :---: | :---: |
| **Gate 1** | API Health Endpoint | `HTTP 200 Healthy` | | GO / NO-GO |
| **Gate 2** | Background Worker Loop | `Processing & Polling` | | GO / NO-GO |
| **Gate 3** | Database Schema & Triggers | `13 Tables + Immutability` | | GO / NO-GO |
| **Gate 4** | Zero Decimal Drift | `100% Strict Numeric(18,2)` | | GO / NO-GO |
| **Gate 5** | Authentication & RBAC | `Analyst Isolation Enforced` | | GO / NO-GO |
| **Gate 6** | Backup & Recovery SLA | `RTO < 1h, RPO = 0` | | GO / NO-GO |

*Rule:* A single NO-GO on any gate triggers an immediate abort and rollback.

---

## 4. Post-Cutover Operational Sign-Off

- **Lead Software Architect:** ___________________________ Date: ____________
- **Lead DevOps Engineer:** ___________________________ Date: ____________
- **Database Administrator:** ___________________________ Date: ____________
- **Head of Financial Operations:** ___________________________ Date: ____________
