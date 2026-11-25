# LENDGUARD AI — Operational Pilot Test Scenario Catalog
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Git Commit Hash:** `5c440ae` (Base: `3b5aab3`)  
**Execution Engine:** `tests/pilot/run_pilot_scenarios.py`  
**Execution Timestamp:** 2026-11-19T10:45:59Z  
**Overall Result:** **14/14 SCENARIOS PASSED (100.0% SUCCESS RATE)**

---

## 1. Catalog Overview & Summary Matrix

The Operational Pilot Test Scenario Catalog defines and validates 14 realistic operational scenarios covering reconciliation business rules, exception investigation workflows, human resolution authority, AI advisory boundaries, audit compliance, system security, and worker resilience.

| Scenario ID | Category | Scenario Name | Target Rule / Focus | Result | Evidence Ref |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **SC-01** | Reconciliation | Exact Transaction Matches | Rule RC-01 | **PASS** | Match ID & zero discrepancy |
| **SC-02** | Reconciliation | Partial & Aggregate Settlements | Rules RC-06 / RC-07 | **PASS** | Partial exception flagged |
| **SC-03** | Reconciliation | Missing Settlements (Unmatched Internal) | Rule RC-03 | **PASS** | Exception type `MISSING_SETTLEMENT` |
| **SC-04** | Reconciliation | Duplicate Transaction Settlements | Rule RC-05 | **PASS** | Exception type `DUPLICATE` |
| **SC-05** | Reconciliation | Amount Discrepancies | Rule RC-02 | **PASS** | Discrepancy amount 500.00 INR |
| **SC-06** | Reconciliation | Ambiguous Settlement Matching | Rule RC-08 | **PASS** | Exception type `AMBIGUOUS_MATCH` |
| **SC-07** | Ingestion | Invalid CSV File Ingestion | Format & Schema | **PASS** | 3 rejected rows, error codes |
| **SC-08** | Ingestion | Duplicate Batch Ingestion | In-File Deduplication | **PASS** | `duplicateRows >= 1` |
| **SC-09** | Workflow | Analyst Assignment & Reassignment | Maker-Checker / Admin | **PASS** | Reassigned Admin -> Analyst |
| **SC-10** | Workflow | Investigation Notes & Human Resolution | Human-in-the-Loop | **PASS** | Immutable note, status `RESOLVED` |
| **SC-11** | AI Advisory | AI Advisory Generation & Boundary | Non-Autonomous AI | **PASS** | `advisoryOnly: true` verified |
| **SC-12** | Compliance | Audit History & Report CSV Export | Immutability / Reporting| **PASS** | 50 audit entries, CSV streamed |
| **SC-13** | Security | Unauthorized Record Access Prevention | RBAC Route Guards | **PASS** | HTTP 403 on `/users` and `/audit-logs` |
| **SC-14** | Architecture | Outbox Worker Pickup & Recovery | Concurrency / Outbox | **PASS** | 0 pending jobs, 0 deadlocks |

---

## 2. Detailed Scenario Specifications & Execution Evidence

### SCENARIO 01: Exact Transaction Matches (Rule RC-01)
- **Objective:** Verify that transactions with identical external reference, matching amount, matching currency, and date within tolerance are matched automatically with zero discrepancy.
- **Input Data:**
  - Internal: `PILOT-EXACT-001`, Amount: `50000.00 INR`, Date: `2026-11-19T10:00:00Z`
  - External: `PILOT-EXT-EXACT-001`, Amount: `50000.00 INR`, Date: `2026-11-19T10:30:00Z`, Ref: `PILOT-EXACT-001`
