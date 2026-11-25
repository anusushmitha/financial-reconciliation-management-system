# LENDGUARD AI — Live Demonstration Script & Presenter Runbook
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Git Commit Hash:** `b749c73` (Base: `3b5aab3`)  
**Audience:** Novac Technology Solutions Leadership & Technical Stakeholders  
**Demo Target URL:** `http://localhost:5173` (Vite Frontend / Port 5000 API)  
**Estimated Run Time:** 20 - 25 Minutes  

---

## 1. Presenter Setup & Demonstration Guidelines

### 1.1 Credential & Security Hygiene
- **Never display real production passwords or internal tokens on screen.**
- Use designated staging demonstration accounts:
  - **Administrator:** `staging.admin@lendguard.internal` (Role: `ADMIN`)
  - **Analyst:** `staging.analyst@lendguard.internal` (Role: `ANALYST`)
- Synthetic demonstration files are located in `tests/fixtures/reconciliation/`:
  - `internal_golden_dataset.csv`
  - `external_golden_dataset.csv`

### 1.2 Demonstration Flow Summary
```
+-----------------------------------------------------------------------------------+
|                        LIVE DEMONSTRATION WORKFLOW STAGES                         |
+-----------------------------------------------------------------------------------+
 [ACT 1] System Login & Security Route Guard Demonstration (Admin vs Analyst)
 [ACT 2] High-Integrity Batch Ingestion & Pre-Import Validation
 [ACT 3] Outbox-Driven Deterministic Reconciliation Execution
 [ACT 4] Exception Investigation Queue & Analyst Assignment
 [ACT 5] Side-by-Side Transaction Review & Immutable Investigation Notes
 [ACT 6] AI Advisory Root-Cause Diagnosis (Advisory-Only Boundary Check)
 [ACT 7] Human-Controlled Exception Resolution Workflow
 [ACT 8] Immutable Audit Trail Inspection & CSV Reconciliation Report Export
```

---

## 2. Turn-by-Turn Presenter Script & Action Matrix

### ACT 1: Authentication & Security Boundary Demonstration
- **Objective:** Demonstrate that the platform enforces zero-default-credential security and strict role-based access control (RBAC).

#### Step 1.1: Demonstrate Rejection of Default Development Credentials
- **Presenter Narration:**
  > *"Good morning, leadership team. Before showing the workflow, I want to demonstrate our security baseline. In standard development builds, systems often leave default seed accounts active. In LendGuard AI's staging release, `SEED_TEST_USERS` is strictly set to false. Watch what happens if I attempt to authenticate with the default `admin@example.com` account."*
- **UI Action:**
  - Navigate to `http://localhost:5173/login`.
  - Enter Email: `admin@example.com`, Password: `Password123!`. Click **Sign In**.
- **Expected Screen & Outcome:**
  - Red error alert banner: `"Invalid email or password"`.
  - HTTP `POST /api/v1/auth/login` returns `HTTP 401 Unauthorized`.
- **Technical Validation:** Bypassed database seeder; zero default credentials exist in PostgreSQL.
- **Fallback / Recovery:** If the request hangs, verify API process on port 5000 via terminal: `curl http://localhost:5000/health`.

---

#### Step 1.2: Authenticate as Staging Administrator
- **Presenter Narration:**
  > *"Now, I authenticate using our cryptographically provisioned staging administrator account. Notice that upon sign-in, the browser receives a signed JWT bearer token with strict 120-minute expiration."*
- **UI Action:**
  - Enter Email: `staging.admin@lendguard.internal`.
  - Enter Password: *(Presenter enters staging admin password)*. Click **Sign In**.
- **Expected Screen & Outcome:**
  - Navigation to Executive Dashboard (`/dashboard`).
  - Metric cards display active staging metrics: Total Batches, Match Rate, Open Exceptions.
- **Technical Validation:** Token payload decodes with claim `role: "ADMIN"`.

---

### ACT 2: High-Integrity Batch Ingestion & Pre-Import Validation
- **Objective:** Show dual-source ingestion and demonstrate that bad data is rejected before database insertion.

#### Step 2.1: Navigate to Batch Import
- **Presenter Narration:**
  > *"Reconciliation begins with multi-source ingestion. LendGuard AI ingests two distinct feeds: internal lending transactions from our loan origination system, and external settlement reports from our clearing bank."*
- **UI Action:**
  - Click on **Imports** in the navigation sidebar (`/imports`).
  - Click the **Upload New Batch** button.

---

