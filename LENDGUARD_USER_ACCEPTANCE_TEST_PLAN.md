# LENDGUARD AI — User Acceptance Testing (UAT) Plan & Evaluation Protocol
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Git Commit Hash:** `89117ee` (Base: `3b5aab3`)  
**Target Organization:** Novac Technology Solutions  
**Evaluation Cohort:** Real Operational Analysts, Operations Administrators, and Compliance Reviewers  
**Environment Target:** Staging Deployment Runtime (`http://localhost:5173`)  
**Document Governance:** Mandatory Evaluation Protocol — **Zero Simulated Feedback; Real Human Evaluation Only**  

---

## 1. UAT Objectives & Testing Charter

The User Acceptance Testing (UAT) phase transitions LendGuard AI from automated engineering verification into hands-on human evaluation by actual Novac Technology Solutions financial operations personnel.

### 1.1 Non-Fabrication & Real Evaluation Mandate
> [!IMPORTANT]
> **GOVERNANCE MANDATE: ZERO FABRICATED APPROVALS**  
> In accordance with financial software engineering ethics and audit standards:  
> - Automated scenario passes demonstrate technical functionality, **NOT human user acceptance**.  
> - No stakeholder sign-off or analyst approval may be reported until real Novac personnel complete the test suites detailed in this document.  
> - All feedback, ratings, usability scores, and defect reports must originate from actual human evaluators.

### 1.2 Core UAT Objectives
1. Verify that real operational analysts can navigate the platform intuitively without technical assistance.
2. Confirm that multi-pass reconciliation accurately resolves daily synthetic loan portfolios.
3. Evaluate the clarity, accuracy, and operational utility of AI-generated root-cause explanations.
4. Verify that human decision authority, maker-checker controls, and audit logging function smoothly in practice.
5. Capture defect reports, usability friction points, and feature enhancement requests from end-users.

---

## 2. Participant Persona Profiles & Cohort Setup

| Persona Role | Target Evaluator Profile | Target Sample Size | Responsibilities During UAT |
| :--- | :--- | :---: | :--- |
| **Operations Administrator** | Senior Financial Operations Manager | 2 Evaluators | User provisioning, batch ingestion, reconciliation dispatch, work allocation, audit review |
| **Reconciliation Analyst** | Junior to Mid-Level Loan Operations Analyst | 3 - 5 Evaluators | Exception review, investigation note logging, AI explanation evaluation, exception resolution |
| **Compliance Officer** | Internal Audit / Regulatory Specialist | 1 - 2 Evaluators | Tamper-evident audit inspection, CSV report verification, RBAC security testing |

---

## 3. Structured UAT Test Suites & Step-by-Step Script

### Test Suite 1: Batch Ingestion & Pre-Import Validation
- **Tester Role:** Operations Administrator
- **Procedure:**
  1. Log into `http://localhost:5173` using Administrator credentials.
  2. Navigate to **Imports** (`/imports`). Click **Upload New Batch**.
  3. Upload `internal_golden_dataset.csv` (Source: `INTERNAL`). Review validation preview. Click **Confirm & Import**.
  4. Upload `external_golden_dataset.csv` (Source: `EXTERNAL`). Review validation preview. Click **Confirm & Import**.
- **Expected Outcome:** Both batches validate with zero rejected rows and transition to status `IMPORTED`.
- **Pass/Fail Criteria:** Batches confirmed; record counts match source CSV rows.

---

### Test Suite 2: Multi-Pass Deterministic Reconciliation Run
- **Tester Role:** Operations Administrator
- **Procedure:**
  1. Navigate to **Reconciliation** (`/reconciliation`). Click **New Reconciliation Run**.
  2. Select the internal and external batches imported in Test Suite 1. Set Date Tolerance to `2 Days`.
  3. Click **Start Reconciliation**.
  4. Monitor run card until status updates to `COMPLETED`.
- **Expected Outcome:** Reconciliation completes in `< 5 seconds`. Displays 3 matches, 11 exceptions.
- **Pass/Fail Criteria:** Status is `COMPLETED`; zero system errors or unhandled exceptions.

---

### Test Suite 3: Exception Investigation & Analyst Assignment
- **Tester Role:** Operations Administrator -> Reconciliation Analyst
- **Procedure:**
  1. As Administrator, navigate to **Exceptions** (`/exceptions`).
  2. Locate the `AMOUNT_MISMATCH` exception (Discrepancy: `INR 500.00`).
  3. Click **Assign Exception** and assign to the evaluating Analyst's account.
  4. Analyst logs in and verifies that the assigned exception appears in their work queue.
- **Expected Outcome:** Exception status transitions to `IN_PROGRESS` with assigned analyst details.
- **Pass/Fail Criteria:** Assigned exception is visible to the analyst; assignment logged to audit trail.

---

