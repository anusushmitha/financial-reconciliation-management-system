# LENDGUARD AI — Pilot Daily Operations Runbook
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Target Environment:** Staging Deployment Runtime  
**Intended Audience:** Operations Administrators, Reconciliation Analysts, Site Reliability Engineers  
**Classification:** Internal Standard Operating Procedure (SOP)  

---

## 1. Overview & Operational Schedule

This Standard Operating Procedure (SOP) details the mandatory 12-step daily workflow for operating the LendGuard AI Controlled Operational Pilot. Daily execution ensures systematic batch ingestion, rule-based reconciliation, exception investigation, human decision enforcement, immutable audit logging, and data backup verification.

### Daily Operational Timeline
```
08:30 - 09:00 : Steps 1 & 2  — Morning Health Check & Outbox Verification
09:00 - 10:00 : Steps 3 & 4  — Synthetic Batch Ingestion & Reconciliation Execution
10:00 - 11:00 : Step 5       — Exception Review & Analyst Work Allocation
11:00 - 14:00 : Steps 6 to 8 — Exception Investigation, AI Review & Human Resolution
14:00 - 15:00 : Steps 9 & 10 — Audit Verification, CSV Export & Metrics Recording
15:00 - 15:30 : Steps 11 & 12— Hot Backup Drill, Issue Logging & Shift Handover
```

---

## 2. Step-by-Step Daily Execution Procedure

### Step 1: Morning Infrastructure & Service Health Check
**Responsible:** Site Reliability Engineer / Operations Administrator  
**Procedure:**
Execute the automated health monitoring utility from the project root:
```bash
python scripts/monitoring/health_check.py --format text
```
**Verification Criteria:**
- `overall_status`: Must be `"HEALTHY"`.
- Backend Web API: HTTP 200, latency `< 100ms`.
- PostgreSQL Database: Table count = 13, latency `< 500ms`, deadlocks = 0.
- AI Microservice: HTTP 200, status `"Healthy"`.
- Persistent Storage: `read_write_verified = true`.

---

### Step 2: Database & Worker Outbox Backlog Verification
**Responsible:** Operations Administrator  
**Procedure:**
Execute the baseline verification utility:
```bash
python scripts/monitoring/verify_pilot_baseline.py
```
**Verification Criteria:**
- Development seed account lockout: `HTTP 401 Unauthorized`.
- Administrator & Analyst authentication: `HTTP 200 OK`.
- RBAC isolation: Analyst blocked from `/users` (`HTTP 403`).
- Immutability trigger protection: Confirmed active on `audit_logs`.
- Pending background outbox jobs: Must be `0` (or actively decreasing).

---

### Step 3: Test Batch Ingestion & Schema Validation
**Responsible:** Operations Administrator  
**Procedure:**
1. Authenticate to the API as Administrator:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"staging.admin@lendguard.internal","password":"StagingAdmin_Secure2026!"}'
   ```
2. Upload the approved daily synthetic internal loan dataset:
   ```bash
   curl -X POST http://localhost:5000/api/v1/imports \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -F "file=@tests/fixtures/reconciliation/internal_golden_dataset.csv" \
     -F "sourceType=INTERNAL"
   ```
3. Upload the corresponding external bank settlement dataset:
   ```bash
   curl -X POST http://localhost:5000/api/v1/imports \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -F "file=@tests/fixtures/reconciliation/external_golden_dataset.csv" \
     -F "sourceType=EXTERNAL"
   ```
4. Verify validation status via `GET /api/v1/imports/{id}/validation`.
5. Confirm both batches via `POST /api/v1/imports/{id}/confirm` with `{"confirmValidRows": true}`.

---

### Step 4: Reconciliation Run Dispatch & Outbox Monitoring
**Responsible:** Operations Administrator  
**Procedure:**
Trigger the reconciliation run comparing internal and external batches:
```bash
curl -X POST http://localhost:5000/api/v1/reconciliation-runs \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "internalBatchId": "<INTERNAL_BATCH_ID>",
    "externalBatchId": "<EXTERNAL_BATCH_ID>",
    "dateToleranceDays": 2.0
  }'
```
Monitor execution status via `GET /api/v1/reconciliation-runs/{id}` until status is `"COMPLETED"`. Ensure execution time is `< 5000ms`.

---

### Step 5: Exception Queue Review & Assignment
**Responsible:** Operations Administrator  
**Procedure:**
1. Retrieve open exceptions:
   ```bash
   curl -X GET "http://localhost:5000/api/v1/exceptions?status=OPEN&pageSize=50" \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
2. Assign each open exception to an operational analyst:
   ```bash
   curl -X PATCH http://localhost:5000/api/v1/exceptions/{id}/assignment \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"assignedTo": "<ANALYST_UUID>"}'
   ```

---