#### Step 2.2: Ingest Internal Loan Ledger Batch
- **Presenter Narration:**
  > *"First, I select our internal lending dataset. Notice that as soon as the file is selected, LendGuard AI calculates a SHA-256 cryptographic hash and runs an automated schema validation check."*
- **UI Action:**
  - Set Source Type to `INTERNAL`.
  - Select file: `internal_golden_dataset.csv`.
  - Click **Upload & Validate**.
- **Expected Screen & Outcome:**
  - File uploaded; validation preview modal opens showing **11 Valid Rows, 0 Errors**.
  - Click **Confirm & Import**.
  - Batch status transitions to `IMPORTED`.

---

#### Step 2.3: Ingest External Settlement Batch
- **Presenter Narration:**
  > *"Next, we ingest the corresponding settlement report from our payment counterparty."*
- **UI Action:**
  - Click **Upload New Batch**.
  - Set Source Type to `EXTERNAL`.
  - Select file: `external_golden_dataset.csv`.
  - Click **Upload & Validate**, then **Confirm & Import**.
- **Expected Screen & Outcome:**
  - Batch validated: **14 Valid Rows, 0 Errors**. Status transitions to `IMPORTED`.

---

### ACT 3: Outbox-Driven Deterministic Reconciliation Run
- **Objective:** Demonstrate high-speed, non-blocking asynchronous reconciliation.

#### Step 3.1: Trigger Reconciliation Execution
- **Presenter Narration:**
  > *"Now, we pair these two batches and execute our deterministic rules engine. Notice that the web request returns immediately in under 50 milliseconds because the job is dispatched via PostgreSQL's Transactional Outbox pattern. A background worker claims the job using `FOR UPDATE SKIP LOCKED`, preventing web timeouts and row contention."*
- **UI Action:**
  - Navigate to **Reconciliation** (`/reconciliation`).
  - Click **New Reconciliation Run**.
  - Select Internal Batch and External Batch from dropdowns. Set Date Tolerance to `2 Days`.
  - Click **Start Reconciliation**.
- **Expected Screen & Outcome:**
  - Run initiated with status `QUEUED`, updating to `COMPLETED` within 3 seconds.
  - Results card displays: **Matches: 3**, **Exceptions: 11**, **Run Duration: ~3,022 ms**.
- **Technical Talking Point:**
  > *"Notice the entity resolution: The 3 matches represent 7 raw transactions (including exact pairs and a multi-credit aggregate match). The 11 exceptions represent the remaining 18 transactions. Exactly 25 out of 25 transactions are accounted for."*

---

### ACT 4: Exception Queue & Analyst Assignment (Maker-Checker)
- **Objective:** Demonstrate administrative work allocation and RBAC separation.

#### Step 4.1: Review Open Exceptions & Assign Task
- **Presenter Narration:**
  > *"LendGuard AI segregates administrative oversight from operational investigation. Here in the Exceptions view, the administrator sees all 11 discrepancies. I will assign our primary fee discrepancy exception to our operational analyst."*
- **UI Action:**
  - Navigate to **Exceptions** (`/exceptions`).
  - Filter by Status: `OPEN`, Type: `AMOUNT_MISMATCH`.
  - Locate exception with Discrepancy Amount `INR 500.00`. Click **Assign**.
  - Select `staging.analyst@lendguard.internal` from the dropdown. Click **Confirm Assignment**.
- **Expected Screen & Outcome:**
  - Assigned user updates to `staging.analyst@lendguard.internal`.
  - Audit trail immediately logs an `EXCEPTION_ASSIGNED` event.

---

### ACT 5: Side-by-Side Investigation & Analyst Note Logging
- **Objective:** Show the analyst's investigation workspace and append-only note immutability.

#### Step 5.1: Switch Persona to Operational Analyst
- **Presenter Narration:**
  > *"I will now sign out and sign in as our operational analyst. Notice that our route guards now restrict my access: I can no longer access the user management directory or administrative audit logs."*
- **UI Action:**
  - Log out and sign in as `staging.analyst@lendguard.internal`.
  - Attempt to click **Users** (or navigate to `/users`): Route redirects or shows Access Denied (`HTTP 403`).
  - Navigate to **Exceptions** (`/exceptions`).
- **Expected Screen & Outcome:**
  - Analyst sees their assigned work queue.
  - Click on the assigned `AMOUNT_MISMATCH` exception.

---

#### Step 5.2: Side-by-Side Transaction Review & Add Note
- **Presenter Narration:**
  > *"The analyst sees a side-by-side comparison: Internal expected amount is INR 25,000.00; External settlement amount is INR 24,500.00. The discrepancy is exactly INR 500.00. Before resolving, the analyst logs an investigation note."*
