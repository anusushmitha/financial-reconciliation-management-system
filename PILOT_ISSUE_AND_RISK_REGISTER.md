# LENDGUARD AI — Pilot Issue & Risk Register
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Git Commit Hash:** `5c440ae` (Base: `3b5aab3`)  
**Status:** **ACTIVE — GOVERNANCE & RISK MITIGATION PROTOCOL**  

---

## 1. Executive Risk Summary

This Pilot Issue & Risk Register documents all technical, operational, architectural, and security risks identified prior to, during, and following the Controlled Operational Pilot. Every risk is categorized by severity, likelihood, and operational impact, accompanied by preventative and detective mitigations.

Furthermore, this register tracks **Resolved Technical Issues** encountered during staging deployment and baseline verification, and explicitly delineates **Missing External Boundaries** that require formal executive and organizational action prior to live production cutover.

---

## 2. Risk Classification Matrix

```
       Severity ->     Low             Medium            High           Critical
  Likelihood v
  Almost Certain   |              |                 |               |  RISK-01 (PII Leakage)
  Likely           |              | RISK-04(Timeout)| RISK-02 (SSO) |
  Possible         |              | RISK-05(Storage)| RISK-03 (Conn)|
  Unlikely         | RISK-06(Drift)|                 |               |
```

---

## 3. Active Risk Register

| Risk ID | Risk Category | Risk Description | Severity | Likelihood | Impact | Preventative / Detective Mitigation | Risk Owner |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **RISK-01** | Data Privacy | Accidental ingestion of live customer PII into staging | **CRITICAL** | Unlikely | High | **Strict Synthetic Enforcement:** Automated pre-ingestion regex filters reject national identifiers and live banking account numbers. Only synthetic datasets approved. | Compliance Lead |
| **RISK-02** | Security | Reliance on local bcrypt accounts vs Enterprise SSO / SAML | **HIGH** | Likely | Medium | **KMS & SSO Architecture Prepared:** Staging uses local bcrypt with work factor 12. Production requires enterprise OIDC/SAML integration (Okta, Azure AD). | Security Lead |
| **RISK-03** | Operations | Unauthorized live banking connection attempts | **CRITICAL** | Unlikely | Catastrophic | **Hard Air-Gap:** All SWIFT/ACH hostnames are blocked at Nginx proxy. Zero production banking credentials configured in staging `.env`. | Implementation Lead |
| **RISK-04** | AI Service | Third-party LLM latency spikes causing worker queue delays | **MEDIUM** | Likely | Low | **Rule-Based Fallback:** Worker imposes a strict 5-second timeout on AI explanation calls, falling back automatically to deterministic heuristic advice. | AI Lead |
| **RISK-05** | Infrastructure| Persistent storage disk exhaustion from CSV upload retention | **MEDIUM** | Possible | Medium | **Retention Policy:** Automated cleanup daemon scheduled to archive upload CSVs older than 30 days to secondary cold storage. | Platform SRE |
| **RISK-06** | Database | Schema drift between staging and future cloud production | **LOW** | Unlikely | Medium | **Versioned Migration Enforcement:** All schema changes must execute strictly through versioned SQL scripts (`001_initial_schema.sql`, etc.). | Lead Architect |

---

## 4. Log of Issues Identified & Resolved During Verification

The following technical anomalies were encountered during staging bootstrap and baseline verification, investigated, and permanently resolved:

| Issue ID | Component | Description & Symptom | Root Cause | Resolution Applied | Verification Evidence |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | API Security | Staging Admin received HTTP 403 on `/api/v1/users` | ASP.NET Core `[Authorize(Roles = UserRole.Admin)]` expects uppercase `"ADMIN"`. Initial bootstrap script inserted `"Admin"`. | Updated `bootstrap_admin.py` to enforce uppercase `role.upper()`; normalized database records. | Admin authenticated and retrieved user list with HTTP 200 OK. |
| **ISSUE-02** | API Gateway | Reassignment endpoint rejected `null` assigned user | `AssignExceptionRequest.AssignedTo` is typed as non-nullable `Guid` in C#, rejecting `null` in JSON. | Updated assignment protocol to reassign between valid users (Admin <-> Analyst) rather than passing null. | Scenario 09 executed with 100% pass rate. |
| **ISSUE-03** | AI Microservice | Health monitor reported HTTP 404 on port 8000 | AI service exposes internal health on `/internal/v1/health` requiring `X-Internal-Service-Key`, not bare `/health`. | Updated `health_check.py` and `verify_pilot_baseline.py` to target authenticated internal health endpoint. | AI service verified Healthy with 1.02s latency. |
| **ISSUE-04** | Git Versioning | Untracked staging configuration files | `.env.staging` and local storage folders risked being committed into Git. | Added `.env.staging`, `storage_staging/`, and temporary recovery directories to `.gitignore`. | Clean Git working tree verified at commit `5c440ae`. |

---

## 5. Missing External Boundaries & Production Prerequisites

> [!IMPORTANT]
> **BOUNDARY DECLARATION: PREREQUISITES FOR LIVE PRODUCTION CUTOVER**  
> While the staging runtime is 100% verified and the Controlled Operational Pilot is authorized to proceed with synthetic data, the following organizational and cloud infrastructure items are **MISSING** and must be provisioned prior to live production launch:

1. **Formal Executive & CISO Banking Integration Authorization:**
   - Formal written approval from the Chief Information Security Officer (CISO) and Chief Risk Officer (CRO) authorizing live network connectivity to core banking APIs and settlement clearing houses.
2. **Enterprise Cloud Infrastructure Provisioning:**
   - Managed PostgreSQL 16 instance with Multi-AZ replication (e.g. AWS RDS or GCP Cloud SQL).
   - Encrypted Object Storage bucket (AWS S3 or GCP Cloud Storage) with AWS KMS / GCP KMS Customer Managed Encryption Keys (CMEK).
   - Ingress Load Balancer with public CA-signed SSL certificates (Let's Encrypt or AWS Certificate Manager).
3. **Enterprise Identity Provider (IdP) Integration:**
   - Transition from local bcrypt authentication to Enterprise Single Sign-On (SSO) via SAML 2.0 / OpenID Connect (Azure AD, Okta, or Ping Identity).
4. **Live Data Masking & Data Protection Impact Assessment (DPIA):**
   - Formal completion of a Data Protection Impact Assessment covering financial borrower transaction data under applicable data privacy laws.

---

## 6. Risk Register Maintenance Protocol

This register shall be reviewed daily during the operational pilot by the Pilot Implementation Lead and the Site Reliability Engineer. Any operational incident or anomaly must be logged within 30 minutes of occurrence.
