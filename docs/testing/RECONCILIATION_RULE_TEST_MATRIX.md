# LENDGUARD AI — Deterministic Reconciliation Rule Test Matrix (RC-01 to RC-08)

**Document Reference:** `docs/testing/RECONCILIATION_RULE_TEST_MATRIX.md`  
**Execution Timestamp:** 2026-11-19T11:40:56Z  
**Verification Status:** **100% PASSED (11/11 Rules & Edge Cases Verified)**  
**Environment:** ASP.NET Core 8 Web API, C# Background Worker, PostgreSQL 16 Cluster (Port 5433), Python FastAPI AI Advisory (Port 8000)

---

## 1. Executive Summary & Verification Scope

The LENDGUARD AI deterministic reconciliation engine was subjected to rigorous, automated verification using production-grade golden CSV datasets containing positive and negative test cases for all authoritative blueprint rules (`RC-01` through `RC-08`) alongside complex edge cases.

The reconciliation engine operates strictly under deterministic, transparent business logic. AI services remain purely advisory and are strictly prohibited from mutating transaction states or match determinations.

---

## 2. Test Fixtures & Golden Datasets

The verification suite executes against dedicated golden CSV fixtures located at:
- **Internal Loan Repayments:** [internal_golden_dataset.csv](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/tests/fixtures/reconciliation/internal_golden_dataset.csv)
- **External Bank Settlements:** [external_golden_dataset.csv](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/tests/fixtures/reconciliation/external_golden_dataset.csv)
- **Automated Test Runner:** [test_reconciliation_matrix.py](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/tests/reconciliation/test_reconciliation_matrix.py)
- **Machine-Readable JSON Output:** [reconciliation_results.json](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/tests/results/reconciliation_results.json)

---

## 3. Comprehensive Rule Verification Matrix

| Rule ID | Rule Name | Description & Preconditions | Expected Outcome | Actual Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **RC-01 / RC-02** | Exact Amount & Candidate Match | 1:1 match on reference/external reference, identical currency, identical amount, and timestamp within $\pm 2.0$ days tolerance window. | `EXACT` match, 100% confidence, status `MATCHED`. | Verified on `TXN-GOLD-EXACT-001` vs `EXT-GOLD-EXACT-001` ($15,000.00). Confidence: 100.00%. | **PASSED** |
| **RC-03** | Amount Mismatch Detection | 1:1 match on reference and currency, but internal amount ($25,000.00) differs from external amount ($24,500.00). | `AMOUNT_MISMATCH` exception, severity `HIGH`, discrepancy calculated. | Verified on `TXN-GOLD-AMT-MISMATCH-002`. Discrepancy amount: $500.00. Severity: High. | **PASSED** |
| **RC-04** | Missing External Settlement | Internal transaction exists with no matching candidate in the external settlement batch. | `MISSING_SETTLEMENT` exception, expected amount logged. | Verified on `TXN-GOLD-MISSING-003` ($8,000.00). Status flagged as `OPEN` exception. | **PASSED** |
| **RC-05** | Unmatched External Settlement | External settlement record exists with unknown reference or no matching internal transaction. | `UNMATCHED_EXTERNAL` exception, actual amount logged. | Verified on `EXT-GOLD-ORPHAN-004` ($12,000.00). Flagged as orphan external settlement. | **PASSED** |
| **RC-06** | Duplicate Record Detection | Multiple external records claim the exact same full amount against a single internal reference. | `DUPLICATE` exception flagged for all duplicate settlement candidates. | Verified on `EXT-GOLD-DUP-005A` and `EXT-GOLD-DUP-005B` ($10,000.00 each). Both flagged as duplicates. | **PASSED** |
| **RC-07 (Aggregate)** | Partial Settlement Aggregation | Multiple external records whose individual amounts sum exactly to the internal transaction amount ($18,000 + $12,000 = $30,000). | `AGGREGATE` match, 95% confidence, multi-member link. | Verified on `TXN-GOLD-AGG-006` matched against `EXT-GOLD-AGG-006A` and `EXT-GOLD-AGG-006B`. Confidence: 95.00%. | **PASSED** |
| **RC-07 (Partial)** | Incomplete Partial Settlement | Multiple external records whose aggregate sum ($20,000 + $15,000 = $35,000) is strictly less than internal expected amount ($50,000). | `PARTIAL_SETTLEMENT` exception, discrepancy logged ($15,000). | Verified on `TXN-GOLD-PARTIAL-007`. Discrepancy amount: $15,000.00. Status: Open. | **PASSED** |
| **RC-08 (Over)** | Ambiguous Over-Settlement | Aggregate external settlement sum exceeds internal expected amount ($15,000 + $10,000 = $25,000 > $20,000). | `AMBIGUOUS_MATCH` exception, severity `HIGH`. | Verified on `TXN-GOLD-AMB-008`. Discrepancy: $5,000.00. Routed for manual review. | **PASSED** |
| **RC-08 (Date)** | Date Tolerance Boundary | Amounts and references match, but date difference exceeds the $\pm 2.0$ days configured window (6 days diff). | `AMBIGUOUS_MATCH` exception, severity `MEDIUM`. | Verified on `TXN-GOLD-DATE-009` (2026-11-10 vs 2026-11-16). Exact match rejected due to tolerance. | **PASSED** |
| **EDGE-CURR** | Strict Currency Isolation | Internal record in `USD` ($500) and external record in `EUR` ($500) share reference `TXN-GOLD-CURR-010`. | Deliberately unmatched across currencies. | Zero cross-currency matches. Internal flagged as `MISSING_SETTLEMENT`, external as `UNMATCHED_EXTERNAL`. | **PASSED** |
| **EDGE-CONSUME**| Double Consumption Prevention | One external settlement (`EXT-GOLD-SHARED-011`) is targeted by two internal records (`011A` and `011B`). | Settlement allocated once; subsequent record flagged. | External record consumed by `011A`. `011B` correctly flagged as `MISSING_SETTLEMENT`. | **PASSED** |
| **EDGE-IDEMP** | Idempotency & Repeat Protection | Attempt to trigger a second reconciliation run for an already reconciled batch pair. | Rejected with HTTP 409 Conflict; zero duplicate records created. | Attempt to rerun returned `HTTP 409 CONFLICT`: *"A reconciliation run has already been completed for this batch pair."* | **PASSED** |

---

## 4. Verification Evidence & Output Summary

Execution of the automated reconciliation rule verification suite produced the following metrics:
- **Total Processed Internal Records:** 11
- **Total Processed External Records:** 14
- **Deterministic Matches Created:** 3 (`2 EXACT`, `1 AGGREGATE`)
- **Discrepancy Exceptions Created:** 11
- **Rule Verification Success Rate:** **100% (11/11 tests passing)**
- **System Integrity:** Zero orphaned foreign keys, zero duplicate matches, zero double-consumptions.