- **UI Action:**
  - Click **Add Note**.
  - Enter: `"Reviewed bank settlement schedule. Confirmed clearing charge deduction of INR 500.00."`
  - Click **Save Note**.
- **Expected Screen & Outcome:**
  - Note appears in the timeline with timestamp and analyst name.
  - **Technical Talking Point:** *"This note is written to an append-only table. A PostgreSQL trigger permanently blocks any SQL update or delete attempt."*

---

### ACT 6: AI Advisory Root-Cause Diagnosis
- **Objective:** Demonstrate AI diagnostic utility and prove non-autonomous safety boundaries.

#### Step 6.1: Request AI Diagnostic Explanation
- **Presenter Narration:**
  > *"For complex disputes, analysts can request AI assistance. The AI microservice analyzes the transaction attributes against historical patterns to produce a root-cause explanation."*
- **UI Action:**
  - Click **Generate AI Advisory Explanation**.
- **Expected Screen & Outcome:**
  - Processing indicator pulses for ~1 second.
  - AI Advisory card renders:
    - **Summary:** *"Settlement amount variance of INR 500.00 identified between internal repayment and external counterparty settlement."*
    - **Evidence:** `discrepancyAmount: 500.00`, `currency: INR`.
    - **Recommendation:** *"Verify whether clearing counterparty deducted standard processing surcharge. If confirmed, apply FEE_ADJUSTMENT resolution."*
    - **Security Badge:** Rendered banner: **ADVISORY ONLY — ZERO LEDGER WRITE PERMISSIONS**.
- **Presenter Narration:**
  > *"Notice that the AI did NOT resolve the exception, did NOT change the status, and did NOT modify ledger balances. The AI advises; the human decides."*

---

### ACT 7: Human-Controlled Resolution Workflow
- **Objective:** Execute an operational resolution with mandatory justification.

#### Step 7.1: Resolve Exception
- **Presenter Narration:**
  > *"With the AI's diagnostic advice verified against bank documentation, the analyst executes the formal resolution."*
- **UI Action:**
  - Click **Resolve Exception**.
  - Select Resolution Category: `FEE_ADJUSTMENT`.
  - Enter Explanation: `"Approved settlement fee deduction of INR 500.00 per clearing agreement."`
  - Click **Confirm Resolution**.
- **Expected Screen & Outcome:**
  - Exception status badge turns green: `RESOLVED`.
  - Resolver details, resolution category, and timestamp permanently stamped.

---

### ACT 8: Immutable Audit Trail & CSV Report Export
- **Objective:** Conclude with compliance defensibility and executive export reporting.

#### Step 8.1: Inspect Immutable Audit Trail
- **Presenter Narration:**
  > *"To conclude, let's verify our regulatory audit trail. I sign back in as Administrator to inspect the master audit ledger."*
- **UI Action:**
  - Sign back in as `staging.admin@lendguard.internal`.
  - Navigate to **Audit Logs** (`/audit-logs`).
- **Expected Screen & Outcome:**
  - Chronological audit ledger renders: `IMPORT_UPLOADED`, `RECONCILIATION_QUEUED`, `EXCEPTION_ASSIGNED`, `INVESTIGATION_NOTE_ADDED`, `EXCEPTION_RESOLVED`.

---

#### Step 8.2: Stream Reconciliation CSV Export
- **Presenter Narration:**
  > *"Finally, we generate our financial management export. With one click, the system streams a comprehensive CSV report matching our database counts."*
- **UI Action:**
  - Click **Export Report (CSV)** on the top right.
- **Expected Screen & Outcome:**
  - Browser downloads `reconciliation_report.csv` instantly.
  - Presenter opens CSV in Excel/preview showing exact transaction IDs, match statuses, and discrepancy resolutions.

---

## 3. Presenter Recovery & Troubleshooting Guide

| Potential Glitch | Root Cause | Immediate Recovery Action |
| :--- | :--- | :--- |
| **API request times out** | Background dotnet service paused | Open terminal: `task-2090` status check; restart API via PowerShell in 5 seconds. |
| **Worker does not process run** | Worker queue polling delay | Worker polls every 3s. Wait 3 seconds; check worker logs: `task-2092`. |
| **AI explanation delayed** | Python FastAPI cold start | AI service response takes ~1s. If timeout occurs, deterministic fallback activates automatically. |
| **Browser session expired** | 120-minute JWT timeout reached | Simply sign in again; session resumes instantly at current screen. |
