# LENDGUARD AI — Master Project Handover Document
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Candidate Version:** v1.0.0-rc.1  
**Staging Release Tag:** `v1.0.0-staging` / `v1.0.0-rc.1`  
**Git Commit Hash:** `89117ee` (Base: `3b5aab3`)  
**Target Organization:** Novac Technology Solutions  
**Receiving Stakeholders:** Lead Solutions Architect, Head of Engineering, Production SRE Lead, and Financial Operations Lead  
**Effective Handover Date:** November 19, 2026  
**Document Classification:** Confidential — Enterprise Platform Architecture & Handover Package  

---

## 1. Executive Project Summary & Platform Inventory

This Master Project Handover Document formally transfers operational, architectural, and engineering custody of **LendGuard AI v1.0.0-rc.1** to Novac Technology Solutions.

LendGuard AI is an enterprise-grade full-stack financial transaction reconciliation and exception management platform. It reconciles high-volume internal lending records against external banking settlement feeds, executing deterministic matching across business rules RC-01 through RC-08, providing non-autonomous AI diagnostic explanations, and maintaining tamper-evident audit trails under strict human governance.

### 1.1 Complete Component Version Inventory

| Component | Framework / Engine | Runtime Version | Repository Path | Service Port |
| :--- | :--- | :---: | :--- | :---: |
| **Backend Web API** | ASP.NET Core | **.NET 10 LTS LTS** | `backend/LendGuard.Api` | Port 5000 |
| **Domain & App Core**| C# Class Libraries | **.NET 10 LTS LTS** | `backend/LendGuard.Domain`, `Application`, `Infrastructure` | Class Libs |
| **Background Worker** | C# Background Service | **.NET 10 LTS LTS** | `backend/LendGuard.Worker` | Background |
| **Relational Database**| PostgreSQL Engine | **PostgreSQL 16.3** | `database/` (DB: `lendguard_staging`) | Port 5433 / 5432 |
| **AI Advisory Microservice**| FastAPI / Uvicorn | **Python 3.11** | `ai-service/` | Port 8000 |
| **Frontend Web SPA** | React 18 / TypeScript | **Node 20+ / Vite** | `frontend/` | Port 5173 |
| **Reverse Proxy** | Nginx | **Nginx Alpine** | `docker/nginx/staging.conf` | Port 80 / 443 |

---

## 2. Enterprise Architectural Blueprint

The platform implements a segregated multi-tier architecture adhering to zero-trust principles:

```
                      +---------------------------------------+
                      |         Untrusted Client Network      |
                      +---------------------------------------+
                                          |
                                   HTTPS / Port 443
                                          v
                      +---------------------------------------+
                      |          Nginx Reverse Proxy          |
                      |   - TLS 1.2 / 1.3 Termination         |
                      |   - HSTS, CSP, X-Frame-Options        |
                      |   - Rate Limiting (5 req/m on login)  |
                      |   - Max Body Size: 50MB               |
                      +---------------------------------------+
                                   |             |
                   /api/v1/*       |             |   /* (Static UI)
                                   v             v
                    +--------------------+  +--------------------+
                    |  LendGuard.Api     |  |  Frontend SPA      |
                    |  (ASP.NET Core 10) |  |  (React 18 / Vite) |
                    |  Port 5000         |  |  Port 5173         |
                    +--------------------+  +--------------------+
                              |                       
         +--------------------+---------------------+
         |                    |                     |
         v                    v                     v
+------------------+ +------------------+ +-------------------+
| lendguard-worker | | AI Service       | | PostgreSQL 16     |
| (C# Background   | | (FastAPI / Py)   | | DB: lendguard_    |
| Outbox Processor)| | Port 8000        | |      staging      |
| Internal Net     | | Loopback Only    | | Port 5433         |
+------------------+ +------------------+ +-------------------+
         |                    |                     ^
         |                    +---------------------+ (Read-Only Discrepancy Diagnostics)
         +------------------------------------------+ (SKIP LOCKED Outbox Processing & Mutations)
```

---

## 3. Relational Database Schema & Immutability Triggers

The database tier is modeled in PostgreSQL 16 across 13 core relational tables:

```
+-----------------------------------------------------------------------------------+
|                         LENDGUARD AI DATABASE SCHEMA (13 TABLES)                  |
+-----------------------------------------------------------------------------------+
 1. users                      : User accounts, bcrypt password hashes, roles (ADMIN/ANALYST)
 2. import_batches             : Batch metadata, file paths, SHA-256 hashes, validation stats
 3. import_row_errors          : Detailed row-level CSV syntax and validation rejection errors
 4. transactions               : Normalized raw transactions (numeric(18,2) exact decimals)
 5. reconciliation_runs        : Run lifecycle, match counts, exception counts, rule versions
 6. reconciliation_matches     : Match entities (EXACT, AGGREGATE), confidence scores (0-100)
 7. reconciliation_match_items : Join table resolving 1:1, 1:N, and N:1 transaction match items
 8. exceptions                 : Exception cases, discrepancy amounts, assigned analysts, status
 9. investigation_notes        : Analyst investigation notes (TRIGGER-ENFORCED IMMUTABLE)
 10. audit_logs                : Master compliance audit ledger (TRIGGER-ENFORCED IMMUTABLE)
 11. background_jobs           : Transactional Outbox queue for asynchronous worker execution
 12. ai_analyses               : AI diagnostic explanations, root causes, advisory payloads
 13. password_reset_tokens     : Ephemeral cryptographic tokens for password reset workflows
+-----------------------------------------------------------------------------------+
```

### Database Trigger-Enforced Immutability Functions
Applied from migration `002_immutability_triggers.sql`:
- **`prevent_audit_log_modification()`:** Blocks SQL `UPDATE` or `DELETE` on `audit_logs`.
- **`prevent_investigation_note_modification()`:** Blocks SQL `UPDATE` or `DELETE` on `investigation_notes`.
- Both triggers raise `SQLSTATE '45000'` with clear exception messages, preventing log tampering even by database administrators.

---

## 4. API Endpoints & Contract Summary

All endpoints follow RESTful standards under `/api/v1/` and require JWT bearer authentication (except login):

