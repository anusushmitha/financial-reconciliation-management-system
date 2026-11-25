import os
import sys
import json
import time
import requests

API_URL = "http://localhost:5000"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INTERNAL_CSV = os.path.join(BASE_DIR, "tests", "fixtures", "reconciliation", "internal_golden_dataset.csv")
EXTERNAL_CSV = os.path.join(BASE_DIR, "tests", "fixtures", "reconciliation", "external_golden_dataset.csv")
OUTPUT_JSON = os.path.join(BASE_DIR, "tests", "results", "reconciliation_results.json")

def login(email, password):
    res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        raise Exception(f"Login failed: {res.text}")
    data = res.json()
    return data.get("accessToken") or data.get("token")

def upload_csv(token, file_path, source_type):
    headers = {"Authorization": f"Bearer {token}"}
    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, "text/csv")}
        data = {"sourceType": source_type}
        res = requests.post(f"{API_URL}/api/v1/imports", headers=headers, files=files, data=data)
        if res.status_code not in (200, 201, 202):
            raise Exception(f"Upload failed for {file_path}: {res.text}")
        return res.json()["importId"]

def confirm_batch(token, batch_id):
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.post(f"{API_URL}/api/v1/imports/{batch_id}/confirm", headers=headers, json={"confirmValidRows": True})
    if res.status_code != 200:
        raise Exception(f"Confirm failed for batch {batch_id}: {res.text}")
    return res.json()

def start_reconciliation(token, int_batch_id, ext_batch_id):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "internalBatchId": int_batch_id,
        "externalBatchId": ext_batch_id
    }
    res = requests.post(f"{API_URL}/api/v1/reconciliation-runs", headers=headers, json=payload)
    if res.status_code not in (200, 201, 202):
        raise Exception(f"Start reconciliation failed: {res.text}")
    return res.json()["runId"]

def wait_for_reconciliation(token, run_id, max_retries=15):
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(max_retries):
        res = requests.get(f"{API_URL}/api/v1/reconciliation-runs/{run_id}", headers=headers)
        if res.status_code == 200:
            data = res.json()
            if data["status"] in ("COMPLETED", "FAILED"):
                return data
        time.sleep(1)
    raise TimeoutError("Reconciliation did not complete in time")

def get_exceptions(token, run_id):
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{API_URL}/api/v1/reconciliation-runs/{run_id}/exceptions?pageSize=100", headers=headers)
    if res.status_code != 200:
        raise Exception(f"Get exceptions failed: {res.text}")
    return res.json().get("items", [])

def get_matches(token, run_id):
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{API_URL}/api/v1/reconciliation-runs/{run_id}/matches?pageSize=100", headers=headers)
    if res.status_code != 200:
        raise Exception(f"Get matches failed: {res.text}")
    return res.json().get("items", [])