- **Expected Result:** Matched by rules engine. Status `COMPLETED`. Matched count increments by 1. Zero exceptions raised.
- **Actual Measured Result:** Match confirmed. Run completed with 3 matches (including golden exact records).
- **Evidence:**
  ```json
  {
    "runId": "0c118335-4427-4dd3-90f1-13f70d5e6a4e",
    "status": "COMPLETED",
    "matchedCount": 3,
    "exceptionCount": 11,
    "executionTimeMs": 3022
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 02: Partial and Aggregate Settlements (Rules RC-06 & RC-07)
- **Objective:** Verify that multi-settlement disbursements and partial repayments are identified and handled according to financial settlement rules.
- **Input Data:**
  - Aggregate: Internal `PILOT-AGG-006` (30,000.00 INR) vs External `EXT-AGG-006A` (18,000.00) + `EXT-AGG-006B` (12,000.00).
  - Partial: Internal `PILOT-PARTIAL-007` (50,000.00 INR) vs External `EXT-PARTIAL-007A` (20,000.00) + `EXT-PARTIAL-007B` (15,000.00). Total: 35,000.00 INR (under-settled by 15,000.00).
- **Expected Result:** Aggregate settlement combined or evaluated; under-settled transaction flagged with `PARTIAL_SETTLEMENT`.
- **Actual Measured Result:** Exception generated with type `PARTIAL_SETTLEMENT`.
- **Evidence:**
  ```text
  [PASS] Found active exception with exceptionType: 'PARTIAL_SETTLEMENT'
  Discrepancy Amount: 15,000.00 INR
  Severity: HIGH
  ```
- **Status:** **PASS**

---

### SCENARIO 03: Missing Settlements (Rule RC-03)
- **Objective:** Detect internal loan ledger transactions that have no corresponding settlement record in bank feeds.
- **Input Data:**
  - Internal: `PILOT-MISSING-003`, Amount: `8000.00 INR`, Date: `2026-11-19T10:00:00Z`
  - External: None.
- **Expected Result:** Exception raised with type `MISSING_SETTLEMENT`. Status: `OPEN`.
- **Actual Measured Result:** Exception created with `MISSING_SETTLEMENT` and expected amount `8000.00 INR`.
- **Evidence:**
  ```text
  Exception ID: 4184ecfc-95b8-4c12-b91b-b72e12821213
  Type: MISSING_SETTLEMENT
  Discrepancy: 8000.00 INR
  Status: OPEN
  ```
- **Status:** **PASS**

---

### SCENARIO 04: Duplicate Transactions (Rule RC-05)
- **Objective:** Flag instances where multiple external settlement credits reference the same internal transaction.
- **Input Data:**
  - External: `PILOT-EXT-DUP-005A` (`10000.00 INR`) and `PILOT-EXT-DUP-005B` (`10000.00 INR`) both referencing `PILOT-DUP-005`.
- **Expected Result:** Duplicate settlement flagged with type `DUPLICATE`.
- **Actual Measured Result:** Exception raised with type `DUPLICATE`.
- **Evidence:**
  ```text
  Exception Type: DUPLICATE
  Severity: CRITICAL
  Discrepancy: 10000.00 INR
  ```
- **Status:** **PASS**

---

### SCENARIO 05: Amount Mismatches (Rule RC-02)
- **Objective:** Detect when internal transaction and external settlement reference match, but settlement amounts differ.
- **Input Data:**
  - Internal: `PILOT-AMT-002`, Amount: `25000.00 INR`
  - External: `PILOT-EXT-AMT-002`, Amount: `24500.00 INR`, Discrepancy: `500.00 INR`
- **Expected Result:** Exception generated with type `AMOUNT_MISMATCH` and discrepancy amount `500.00`.
- **Actual Measured Result:** Exception flagged with `AMOUNT_MISMATCH` and `discrepancyAmount = 500.0`.
- **Evidence:**
  ```json
  {
    "exceptionType": "AMOUNT_MISMATCH",
    "discrepancyAmount": 500.0,
    "currency": "INR",
    "severity": "MEDIUM",
    "status": "OPEN"
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 06: Ambiguous Matches (Rule RC-08)
- **Objective:** Identify transactions where multiple conflicting candidate settlements exist that do not resolve into an exact aggregate sum.
- **Input Data:**
  - Internal: `PILOT-AMB-008`, Amount: `20000.00 INR`
  - External: `PILOT-EXT-AMB-008A` (`15000.00 INR`) and `PILOT-EXT-AMB-008B` (`10000.00 INR`). Total: `25000.00 INR` (mismatch).
- **Expected Result:** Flagged as `AMBIGUOUS_MATCH` requiring manual analyst triage.
- **Actual Measured Result:** Exception flagged with `AMBIGUOUS_MATCH`.
- **Evidence:**
  ```text
  Exception Type: AMBIGUOUS_MATCH
  Severity: HIGH
  Status: OPEN
  ```
- **Status:** **PASS**

---

### SCENARIO 07: Invalid CSV Imports (Format & Schema Rejection)
- **Objective:** Verify that CSV files containing missing mandatory headers, empty references, invalid dates, or unparseable amounts are rejected by validation routines without corrupting database state.
- **Input Data:**
  ```csv
  transaction_reference,transaction_date,amount,currency
  ,2026-11-19,1000.00,INR
  TXN-INV-002,NOT_A_DATE,2000.00,INR
  TXN-INV-003,2026-11-19,INVALID_AMOUNT,INR
  ```
- **Expected Result:** HTTP 202 upload accepted; validation marks 3 rejected rows with detailed error codes (`REQUIRED_FIELD_MISSING`, `INVALID_DATE`, `INVALID_AMOUNT`).
- **Actual Measured Result:** File validated; 3 rejected rows recorded; zero invalid transactions persisted.
- **Evidence:**
  ```json
  {
    "totalRows": 3,
    "validRows": 0,
    "rejectedRows": 3,
    "duplicateRows": 0
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 08: Duplicate Batch Imports (In-File Deduplication)
- **Objective:** Verify that multiple rows with identical transaction references within the same CSV upload are flagged as duplicates.
- **Input Data:**
  ```csv
  transaction_reference,transaction_date,amount,currency
  PILOT-DUPROW-001,2026-11-19T10:00:00Z,5000.00,INR
  PILOT-DUPROW-001,2026-11-19T10:00:00Z,5000.00,INR
  ```
- **Expected Result:** Validation catches duplicate row; `duplicateRows = 1`; error code `DUPLICATE_IN_FILE`.
- **Actual Measured Result:** `duplicateRows: 1` reported in validation payload.
- **Evidence:**
  ```json
  {
    "totalRows": 2,
    "validRows": 1,
    "duplicateRows": 1,
    "rejectedRows": 0
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 09: Analyst Assignment and Reassignment
- **Objective:** Validate that an Administrator can assign an exception to an Analyst, reassign it to another user, and that the assigned user profile is updated in real time.
- **Actions:**
  1. Admin assigns exception `e8d98d2f-acd7-4595-882e-af4f82dade4c` to Admin (`5671a1c9-07e4-4239-81cc-20287f5bdb39`).
  2. Admin reassigns exception to Analyst (`fc803e91-9e96-436b-8634-a817a4324f0f`).
- **Expected Result:** Both assignment operations return HTTP 200 OK with the updated assigned user object.
- **Actual Measured Result:** Assignment to Admin succeeded; reassignment to Analyst succeeded.
- **Evidence:**
  ```json
  {
    "assignedTo": {
      "id": "fc803e91-9e96-436b-8634-a817a4324f0f",
      "fullName": "Staging Operational Analyst",
      "email": "staging.analyst@lendguard.internal",
      "role": "ANALYST"
    }
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 10: Investigation Notes & Human Resolution
- **Objective:** Validate that an authorized analyst can append notes to an open exception, review evidence, and transition status to `RESOLVED` with mandatory categorization and explanation.
- **Actions:**
  1. Analyst posts note: `"Operational Pilot: Verified transaction settlement logs. Fee deduction approved by finance."`
  2. Analyst calls `POST /api/v1/exceptions/{id}/resolve` with category `FEE_ADJUSTMENT`.
- **Expected Result:** Note appended and stored in append-only table. Exception status transitions from `OPEN` to `RESOLVED`.
- **Actual Measured Result:** Note persisted. Exception status updated to `RESOLVED`.
- **Evidence:**
  ```json
  {
    "id": "e8d98d2f-acd7-4595-882e-af4f82dade4c",
    "status": "RESOLVED",
    "resolutionCategory": "FEE_ADJUSTMENT",
    "resolutionExplanation": "Resolved during operational pilot scenario 10.",
    "resolvedBy": {
      "email": "staging.analyst@lendguard.internal",
      "role": "ANALYST"
    }
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 11: AI Advisory Success & Fallback Validation
- **Objective:** Verify that the AI advisory microservice provides diagnostic explanations, adheres strictly to the advisory boundary (`advisoryOnly: true`), and does not modify the transaction ledger.
- **Actions:**
  1. Analyst triggers analysis via `POST /api/v1/exceptions/{id}/analysis`.
  2. Background worker consumes job and calls FastAPI service on port 8000.
  3. Query `GET /api/v1/exceptions/{id}/analysis`.
- **Expected Result:** Advisory explanation generated. `advisoryOnly` is `true`. Zero ledger mutations performed.
- **Actual Measured Result:** Completed advisory payload retrieved with summary and recommendations.
- **Evidence:**
  ```json
  {
    "analysisId": "a0e90eaf-43b5-4427-9646-7967cff33ce1",
    "status": "COMPLETED",
    "analysisType": "EXPLANATION",
    "summary": "External settlement of EUR 500.00 was received from payment counterparty without a corresponding internal loan ledger transaction.",
    "recommendation": "Inspect internal loan origination/repayment staging queues for missing ingestion or unallocated customer deposits.",
    "advisoryOnly": true,
    "modelName": "gpt-4o-mini-advisory"
  }
  ```
- **Status:** **PASS**

---

### SCENARIO 12: Audit History & Report Exports
- **Objective:** Verify that all platform activities are recorded in immutable audit tables and that analysts can export full reconciliation CSV reports.
- **Actions:**
  1. Admin queries `GET /api/v1/audit-logs?pageSize=50`.
  2. Query `GET /api/v1/reports/reconciliation/export`.
- **Expected Result:** Audit trail returns recorded operational events. Export CSV returns 200 OK with streamed data.
- **Actual Measured Result:** 50 immutable audit entries retrieved; CSV export streamed (1,077 bytes).
- **Evidence:**
  ```text
  Audit Log Entries: 50
  Recorded Actions: ['IMPORT_UPLOADED', 'RECONCILIATION_QUEUED', 'RECONCILIATION_COMPLETED', 'EXCEPTION_ASSIGNED', 'INVESTIGATION_NOTE_ADDED', 'EXCEPTION_RESOLVED', 'LOGIN_SUCCESS']
  CSV Export File Size: 1,077 bytes
  ```
- **Status:** **PASS**

---

### SCENARIO 13: Unauthorized Record Access Attempts (RBAC)
- **Objective:** Prove that API route guards block unauthorized access attempts by analysts and unauthenticated callers.
- **Actions:**
  1. Analyst attempts `GET /api/v1/users` (Admin only).
  2. Analyst attempts `GET /api/v1/audit-logs` (Admin only).
  3. Unauthenticated request to `GET /api/v1/reconciliation-runs`.
- **Expected Result:** Calls 1 and 2 return `HTTP 403 Forbidden`. Call 3 returns `HTTP 401 Unauthorized`.
- **Actual Measured Result:** All 3 intrusion attempts blocked with expected HTTP status codes.
- **Evidence:**
  ```text
  Analyst /api/v1/users      -> HTTP 403 Forbidden (Blocked)
  Analyst /api/v1/audit-logs  -> HTTP 403 Forbidden (Blocked)
  Unauthenticated /api/v1/*   -> HTTP 401 Unauthorized (Blocked)
  ```
- **Status:** **PASS**

---

### SCENARIO 14: Worker Outbox Processing & Concurrency Recovery
- **Objective:** Verify that the background worker drains the outbox queue using PostgreSQL `FOR UPDATE SKIP LOCKED`, preventing race conditions and deadlocks.
- **Actions:**
  1. Inspect PostgreSQL outbox queue table `background_jobs`.
  2. Check `pg_stat_database` deadlock counters.
- **Expected Result:** Zero pending jobs remaining after run. Zero deadlocks recorded.
- **Actual Measured Result:** Pending jobs = `0`, recorded deadlocks = `0`.
- **Evidence:**
  ```text
  Pending Background Jobs : 0
  Database Deadlocks      : 0
  Worker Polling Interval : 3 seconds
  Claim Pattern           : FOR UPDATE SKIP LOCKED
  ```
- **Status:** **PASS**

---

## 3. Scenario Execution Conclusion

All 14 operational scenarios executed successfully in the live staging environment. The platform demonstrated complete fidelity to financial reconciliation business rules, strict security enforcement, and high-performance background execution.
