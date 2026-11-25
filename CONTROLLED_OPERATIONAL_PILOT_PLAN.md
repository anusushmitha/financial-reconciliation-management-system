# LENDGUARD AI — Controlled Operational Pilot Plan
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Git Commit Hash:** `5c440ae` (Release Candidate Base: `3b5aab3d7d3166da7ded313d65f02482fe5d86d1`)  
**Target Environment:** Staging Deployment (`lendguard_staging` DB, Port 5000 API, Port 8000 AI)  
**Execution Phase:** Controlled Operational Pilot Execution  
**Document Classification:** Confidential — FinTech Operational Pilot Governance  

---

## 1. Executive Summary & Governance Charter

This Controlled Operational Pilot Plan establishes the operational boundaries, governance protocols, testing procedures, and verification checkpoints for the operational evaluation of **LendGuard AI v1.0.0-rc.1**.

The platform has completed development, independent engineering audits, .NET 10 LTS LTS runtime migration, and comprehensive staging deployment verification. The objective of this pilot is to evaluate LendGuard AI in a controlled, production-mirrored staging runtime under realistic daily operating conditions using synthetic, non-production financial transaction datasets.

### 1.1 Non-Negotiable Operational Guardrails
> [!CAUTION]
> **STRICT OPERATIONAL RESTRICTIONS DURING PILOT:**
> 1. **Zero Real Banking Connectivity:** Direct integration with live SWIFT, ACH, Fedwire, or external core banking production APIs is **STRICTLY PROHIBITED** without written authorization from the Chief Information Security Officer (CISO) and Executive Management.
> 2. **Zero Live Customer PII:** Only synthetic or formally approved masked transaction datasets shall be ingested. No real borrower names, national identifiers, or live account numbers are permitted.
> 3. **Zero Financial Money Movement:** The platform shall not initiate, modify, or settle real monetary balances.
> 4. **Zero Autonomous AI Mutations:** The AI microservice functions solely in an advisory, explainability role. The AI has **zero write permissions** to financial transaction records or ledger balances.
> 5. **Human Decision Authority:** All financial exception resolutions require explicit human review, categorization, and justification by an authorized operational analyst.

---

## 2. Phase 1 — Staging Baseline Verification & Readiness Assessment

Prior to initiating pilot scenario execution, an independent technical audit of the staging runtime was conducted on **November 19, 2026**.

```
================================================================================
             LENDGUARD AI: PILOT RUNTIME READINESS ASSESSMENT
================================================================================
 [✓] Git Repository State         : Clean, commit 5c440ae (Base: 3b5aab3)
 [✓] Release Tag Frozen           : v1.0.0-rc.1 / v1.0.0-staging
 [✓] Backend Web API              : Active (.NET 10 LTS, Port 5000, Latency: 9.9ms)
 [✓] C# Background Worker         : Active (.NET 10 LTS, SKIP LOCKED Outbox Consumer)
 [✓] Python AI Microservice       : Active (FastAPI / Uvicorn, Port 8000, Latency: 1.02s)
 [✓] Staging Database Instance    : Active (PostgreSQL 16, Port 5433, 13 Tables)
 [✓] Frontend Production Build    : Active (React 18 / Vite, Port 5173)
 [✓] Dev Seed User Lockout        : VERIFIED (admin@example.com rejected with HTTP 401)
 [✓] Staging Credentials Active   : Admin & Analyst authenticated via JWT
 [✓] RBAC Gateways Active         : Analyst blocked from Admin routes (HTTP 403)
 [✓] Immutability Triggers Active : SQL UPDATE/DELETE on audit_logs blocked by trigger
 [✓] Persistent Volume Storage    : storage_staging/ (uploads/ and exports/ R/W verified)
================================================================================
```

### 2.1 Baseline Verification Evidence
Execution of `scripts/monitoring/verify_pilot_baseline.py` confirmed:
1. **Security Isolation:** Development seed accounts (`admin@example.com` / `Password123!`) were rejected with `HTTP 401 Unauthorized` due to `SEED_TEST_USERS=false`.
2. **Role Separation:** 
   - Administrator (`staging.admin@lendguard.internal`) authenticated successfully; authorized for `/api/v1/users` and `/api/v1/audit-logs` (HTTP 200).
   - Analyst (`staging.analyst@lendguard.internal`) authenticated successfully; route guards rejected attempts to access `/api/v1/users` and `/api/v1/audit-logs` with `HTTP 403 Forbidden`.