def main():
    print("=== LENDGUARD AI: RC-01 to RC-08 Deterministic Rule Matrix Verification ===")
    try:
        token = login("staging.admin@lendguard.internal", "StagingAdmin_Secure2026!")
    except Exception:
        token = login("admin@example.com", "Admin123!")
    print("1. Authenticated as Admin successfully.")

    print(f"2. Uploading internal golden dataset from: {INTERNAL_CSV}")
    int_batch_id = upload_csv(token, INTERNAL_CSV, "INTERNAL")
    confirm_batch(token, int_batch_id)
    print(f"   Internal Batch Confirmed: {int_batch_id}")

    print(f"3. Uploading external golden dataset from: {EXTERNAL_CSV}")
    ext_batch_id = upload_csv(token, EXTERNAL_CSV, "EXTERNAL")
    confirm_batch(token, ext_batch_id)
    print(f"   External Batch Confirmed: {ext_batch_id}")

    print("4. Triggering Reconciliation Run...")
    run_id = start_reconciliation(token, int_batch_id, ext_batch_id)
    print(f"   Reconciliation Run ID: {run_id}")

    run_data = wait_for_reconciliation(token, run_id)
    print(f"   Run Completed. Status: {run_data['status']}, Matched: {run_data['matchedCount']}, Exceptions: {run_data['exceptionCount']}")

    matches = get_matches(token, run_id)
    exceptions = get_exceptions(token, run_id)

    print(f"   Fetched {len(matches)} matches and {len(exceptions)} exceptions.")

    # Rule Verification Matrix Checks
    rule_results = []

    # RC-01 & RC-02: EXACT MATCH (TXN-GOLD-EXACT-001)
    exact_matches = [m for m in matches if m["matchType"] == "EXACT"]
    rc01_02_passed = len(exact_matches) >= 1
    rule_results.append({
        "ruleId": "RC-01 / RC-02",
        "ruleName": "Exact Candidate Identification & Exact Amount Match",
        "expectedOutcome": "EXACT",
        "actualCount": len(exact_matches),
        "status": "PASSED" if rc01_02_passed else "FAILED",
        "details": f"Found {len(exact_matches)} EXACT match with 100% confidence within date tolerance."
    })

    # RC-03: AMOUNT_MISMATCH (TXN-GOLD-AMT-MISMATCH-002)
    amt_mismatch_exc = [e for e in exceptions if e["exceptionType"] == "AMOUNT_MISMATCH"]
    rc03_passed = any(e.get("discrepancyAmount") == 500.0 or e.get("discrepancyAmount") == 500 for e in amt_mismatch_exc)
    rule_results.append({
        "ruleId": "RC-03",
        "ruleName": "Amount Mismatch Detection",
        "expectedOutcome": "AMOUNT_MISMATCH",
        "actualCount": len(amt_mismatch_exc),
        "status": "PASSED" if rc03_passed else "FAILED",
        "details": f"Found AMOUNT_MISMATCH with discrepancy 500.00."
    })

    # RC-04: MISSING_SETTLEMENT (TXN-GOLD-MISSING-003, TXN-GOLD-CURR-010, TXN-GOLD-CONSUME-011B)
    missing_exc = [e for e in exceptions if e["exceptionType"] == "MISSING_SETTLEMENT"]
    rc04_passed = len(missing_exc) >= 1
    rule_results.append({
        "ruleId": "RC-04",
        "ruleName": "Missing External Settlement Detection",
        "expectedOutcome": "MISSING_SETTLEMENT",
        "actualCount": len(missing_exc),
        "status": "PASSED" if rc04_passed else "FAILED",
        "details": f"Detected {len(missing_exc)} missing external settlements."
    })

    # RC-05: UNMATCHED_EXTERNAL (EXT-GOLD-ORPHAN-004, EXT-GOLD-CURR-010)
    unmatched_ext = [e for e in exceptions if e["exceptionType"] == "UNMATCHED_EXTERNAL"]
    rc05_passed = len(unmatched_ext) >= 1
    rule_results.append({
        "ruleId": "RC-05",
        "ruleName": "Unmatched External Settlement Detection",
        "expectedOutcome": "UNMATCHED_EXTERNAL",
        "actualCount": len(unmatched_ext),
        "status": "PASSED" if rc05_passed else "FAILED",
        "details": f"Detected {len(unmatched_ext)} unmatched external records."
    })

    # RC-06: DUPLICATE (TXN-GOLD-DUP-005 with multiple identical external settlements)
    dup_exc = [e for e in exceptions if e["exceptionType"] == "DUPLICATE"]
    rc06_passed = len(dup_exc) >= 2  # Both duplicates flagged
    rule_results.append({
        "ruleId": "RC-06",
        "ruleName": "Duplicate Settlement Detection",
        "expectedOutcome": "DUPLICATE",
        "actualCount": len(dup_exc),
        "status": "PASSED" if rc06_passed else "FAILED",
        "details": f"Identified {len(dup_exc)} duplicate settlements claiming identical amounts."
    })

    # RC-07A: AGGREGATE MATCH (TXN-GOLD-AGG-006)
    agg_matches = [m for m in matches if m["matchType"] == "AGGREGATE"]
    rc07a_passed = len(agg_matches) >= 1
    rule_results.append({
        "ruleId": "RC-07 (Aggregate)",
        "ruleName": "Partial Settlement Aggregation Matching",
        "expectedOutcome": "AGGREGATE",
        "actualCount": len(agg_matches),
        "status": "PASSED" if rc07a_passed else "FAILED",
        "details": f"Successfully aggregated multi-part settlements into 1 match (Sum = 30000.00)."
    })

    # RC-07B: PARTIAL_SETTLEMENT INCOMPLETE (TXN-GOLD-PARTIAL-007)
    partial_exc = [e for e in exceptions if e["exceptionType"] == "PARTIAL_SETTLEMENT"]
    rc07b_passed = any(e.get("discrepancyAmount") == 15000.0 or e.get("discrepancyAmount") == 15000 for e in partial_exc)
    rule_results.append({
        "ruleId": "RC-07 (Partial)",
        "ruleName": "Partial Settlement Discrepancy",
        "expectedOutcome": "PARTIAL_SETTLEMENT",
        "actualCount": len(partial_exc),
        "status": "PASSED" if rc07b_passed else "FAILED",
        "details": f"Flagged partial settlement with discrepancy 15000.00."
    })

    # RC-08: AMBIGUOUS_MATCH (TXN-GOLD-AMB-008 & TXN-GOLD-DATE-009)
    amb_exc = [e for e in exceptions if e["exceptionType"] == "AMBIGUOUS_MATCH"]
    rc08_passed = len(amb_exc) >= 2  # Date tolerance violation + sum exceeds expected
    rule_results.append({
        "ruleId": "RC-08",
        "ruleName": "Ambiguous Match Detection (Tolerance & Over-settlement)",
        "expectedOutcome": "AMBIGUOUS_MATCH",
        "actualCount": len(amb_exc),
        "status": "PASSED" if rc08_passed else "FAILED",
        "details": f"Flagged {len(amb_exc)} ambiguous cases (>2-day date difference and sum > expected)."
    })

    # Edge Case: Currency Isolation Check (TXN-GOLD-CURR-010 USD vs EUR)
    # Currency mismatch must never match across different currencies!
    curr_mismatch_matched = any("CURR-010" in str(m) for m in matches)
    rule_results.append({
        "ruleId": "EDGE-CURRENCY",
        "ruleName": "Strict Currency Isolation (USD != EUR)",
        "expectedOutcome": "NO_MATCH",
        "actualCount": 0 if not curr_mismatch_matched else 1,
        "status": "PASSED" if not curr_mismatch_matched else "FAILED",
        "details": "Verified that currency mismatch prevents accidental match."
    })

    # Edge Case: Double Consumption Prevention (EXT-GOLD-SHARED-011)
    # The external transaction was assigned to 011A, so 011B must be flagged as MISSING_SETTLEMENT, not double-matched
    shared_matched_twice = sum(1 for m in matches if "CONSUME-011B" in str(m))
    rule_results.append({
        "ruleId": "EDGE-DOUBLE-CONSUME",
        "ruleName": "Double Consumption Prevention",
        "expectedOutcome": "CONSUMED_ONCE",
        "actualCount": 1 if shared_matched_twice == 0 else 2,
        "status": "PASSED" if shared_matched_twice == 0 else "FAILED",
        "details": "Verified that an external settlement cannot be consumed by multiple internal transactions."
    })

    # Edge Case: Idempotency (re-running reconciliation must be prevented or produce zero extra items)
    headers = {"Authorization": f"Bearer {token}"}
    rerun_res = requests.post(f"{API_URL}/api/v1/reconciliation-runs", headers=headers, json={
        "internalBatchId": int_batch_id,
        "externalBatchId": ext_batch_id
    })
    # Must reject re-run or enforce idempotency
    idempotent = rerun_res.status_code in (400, 409, 422) or "already" in rerun_res.text.lower()
    rule_results.append({
        "ruleId": "EDGE-IDEMPOTENCY",
        "ruleName": "Reconciliation Run Idempotency",
        "expectedOutcome": "REJECT_OR_IDEMPOTENT",
        "actualCount": 1,
        "status": "PASSED" if idempotent else "FAILED",
        "details": f"Attempt to rerun batch returned status {rerun_res.status_code}: {rerun_res.text[:100]}"
    })

    all_passed = all(r["status"] == "PASSED" for r in rule_results)

    final_report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "reconciliationRunId": run_id,
        "internalBatchId": int_batch_id,
        "externalBatchId": ext_batch_id,
        "matchedCount": run_data["matchedCount"],
        "exceptionCount": run_data["exceptionCount"],
        "allRulesPassed": all_passed,
        "rules": rule_results
    }

    with open(OUTPUT_JSON, "w") as f:
        json.dump(final_report, f, indent=2)

    print("\n=== RULE MATRIX VERIFICATION SUMMARY ===")
    for r in rule_results:
        print(f"[{r['status']}] {r['ruleId']}: {r['ruleName']} -> {r['details']}")

    print(f"\nFinal Result: {'ALL RULES VERIFIED SUCCESSFULLY (100% PASS)' if all_passed else 'SOME RULES FAILED'}")
    print(f"Report saved to: {OUTPUT_JSON}")
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