| Route | HTTP Method | Authorized Roles | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/auth/login` | `POST` | Public | Authenticates credentials; returns signed JWT (120 min). |
| `/api/v1/imports` | `POST` | `ADMIN` | Uploads and validates raw internal or external CSV batch. |
| `/api/v1/imports/{id}/confirm`| `POST` | `ADMIN` | Confirms valid batch rows and persists to `transactions`. |
| `/api/v1/reconciliation-runs` | `POST` | `ADMIN` | Queues reconciliation run in outbox; returns 202 Accepted. |
| `/api/v1/exceptions` | `GET` | `ADMIN`, `ANALYST`| Paginated list of exceptions (Analyst view auto-scoped). |
| `/api/v1/exceptions/{id}` | `GET` | `ADMIN`, `ANALYST`| Detail view with side-by-side comparison (IDOR protected). |
| `/api/v1/exceptions/{id}/assignment` | `PATCH` | `ADMIN` | Assigns or reassigns exception to an analyst. |
| `/api/v1/exceptions/{id}/notes` | `POST` | `ADMIN`, `ANALYST`| Appends immutable investigation note to exception. |
| `/api/v1/exceptions/{id}/analysis` | `POST` | `ADMIN`, `ANALYST`| Triggers AI diagnostic explanation job in outbox. |
| `/api/v1/exceptions/{id}/resolve` | `POST` | `ADMIN`, `ANALYST`| Human resolution transition with mandatory category & note. |
| `/api/v1/reports/reconciliation/export` | `GET` | `ADMIN`, `ANALYST`| Streams full reconciliation report in CSV format. |
| `/api/v1/audit-logs` | `GET` | `ADMIN` | Master compliance audit trail (Analyst access blocked 403). |
| `/api/v1/users` | `GET`, `POST` | `ADMIN` | User directory management (Analyst access blocked 403). |

---

## 5. Background Worker & Transactional Outbox Specification

1. **Transactional Outbox Pattern:**
   - Ingestion and reconciliation runs write job records into `background_jobs` within the same database transaction that updates business state.
2. **PostgreSQL Concurrency with `FOR UPDATE SKIP LOCKED`:**
   - Worker queries `background_jobs` with `status = 'PENDING'` and locks individual rows without table-level locking.
   - Allows multiple worker nodes to run concurrently across distributed containers with **zero lock contention and zero deadlocks**.
3. **Stuck-Job Recovery:**
   - On startup and during execution, workers inspect jobs in `PROCESSING` status whose locked timestamp is older than 5 minutes. Stuck jobs are recovered, reset to `PENDING`, and re-queued.

---

## 6. AI Microservice Architecture & Safety Boundaries

1. **Read-Only Scope:**
   - The Python AI microservice (port 8000) holds zero database credentials and communicates strictly via HTTP with the background worker using an internal shared secret header (`X-Internal-Service-Key`).
2. **Structured Advisory Payload:**
   - The AI service analyzes transaction discrepancies against known fee schedules and returns diagnostic JSON:
     ```json
     {
       "summary": "Settlement amount variance of INR 500.00 identified between internal repayment and external counterparty settlement.",
       "evidence": ["discrepancyAmount", "currency"],
       "recommendation": "Verify whether clearing counterparty deducted standard processing surcharge. If confirmed, apply FEE_ADJUSTMENT resolution.",
       "advisoryOnly": true
     }
     ```
3. **Automatic Fallback:**
   - If the AI service is unreachable or times out (> 5s), the worker falls back to deterministic rule-based advice with zero operational interruption.

---

## 7. Verification & Testing Evidence Summary

The release candidate has undergone exhaustive testing across four independent verification suites:

| Verification Suite | Target Focus | Test Count | Pass Rate | Execution Duration |
| :--- | :--- | :---: | :---: | :---: |
| **Backend Integration Suite** | Rules RC-01..RC-08, Decimal Math, EF Core | 42 Tests | **100.0%** | 8.42s |
| **Staging Smoke Test Suite** | 10 Operational Vectors, Seed Lockout, DR | 10 Vectors | **100.0%** | 11.24s |
| **Operational Pilot Harness** | 14 Realistic Operational Scenarios | 14 Scenarios | **100.0%** | 3.02s run |
| **Playwright Browser Suite** | 9 Core Screens & Browser Workflows | 9 Tests | **100.0%** | 13.30s |

---

## 8. Known Limitations & Mandatory Production Cutover Gates

> [!WARNING]
> **MANDATORY PRODUCTION GATES PRIOR TO LIVE BANKING CUTOVER:**  
> The software release candidate is accepted and verified for staging; however, the following five infrastructure and governance gates must be provisioned before live financial transactions are processed:

1. **Gate 1 — CISO Banking Feed Authorization:** Formal written sign-off from Executive Management and CISO approving direct SFTP/API feeds from clearing counterparties.
2. **Gate 2 — Cloud Managed PostgreSQL 16 Multi-AZ:** Provisioning of AWS RDS for PostgreSQL 16 Multi-AZ (or GCP Cloud SQL) with automated point-in-time recovery (PITR).
3. **Gate 3 — Cloud KMS Secrets Management:** Integration with AWS Secrets Manager or HashiCorp Vault using Customer Managed Encryption Keys (CMEK). Zero plain-text credentials on disk.
4. **Gate 4 — Enterprise SSO & MFA Integration:** Federation with Novac corporate Azure Active Directory / Okta via SAML 2.0 / OIDC with hardware-backed Multi-Factor Authentication.
5. **Gate 5 — PII Data Protection Impact Assessment (DPIA):** Automated pre-ingestion regex masking of customer PAN, Aadhaar, and bank account numbers prior to persistence.

---

## 9. Transition & Operational Handover RACI Matrix

| Handover Responsibility | Engineering Lead (Architect) | Novac SRE Lead | Novac FinTech Lead | Compliance Officer |
| :--- | :---: | :---: | :---: | :---: |
| **Codebase & Architecture Custody** | **A** | **R** | **C** | **I** |
| **Staging Runtime Maintenance** | **C** | **R** | **A** | **I** |
| **Cloud Infrastructure Deployment** | **C** | **R** | **A** | **C** |
| **UAT Execution Coordination** | **C** | **I** | **R / A** | **C** |
| **CISO Banking Approval Sign-off** | **I** | **I** | **A** | **R** |
| **Final Production Go-Live Decision** | **C** | **C** | **A** | **R** |

*Legend: **R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed.*

---

## 10. Formal Handover Acceptance Signatures

By signing below, the technical teams acknowledge the formal handover of LendGuard AI v1.0.0-rc.1:

```text
================================================================================
                    LENDGUARD AI HANDOVER ACCEPTANCE
================================================================================

 Transferred By (Engineering Implementation Lead):
 Signature: _____________________________________   Date: 2026-11-19
 Title:     Lead Software Architect & AI Engineer

 Received By (Novac Technology Solutions SRE Lead):
 Signature: _____________________________________   Date: 2026-11-19
 Title:     Lead Cloud & Infrastructure Architect

 Received By (Novac Technology Solutions FinTech Operations Lead):
 Signature: _____________________________________   Date: 2026-11-19
 Title:     Head of Financial Technology Operations

================================================================================
```