### Test Suite 4: AI Diagnostic Advisory Review
- **Tester Role:** Reconciliation Analyst
- **Procedure:**
  1. Open the assigned `AMOUNT_MISMATCH` exception detail view.
  2. Click **Generate AI Advisory Explanation**.
  3. Review the generated root-cause summary, evidence, and resolution recommendations.
  4. Verify that the AI card renders the explicit banner: **ADVISORY ONLY — ZERO LEDGER WRITE PERMISSIONS**.
- **Expected Outcome:** Diagnostic summary clearly indicates that the INR 500.00 variance corresponds to a counterparty fee.
- **Pass/Fail Criteria:** Explanation generated in `< 3 seconds`; zero unauthorized status or ledger mutations.

---

### Test Suite 5: Human Resolution Workflow (Maker-Checker)
- **Tester Role:** Reconciliation Analyst
- **Procedure:**
  1. In the exception detail view, click **Add Note**.
  2. Enter: `"UAT Evaluation: Confirmed clearing surcharge deduction."` Click **Save Note**.
  3. Click **Resolve Exception**.
  4. Select Resolution Category: `FEE_ADJUSTMENT`.
  5. Enter Explanation: `"Approved settlement surcharge per clearing agreement."` Click **Confirm Resolution**.
- **Expected Outcome:** Note appears in the immutable timeline. Exception badge turns green: `RESOLVED`.
- **Pass/Fail Criteria:** Exception resolved with resolver name and timestamp recorded; cannot be re-opened without authorization.

---

### Test Suite 6: Compliance Audit & CSV Report Export
- **Tester Role:** Compliance Officer / Operations Administrator
- **Procedure:**
  1. Navigate to **Audit Logs** (`/audit-logs`).
  2. Verify that entries exist for: `IMPORT_UPLOADED`, `RECONCILIATION_QUEUED`, `EXCEPTION_ASSIGNED`, `INVESTIGATION_NOTE_ADDED`, `EXCEPTION_RESOLVED`.
  3. Navigate to **Reports** (`/reports`). Click **Export Report (CSV)**.
  4. Open downloaded CSV file in spreadsheet viewer.
- **Expected Outcome:** CSV file downloads with matching transaction counts, status columns, and resolution details.
- **Pass/Fail Criteria:** Audit trail is complete and tamper-evident; CSV export accurately reflects database state.

---

### Test Suite 7: RBAC & Security Boundary Verification
- **Tester Role:** Reconciliation Analyst
- **Procedure:**
  1. While logged in as Analyst, attempt to navigate to `/users` and `/audit-logs`.
  2. Observe system response.
- **Expected Outcome:** Access Denied / HTTP 403 Forbidden alert; analyst cannot view user directory or master audit logs.
- **Pass/Fail Criteria:** Privilege boundary strictly enforced; unauthorized route access blocked.

---

## 4. User Evaluation & Feedback Capture Form (For Novac Personnel)

Each participant must complete the rubric below upon finishing test execution:

```text
================================================================================
           LENDGUARD AI: USER ACCEPTANCE TESTING EVALUATION FORM
================================================================================
 Evaluator Name: ____________________________    Date: ________________________
 Professional Role: [ ] Operations Admin  [ ] Reconciliation Analyst  [ ] Auditor
 Organization: Novac Technology Solutions        Department: __________________

 Rate each dimension on a scale of 1 to 5 (1 = Poor / Broken, 5 = Excellent):

 1. Workflow Completion & Usability:
    [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5
    Was the workflow easy to follow from batch import to exception resolution?
    Comments: __________________________________________________________________

 2. Reconciliation Engine Speed & Accuracy:
    [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5
    Did the multi-pass matching correctly separate exact matches from discrepancies?
    Comments: __________________________________________________________________

 3. Exception Detail & Investigation Workspace:
    [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5
    Did the side-by-side comparison make identifying variances fast and intuitive?
    Comments: __________________________________________________________________

 4. AI Advisory Explanation Utility:
    [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5
    Was the AI diagnostic explanation clear, accurate, and operationally helpful?
    Comments: __________________________________________________________________

 5. Audit Trail & Defensibility:
    [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5
    Do you feel confident that the tamper-evident audit logs satisfy compliance?
    Comments: __________________________________________________________________

 6. Defects, Friction Points or Software Glitches Encountered:
    ____________________________________________________________________________
    ____________________________________________________________________________

 7. User Suggestions & Enhancements for Production:
    ____________________________________________________________________________
    ____________________________________________________________________________

 8. Final Acceptance Recommendation:
    [ ] ACCEPT UNCONDITIONALLY — Ready for live production deployment.
    [ ] ACCEPT CONDITIONALLY   — Software accepted; resolve cloud/SSO gates first.
    [ ] REJECT / REMEDIATE     — Critical usability or functional defects found.

 Evaluator Signature: ___________________________ Date: _______________________
================================================================================
```