### Step 6: Exception Investigation & Note Logging
**Responsible:** Operational Analyst  
**Procedure:**
1. Analyst logs into the UI or API and inspects assigned exceptions.
2. Review transaction reference, amount discrepancy, currency, and date offset.
3. Append a mandatory investigation note before taking resolution action:
   ```bash
   curl -X POST http://localhost:5000/api/v1/exceptions/{id}/notes \
     -H "Authorization: Bearer <ANALYST_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"note": "Daily Investigation: Confirmed settlement fee offset of INR 500.00."}'
   ```

---

### Step 7: AI Advisory Explanation Review
**Responsible:** Operational Analyst  
**Procedure:**
1. Request an AI diagnostic explanation for complex exceptions:
   ```bash
   curl -X POST http://localhost:5000/api/v1/exceptions/{id}/analysis \
     -H "Authorization: Bearer <ANALYST_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"analysisType": "EXPLANATION"}'
   ```
2. Poll `GET /api/v1/exceptions/{id}/analysis` to review the summary, evidence, and recommendations.
3. **Mandatory Guardrail:** Verify that the AI advice is treated strictly as a recommendation; verify `advisoryOnly: true`.

---

### Step 8: Human Resolution Recording
**Responsible:** Operational Analyst  
**Procedure:**
Execute the resolution transition. The analyst must select a valid category and supply a human audit justification:
```bash
curl -X POST http://localhost:5000/api/v1/exceptions/{id}/resolve \
  -H "Authorization: Bearer <ANALYST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "resolutionCategory": "FEE_ADJUSTMENT",
    "explanation": "Verified against fee schedule. Deducted by clearing bank."
  }'
```
Verify that the exception status transitions from `OPEN` to `RESOLVED`.

---

### Step 9: Immutable Audit Trail Inspection
**Responsible:** Compliance Representative / Operations Administrator  
**Procedure:**
Query the audit log endpoint to verify that all daily operational events were recorded:
```bash
curl -X GET "http://localhost:5000/api/v1/audit-logs?pageSize=50" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Confirm that records for `IMPORT_UPLOADED`, `RECONCILIATION_QUEUED`, `EXCEPTION_ASSIGNED`, `INVESTIGATION_NOTE_ADDED`, and `EXCEPTION_RESOLVED` exist with non-null user IDs and timestamps.

---

### Step 10: Reconciliation CSV Report Export
**Responsible:** Operations Administrator  
**Procedure:**
Download the daily reconciliation export report:
```bash
curl -X GET "http://localhost:5000/api/v1/reports/reconciliation/export" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -o "daily_reconciliation_report_$(date +%Y%m%d).csv"
```
Verify that the generated CSV is non-empty, contains valid headers, and matches the database counts.

---

### Step 11: Daily Operational Metrics Logging
**Responsible:** Operations Administrator  
**Procedure:**
Execute the pilot scenario measurement harness to record operational metrics:
```bash
python tests/pilot/run_pilot_scenarios.py
```
Inspect the output file `tests/pilot/pilot_execution_metrics.json` and record the daily metrics in `PILOT_METRICS_AND_SUCCESS_CRITERIA.md`.

---

### Step 12: Evening Hot Backup & Disaster Recovery Verification
**Responsible:** Site Reliability Engineer  
**Procedure:**
Create a hot, encrypted database backup archive:
```bash
python scripts/dr/backup_database.py
```
**Verification Criteria:**
- Backup archive created under `database/backups/`.
- Archive size > 15 KB.
- Creation time < 5.0 seconds.

---

## 3. Shift Handover Checklist & Sign-off Template

At the conclusion of each daily operating cycle, the on-duty administrator and analyst must complete the handover checklist below:

```text
================================================================================
           LENDGUARD AI: DAILY OPERATIONAL SHIFT HANDOVER
================================================================================
 Date: ____________________          Shift Period: [ ] Morning  [ ] Full Day
 
 [ ] Step 01: Service Health Check Completed (Status: HEALTHY)
 [ ] Step 02: Baseline Security Verification Completed (Lockout Active)
 [ ] Step 03: Test Batches Ingested and Confirmed (Batch IDs Recorded)
 [ ] Step 04: Reconciliation Run Completed (Execution Time: ______ ms)
 [ ] Step 05: All Open Exceptions Assigned to Analysts
 [ ] Step 06: Investigation Notes Recorded for Discrepancies > $50.00
 [ ] Step 07: AI Explanations Reviewed (Zero Autonomous Mutations)
 [ ] Step 08: Human Exception Resolutions Executed
 [ ] Step 09: Audit Trail Inspected (Zero Trigger Failures)
 [ ] Step 10: Reconciliation CSV Export Generated & Archived
 [ ] Step 11: Operational Metrics Logged to pilot_execution_metrics.json
 [ ] Step 12: Evening Hot Backup Created (Backup File: _____________________)
 
 Unresolved Exceptions Carried Forward: ______
 Operational Anomalies or Incidents Logged: ______
 
 Administrator Signature: _______________________ Date: ___________________
 Analyst Signature:       _______________________ Date: ___________________
================================================================================
```