3. **Audit Trail Immutability:** An attempted SQL `UPDATE audit_logs SET action = 'ILLEGAL_MOD';` was rejected immediately by PostgreSQL:
   ```text
   ERROR: audit_logs entries are immutable and cannot be updated or deleted (operation: UPDATE).
   CONTEXT: PL/pgSQL function prevent_audit_log_modification() line 3 at RAISE
   ```
4. **AI Microservice Isolation:** Verified that the Python AI service exposes `/internal/v1/health` requiring `X-Internal-Service-Key`, runs without direct database connection strings, and operates in read-only mode.

---

## 3. Pilot Objectives, Roles & Responsibilities

### 3.1 Core Pilot Objectives
1. Validate end-to-end reconciliation accuracy across all eight business rules (RC-01 through RC-08).
2. Measure system throughput, worker outbox latency, and exception resolution velocity under realistic volumes.
3. Verify that the AI advisory microservice provides actionable, high-confidence explanations without compromising transaction integrity.
4. Confirm tamper-evident audit logging and regulatory compliance reporting under human operational workflows.
5. Identify technical risks, operational bottlenecks, or missing infrastructure prior to final production cutover.

### 3.2 Governance & Roles Matrix

| Role | Authorized Personnel / Identifier | Responsibilities | Security Privilege |
| :--- | :--- | :--- | :--- |
| **Operational Pilot Lead** | FinTech Implementation Lead | Overall pilot oversight, governance compliance, milestone review, final evaluation | Executive Authority |
| **Staging Administrator** | `staging.admin@lendguard.internal`<br>(UUID: `5671a1c9-07e4-4239-81cc-20287f5bdb39`) | User onboarding, batch ingestion, batch confirmation, exception assignment, system audit review | `ADMIN` Role |
| **Operational Analyst** | `staging.analyst@lendguard.internal`<br>(UUID: `fc803e91-9e96-436b-8634-a817a4324f0f`) | Exception investigation, investigation notes logging, AI advisory evaluation, human exception resolution | `ANALYST` Role |
| **Site Reliability Engineer** | DevOps / Platform Engineer | Service health monitoring, database latency tracking, outbox queue health, hot backup verification | Infrastructure Admin |
| **Compliance Representative**| Internal Audit Representative | Audit log inspection, immutable trigger verification, regulatory export validation | Audit Authority |

---

## 4. User Onboarding & Access Provisioning Protocol

In compliance with zero-default-credential requirements, access provisioning during the pilot follows a strict cryptographic protocol:

```
               [ Platform Engineer / Administrator ]
                                 |
                                 v
              [ Execute scripts/bootstrap/bootstrap_admin.py ]
                                 |
          +----------------------+----------------------+
          |                                             |
          v                                             v
  [ Provision Admin ]                           [ Provision Analyst ]
  - Generate UUID                               - Generate UUID
  - Bcrypt Work Factor: 12                      - Bcrypt Work Factor: 12
  - Upper Role: "ADMIN"                         - Upper Role: "ANALYST"
  - Store in PostgreSQL                         - Store in PostgreSQL
          |                                             |
          +----------------------+----------------------+
                                 |
                                 v
          [ Authenticate via POST /api/v1/auth/login ]
                                 |
                                 v
          [ Issue Signed JWT Bearer Token (120 min) ]
                                 |
                                 v
          [ RBAC Enforced on Every HTTP Request ]
```

### 4.1 Access Controls & Credential Management
- Initial credentials are generated via `scripts/bootstrap/bootstrap_admin.py` using bcrypt (work factor 12).
- Session tokens expire after **120 minutes** (`JWT_EXPIRY_MINUTES=120`).
- Tokens must be transmitted via HTTP `Authorization: Bearer <token>` over TLS reverse proxy.
- Direct account registration endpoints are disabled; all pilot users must be provisioned via the secure bootstrap script.

---

## 5. Approved Pilot Test Datasets

To ensure full compliance with financial privacy regulations, the pilot utilizes synthetic transaction datasets engineered to reflect real-world lending portfolios:

### 5.1 Internal Lending Dataset (`synthetic_internal_pilot.csv`)
- **Source Type:** `INTERNAL` (Core Banking / Loan Origination System)
- **Currency:** Indian Rupee (`INR`) and US Dollar (`USD`)
- **Transaction Types:** `DISBURSEMENT`, `REPAYMENT`, `FEE`
- **Volume:** Controlled batches containing standard disbursements, split repayments, missing payments, and fee adjustments.

### 5.2 External Settlement Dataset (`synthetic_external_pilot.csv`)
- **Source Type:** `EXTERNAL` (Bank Clearing Settlement / SWIFT / Payment Gateway)
- **Currency:** `INR`, `EUR`, `USD`
- **Transaction Types:** `SETTLEMENT`
- **Volume:** Corresponding settlement records including exact settlements, aggregate settlements, partial settlements, amount discrepancies, and duplicate credits.

