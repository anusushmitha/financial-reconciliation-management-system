# LENDGUARD AI — Requirements Traceability Matrix (RTM)

**Document Reference:** `docs/REQUIREMENTS_TRACEABILITY_MATRIX.md`  
**Audit Baseline:** `LENDGUARD_AI_Post_MVP_Readiness_Execution_Specification.pdf` (19 November 2026)  
**Authoritative Blueprint:** `LENDGUARD_AI_Developer_Ready_Blueprint.pdf`  
**Audit Date:** 19 November 2026  

---

## 1. Traceability Status Definitions
- **VERIFIED**: Requirement implemented and independently tested with recorded evidence.
- **IMPLEMENTED**: Code/configuration exists, but required verification is incomplete.
- **PARTIAL**: Only a subset of the requirement is implemented or verified.
- **MISSING**: No adequate implementation exists.
- **BLOCKED**: Cannot be completed because a documented dependency, credential, authorization or infrastructure is unavailable.
- **NOT APPLICABLE**: Formally justified with documented rationale.

---

## 2. Requirements Traceability Matrix

| Req ID | Requirement Description | Implementation Module | Source File(s) | Verification Evidence | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **AUTH-01** | User authentication with secure password hashing (BCrypt) | Backend API | `AuthController.cs`, `AuthService.cs` | `AuthenticationTests.cs`, `comprehensive_18_screens.spec.ts` | **VERIFIED** |
| **AUTH-02** | Role-Based Access Control (`ADMIN`, `ANALYST`) | Frontend & API | `App.tsx`, `ApiControllerBase.cs` | `comprehensive_18_screens.spec.ts` (403 tests) | **VERIFIED** |
| **AUTH-03** | Password reset token generation, single-use & 15m expiration | Backend API | `AuthService.cs`, `001_initial_schema.sql` | `AuthenticationTests.cs`, `comprehensive_18_screens.spec.ts` (S02/S03) | **VERIFIED** |
| **SEC-01** | BOLA / IDOR Record-Level Authorization for Analysts | Backend API / App | `ExceptionService.cs`, `ExceptionsController.cs` | `ExceptionWorkflowTests.cs` (`IDOR_AnalystCannotAccess...`) | **VERIFIED** |
| **USER-01** | User provisioning, viewing, editing, and activation toggle | Backend API / UI | `UsersController.cs`, `UserManagementPage.tsx` | `comprehensive_18_screens.spec.ts` (S16/S17) | **VERIFIED** |
| **USER-02** | Prevent self-deactivation & disabling last administrator | Backend API | `UserService.cs` | `e2e_rbac.spec.ts` (Admin Forbidden Actions) | **VERIFIED** |
| **FILE-01** | CSV file ingestion (Internal Repayments & External Settlements) | Backend API / UI | `ImportsController.cs`, `ImportsPage.tsx` | `test_reconciliation_matrix.py`, S05 E2E | **VERIFIED** |
| **FILE-02** | Row-level syntax, decimal, date, and reference validation | Application Service | `ImportService.cs` | `CsvValidationTests.cs` | **VERIFIED** |
| **FILE-03** | Batch validation summary, error inspection, and confirmation | Application Service | `ImportService.cs`, `ValidationResultsPage.tsx` | `comprehensive_18_screens.spec.ts` (S06) | **VERIFIED** |
| **FILE-04** | Streaming 25MB file size limit & 50,000 max row cap | Infrastructure | `FileStorageService.cs`, `ImportService.cs` | `FILE_UPLOAD_AND_STORAGE_SECURITY.md` | **VERIFIED** |
| **TXN-01** | Transaction search, pagination, and multi-criteria filtering | Backend API / UI | `TransactionsController.cs`, `TransactionListPage.tsx` | `comprehensive_18_screens.spec.ts` (S07) | **VERIFIED** |
| **TXN-02** | Transaction raw JSON data and audit link inspection | Backend API / UI | `TransactionDetailPage.tsx` | `comprehensive_18_screens.spec.ts` (S08) | **VERIFIED** |
| **RC-01** | Exact Candidate Identification on Reference and Currency | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-02** | Exact Amount Match within configurable date tolerance (default: 0 days) | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-03** | Amount Mismatch Detection (`AMOUNT_MISMATCH`) | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-04** | Missing External Settlement Detection (`MISSING_SETTLEMENT`) | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-05** | Unmatched External Settlement Detection (`UNMATCHED_EXTERNAL`) | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-06** | Duplicate Record Detection (`DUPLICATE`) | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-07** | Partial Settlement Aggregation & Incomplete Detection | Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-08** | Ambiguous Match & Date Tolerance Boundary (`AMBIGUOUS_MATCH`)| Recon Engine | `ReconciliationService.cs` | `ReconciliationEngineTests.cs`, `test_reconciliation_matrix.py` | **VERIFIED** |
| **RC-09** | Prevention of Double Settlement Consumption | Recon Engine | `ReconciliationService.cs` | `test_reconciliation_matrix.py` (EDGE-DOUBLE-CONSUME) | **VERIFIED** |
| **RC-10** | Reconciliation Run Idempotency (Prevent Duplicate Runs) | Recon Engine | `ReconciliationService.cs` | `test_reconciliation_matrix.py` (EDGE-IDEMPOTENCY) | **VERIFIED** |
| **EXC-01** | Exception Queue workspace with severity and status filters | Backend API / UI | `ExceptionsController.cs`, `ExceptionListPage.tsx` | `comprehensive_18_screens.spec.ts` (S11) | **VERIFIED** |
| **EXC-02** | Workload assignment and reassignment | Backend API / UI | `ExceptionsController.cs`, `ExceptionDetailPage.tsx` | `ExceptionWorkflowTests.cs` | **VERIFIED** |
| **EXC-03** | Permanent append-only investigation notes | Infrastructure | `ExceptionService.cs`, `002_immutability_triggers.sql` | `test_audit_immutability.py`, S12 E2E note posting | **VERIFIED** |
| **EXC-04** | Human resolution with required category and audit explanation | Backend API / UI | `ExceptionService.cs`, `ExceptionDetailPage.tsx` | `ExceptionWorkflowTests.cs`, `test_ai_boundary_and_fallback.py` | **VERIFIED** |
| **AI-01** | Stateless Python FastAPI microservice on port 8000 | AI Service | `app/main.py`, `app/api/routes.py` | `test_ai_boundary_and_fallback.py` (100% pass) | **VERIFIED** |
| **AI-02** | Advisory-only anomaly scoring and exception explanation | AI Service | `anomaly_detector.py`, `llm_explainer.py` | `test_ai_boundary_and_fallback.py` | **VERIFIED** |
| **AI-03** | Resilient heuristic fallback when AI service is unavailable | Backend API | `AiClientService.cs` | `test_ai_boundary_and_fallback.py` | **VERIFIED** |
| **AI-04** | Zero customer PII or credentials transmitted to AI | AI Service | `ExplanationEvidence.cs`, `requests.py` | `test_ai_boundary_and_fallback.py` | **VERIFIED** |
| **AUD-01** | Comprehensive audit logging for all critical platform actions | Backend API | `AuditService.cs`, `audit_logs` | `comprehensive_18_screens.spec.ts` (S15) | **VERIFIED** |
| **AUD-02** | Database trigger-enforced immutability for audit logs | Database Engine | `002_immutability_triggers.sql` | `test_audit_immutability.py` (UPDATE/DELETE rejected) | **VERIFIED** |
| **RPT-01** | Reconciliation and Exception summary reports | Backend API / UI | `ReportsController.cs`, `ReportsPage.tsx` | `comprehensive_18_screens.spec.ts` (S13/S14) | **VERIFIED** |
| **RPT-02** | Culture-invariant CSV export with exact decimal precision | Backend API | `ReportService.cs` | `test_decimal_precision.py` (147 amounts verified) | **VERIFIED** |
| **OUT-01** | Transactional background job queue using SKIP LOCKED | Background Worker | `Worker.cs`, `background_jobs` | `OutboxConcurrencyStressTests.cs` | **VERIFIED** |
| **OUT-02** | Automated stuck-job crash recovery past 5 minutes | Background Worker | `Worker.cs` | `OutboxConcurrencyStressTests.cs` | **VERIFIED** |
| **FIN-01** | PostgreSQL NUMERIC(18,2) and C# decimal (zero float/double) | DB / Backend | Domain entities & migrations | `test_decimal_precision.py` (0 float drift) | **VERIFIED** |
| **OPS-01** | Disaster recovery covering all 13 tables + persistent file storage | Scripts / DB | `backup.ps1`, `restore.ps1` | `test_disaster_recovery.py` (13/13 tables, 0 loss) | **VERIFIED** |
| **OPS-02** | Realistic API Throughput and Latency Percentiles Under Load | API Engine | `load_test_realistic.py` | `performance_results.json` (757.2 RPS, P95=16.8ms) | **VERIFIED** |
| **OPS-03** | CI/CD Automated Quality Gates Pipeline | DevOps | `.github/workflows/ci.yml`, `CI_CD_AND_RELEASE_PROCESS.md` | Pipeline configuration verified | **VERIFIED** |
| **OPS-04** | Incident Response & Operational Troubleshooting Runbooks | Operations | `INCIDENT_RESPONSE_RUNBOOK.md`, `OPERATIONAL_TROUBLESHOOTING_MATRIX.md` | Runbooks created and aligned | **VERIFIED** |
| **LIFECYCLE-01** | .NET 10 LTS Target Migration | Framework | `LendGuard.sln` | Host has .NET 8.0.428; .NET 10 not installed on host | **BLOCKED** |
| **BANK-01** | Real Core Banking & Payment Gateway Live Connectors | Integration | N/A (Synthetic test boundary) | Production bank credentials/agreements not authorized | **BLOCKED** |