---

## 6. Daily Operational Pilot Workflow

The operational pilot executes across a 5-day structured lifecycle:

```
+-----------------------------------------------------------------------------------+
|                           DAILY PILOT EXECUTION CYCLE                             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
      [ STEP 1: MORNING HEALTH CHECK ] -> Database, API, Worker & Storage Verified
                                          |
                                          v
      [ STEP 2: TEST BATCH INGESTION ] -> Internal & External CSVs Uploaded & Validated
                                          |
                                          v
      [ STEP 3: BATCH CONFIRMATION ]   -> Transaction Rows Persisted to PostgreSQL
                                          |
                                          v
      [ STEP 4: RECONCILIATION RUN ]   -> Queued in Outbox; Worker processes SKIP LOCKED
                                          |
                                          v
      [ STEP 5: EXCEPTION ASSIGNMENT ] -> Administrator assigns exceptions to Analyst
                                          |
                                          v
      [ STEP 6: EXCEPTION INVESTIGATION ] -> Analyst reviews details & appends notes
                                          |
                                          v
      [ STEP 7: AI ADVISORY EVALUATION ]  -> AI explanation generated; checked for advice
                                          |
                                          v
      [ STEP 8: HUMAN RESOLUTION ]     -> Analyst resolves with category & justification
                                          |
                                          v
      [ STEP 9: AUDIT & REPORT EXPORT ] -> Immutable audit log & CSV report extracted
                                          |
                                          v
      [ STEP 10: BACKUP & METRICS ]    -> DR hot backup taken; metrics recorded
```

---

## 7. AI Advisory Usage & Decision Mandate

1. **Advisory-Only Status:** The AI service provides diagnostic explanations and suggested resolution categories based on historical transaction patterns. The AI has **zero autonomous resolution authority**.
2. **Explainability & Evidence:** Every AI advisory payload includes:
   - Root-cause summary.
   - Identified evidence attributes (e.g. `discrepancyAmount`, `currency`, `dateOffset`).
   - Actionable resolution recommendation.
   - Explicit `advisoryOnly: true` flag.
3. **Deterministic Fallback:** If the Python AI service is unavailable, worker timeouts occur, or confidence is below threshold, the system automatically falls back to deterministic rule-based advice.

---

## 8. Incident Escalation & Rollback Procedures

| Severity Level | Operational Impact | Escalation Path | Target Resolution |
| :---: | :--- | :--- | :---: |
| **SEV-1** | Database deadlock, storage corruption, or service outage | SRE Lead -> Pilot Lead -> Architect | < 15 minutes (Execute DR Restore) |
| **SEV-2** | Background worker queue delay > 30s | SRE Lead -> Backend Engineer | < 30 minutes (Restart Worker) |
| **SEV-3** | AI explanation service timeout or error | QA Lead -> AI Engineer | Fallback to deterministic rules |

---

## 9. Pilot Duration & Review Checkpoints

| Checkpoint | Milestone | Target Date | Review Artifact |
| :--- | :--- | :---: | :--- |
| **CP-01** | Baseline Readiness & Environment Verification | Day 1 | `scripts/monitoring/verify_pilot_baseline.py` |
| **CP-02** | Scenarios 01 to 08 (Core Rules & Ingestion) | Day 2 | `tests/pilot/run_pilot_scenarios.py` |
| **CP-03** | Scenarios 09 to 14 (Workflow, AI & Security) | Day 3 | `tests/pilot/pilot_execution_metrics.json` |
| **CP-04** | Stress, Interruption & Disaster Recovery Drill | Day 4 | Hot backup zip & table comparison |
| **CP-05** | Final Pilot Review & Production Sign-off | Day 5 | `PILOT_FINAL_RESULTS_AND_SIGNOFF.md` |

---

## 10. Operational Sign-off & Authority

By approving this document, the stakeholders establish the authorized baseline for the Controlled Operational Pilot.

| Stakeholder Role | Designee Title | Approval Status | Date |
| :--- | :--- | :---: | :---: |
| **Implementation Lead** | FinTech Platform Lead | **APPROVED** | 2026-11-19 |
| **Lead Operational Analyst** | Senior Reconciliation Analyst | **ACCEPTED** | 2026-11-19 |
| **Principal SRE** | Cloud Platform Operations | **VERIFIED** | 2026-11-19 |
| **Compliance Officer** | Regulatory Compliance Lead | **CLEARED** | 2026-11-19 |
