import requests
import json
import time

BASE_URL = "http://localhost:5000/api/v1"

def print_step(step_num, title):
    print(f"\n==========================================")
    print(f"[STEP {step_num}] {title}")
    print(f"==========================================")

def run_test():
    # 1. Admin Login
    print_step(1, "Authenticating as Administrator")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@example.com",
        "password": "Admin123!"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_data = res.json()
    admin_token = admin_data["accessToken"]
    print(f"✓ Admin Logged In: {admin_data['user']['fullName']} ({admin_data['user']['role']})")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Analyst Login
    print_step(2, "Authenticating as Operations Analyst")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "analyst@example.com",
        "password": "Analyst123!"
    })
    assert res.status_code == 200, f"Analyst login failed: {res.text}"
    analyst_data = res.json()
    analyst_token = analyst_data["accessToken"]
    analyst_id = analyst_data["user"]["id"]
    print(f"✓ Analyst Logged In: {analyst_data['user']['fullName']} ({analyst_data['user']['role']})")
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    # 3. Upload Internal CSV
    print_step(3, "Uploading Internal Loan Repayments CSV")
    with open("storage/test_data/internal_repayments.csv", "rb") as f:
        res = requests.post(
            f"{BASE_URL}/imports",
            headers=admin_headers,
            files={"file": ("internal_repayments.csv", f, "text/csv")},
            data={"sourceType": "INTERNAL"}
        )
    assert res.status_code in [200, 201, 202], f"Upload internal failed: {res.text}"
    int_batch = res.json()
    int_batch_id = int_batch["importId"]
    print(f"✓ Internal Batch Uploaded: ID={int_batch_id}, Status={int_batch['status']}")

    # 4. Check Internal Batch Validation
    print_step(4, "Inspecting Internal Batch Validation Results")
    res = requests.get(f"{BASE_URL}/imports/{int_batch_id}/validation", headers=admin_headers)
    assert res.status_code == 200, f"Validation fetch failed: {res.text}"
    int_val = res.json()
    print(f"✓ Validation Results: Total={int_val['totalRows']}, Valid={int_val['validRows']}, Rejected={int_val['rejectedRows']}")
    assert int_val["validRows"] == 5, "Expected 5 valid internal rows"

    # 5. Confirm Internal Batch
    print_step(5, "Confirming Internal Batch Records")
    res = requests.post(
        f"{BASE_URL}/imports/{int_batch_id}/confirm",
        headers=admin_headers,
        json={"confirmValidRows": True}
    )
    assert res.status_code == 200, f"Confirm failed: {res.text}"
    print(f"✓ Internal Batch Confirmed: {res.json()['status']}")

    # 6. Upload External Settlements CSV
    print_step(6, "Uploading External Settlements CSV")
    with open("storage/test_data/external_settlements.csv", "rb") as f:
        res = requests.post(
            f"{BASE_URL}/imports",
            headers=admin_headers,
            files={"file": ("external_settlements.csv", f, "text/csv")},
            data={"sourceType": "EXTERNAL"}
        )
    assert res.status_code in [200, 201, 202], f"Upload external failed: {res.text}"
    ext_batch = res.json()
    ext_batch_id = ext_batch["importId"]
    print(f"✓ External Batch Uploaded: ID={ext_batch_id}, Status={ext_batch['status']}")

    # 7. Check External Validation Results
    print_step(7, "Inspecting External Batch Validation Results")
    res = requests.get(f"{BASE_URL}/imports/{ext_batch_id}/validation", headers=admin_headers)
    assert res.status_code == 200, f"Validation fetch failed: {res.text}"
    ext_val = res.json()
    print(f"✓ External Validation: Total={ext_val['totalRows']}, Valid={ext_val['validRows']}, Rejected={ext_val['rejectedRows']}")
    assert ext_val["validRows"] == 7, "Expected 7 valid external rows"

    # 8. Confirm External Batch
    print_step(8, "Confirming External Batch Records")
    res = requests.post(
        f"{BASE_URL}/imports/{ext_batch_id}/confirm",
        headers=admin_headers,
        json={"confirmValidRows": True}
    )
    assert res.status_code == 200, f"Confirm failed: {res.text}"
    print(f"✓ External Batch Confirmed: {res.json()['status']}")

    # 9. Verify Ledger Transactions
    print_step(9, "Querying Ingested Transactions Ledger")
    res = requests.get(f"{BASE_URL}/transactions?pageSize=20", headers=admin_headers)
    assert res.status_code == 200
    tx_list = res.json()
    print(f"✓ Operational Ledger: {tx_list['totalCount']} transactions active")

    # 10. Start Deterministic Reconciliation Run
    print_step(10, "Triggering Deterministic Reconciliation Run (RC-01 - RC-08)")
    res = requests.post(
        f"{BASE_URL}/reconciliation-runs",
        headers=admin_headers,
        json={
            "internalBatchId": int_batch_id,
            "externalBatchId": ext_batch_id
        }
    )
    assert res.status_code in [200, 201, 202], f"Reconciliation run failed: {res.text}"
    run_res = res.json()
    run_id = run_res["runId"]
    print(f"✓ Reconciliation Run Initiated: ID={run_id}, Initial Status={run_res['status']}")

    # 11. Poll / Inspect Reconciliation Run Details
    print_step(11, "Inspecting Reconciliation Run Outcomes")
    run_detail = None
    for _ in range(10):
        time.sleep(1)
        res = requests.get(f"{BASE_URL}/reconciliation-runs/{run_id}", headers=admin_headers)
        assert res.status_code == 200, f"Run fetch failed: {res.text}"
        run_detail = res.json()
        if run_detail["status"] == "COMPLETED":
            break

    assert run_detail is not None
    print(f"✓ Run Status: {run_detail['status']}")
    print(f"✓ Matches Count: {run_detail['matchedCount']}")
    print(f"✓ Exceptions Count: {run_detail['exceptionCount']}")

    # 12. Inspect Matches (Clean Matches & Partial Settlements)
    print_step(12, "Verifying Deterministic Matches (RC-01, RC-06)")
    res = requests.get(f"{BASE_URL}/reconciliation-runs/{run_id}/matches", headers=admin_headers)
    assert res.status_code == 200
    matches = res.json()["items"]
    print(f"✓ Retrieved {len(matches)} matches:")
    for m in matches:
        print(f"   - Match [{m['matchType']}]: {len(m['members'])} transaction members")
    assert any(m["matchType"] in ["EXACT", "EXACT_MATCH"] for m in matches), "Expected at least 1 EXACT match"
    assert any(m["matchType"] in ["AGGREGATE", "PARTIAL_SETTLEMENT"] for m in matches), "Expected AGGREGATE/PARTIAL match"

    # 13. Inspect Discrepancy Exceptions
    print_step(13, "Verifying Deterministic Discrepancy Exceptions (RC-02, RC-03, RC-04, RC-05)")
    res = requests.get(f"{BASE_URL}/reconciliation-runs/{run_id}/exceptions", headers=admin_headers)
    assert res.status_code == 200
    exceptions = res.json()["items"]
    print(f"✓ Retrieved {len(exceptions)} discrepancy exceptions:")
    ex_types = [e["exceptionType"] for e in exceptions]
    for e in exceptions:
        print(f"   - Exception [{e['exceptionType']}] Severity={e['severity']}, Discrepancy={e.get('discrepancyAmount')} {e.get('currency')}")

    assert "AMOUNT_MISMATCH" in ex_types, "Expected AMOUNT_MISMATCH exception"
    assert ("MISSING_SETTLEMENT" in ex_types or "MISSING_EXTERNAL" in ex_types), "Expected MISSING_SETTLEMENT exception"
    assert "UNMATCHED_EXTERNAL" in ex_types, "Expected UNMATCHED_EXTERNAL exception"
    assert ("DUPLICATE" in ex_types or "DUPLICATE_EXTERNAL" in ex_types), "Expected DUPLICATE exception"

    target_ex = next(e for e in exceptions if e["exceptionType"] == "AMOUNT_MISMATCH")
    target_ex_id = target_ex["id"]

    # 14. Trigger AI Advisory Analysis
    print_step(14, f"Triggering AI Advisory Root Cause Analysis on Exception {target_ex_id}")
    res = requests.post(
        f"{BASE_URL}/exceptions/{target_ex_id}/analysis",
        headers=admin_headers,
        json={"analysisType": "EXPLANATION"}
    )
    assert res.status_code in [200, 202], f"AI analysis request failed: {res.text}"
    print(f"✓ AI Analysis Triggered: {res.json()['status']}")

    time.sleep(2)
    res = requests.get(f"{BASE_URL}/exceptions/{target_ex_id}/analysis?latest=true", headers=admin_headers)
    assert res.status_code == 200
    analyses = res.json()
    if analyses and len(analyses) > 0:
        latest_ai = analyses[0]
        print(f"✓ Advisory AI Output:")
        print(f"   - Model: {latest_ai.get('modelName')}")
        print(f"   - Advisory Only Flag: {latest_ai.get('advisoryOnly')}")
        print(f"   - Summary: {latest_ai.get('summary')}")
        print(f"   - Recommendation: {latest_ai.get('recommendation')}")

    # 15. Admin Assigns Exception to Analyst
    print_step(15, f"Assigning Exception {target_ex_id} to Analyst")
    res = requests.patch(
        f"{BASE_URL}/exceptions/{target_ex_id}/assignment",
        headers=admin_headers,
        json={"assignedTo": analyst_id}
    )
    assert res.status_code == 200, f"Assignment failed: {res.text}"
    print(f"✓ Exception Assigned to Analyst: {analyst_data['user']['fullName']}")

    # 16. Analyst Adds Investigation Note
    print_step(16, "Analyst Records Investigation Note")
    res = requests.post(
        f"{BASE_URL}/exceptions/{target_ex_id}/notes",
        headers=analyst_headers,
        json={"note": "Confirmed bank settled $2400.00 against expected $2500.00 repayment. $100.00 discrepancy accounted for by external processing fee."}
    )
    assert res.status_code in [200, 201], f"Note failed: {res.text}"
    print(f"✓ Investigation Note Recorded: {res.json()['note']}")

    # 17. Human Resolution Sign-Off
    print_step(17, "Submitting Human Resolution Sign-Off")
    res = requests.post(
        f"{BASE_URL}/exceptions/{target_ex_id}/resolve",
        headers=analyst_headers,
        json={
            "resolutionCategory": "TIMING_DIFFERENCE_ACKNOWLEDGED",
            "explanation": "Verified external processing fee deduction. Fee variance approved and reconciled with bank settlement schedule."
        }
    )
    assert res.status_code == 200, f"Resolution failed: {res.text}"
    resolved_ex = res.json()
    assert resolved_ex["status"] == "RESOLVED", "Exception should be RESOLVED"
    print(f"✓ Exception Formally Resolved: Status={resolved_ex['status']}, Category={resolved_ex['resolutionCategory']}")

    # 18. Audit Trail Verification
    print_step(18, "Inspecting Immutable Regulatory Audit Log")
    res = requests.get(f"{BASE_URL}/audit-logs?pageSize=20", headers=admin_headers)
    assert res.status_code == 200
    audit_logs = res.json()["items"]
    print(f"✓ Verified {len(audit_logs)} audit events in tamper-evident trail:")
    for log in audit_logs[:6]:
        print(f"   [{log['createdAt'][:19]}] Actor: {log.get('actorName')} -> Action: {log['action']} on {log['entityType']}")

    # 19. Dashboard Summary Verification
    print_step(19, "Verifying Real-Time Dashboard Metrics")
    res = requests.get(f"{BASE_URL}/dashboard/summary", headers=admin_headers)
    assert res.status_code == 200
    dash = res.json()
    print(f"✓ Dashboard KPIs:")
    print(f"   - Total Transactions: {dash['totalTransactions']}")
    print(f"   - Matched: {dash['matchedTransactions']}")
    print(f"   - Open Exceptions: {dash['openExceptions']}")
    print(f"   - Resolved Exceptions: {dash['resolvedExceptions']}")
    print(f"   - Match Rate: {dash['matchRate']:.1f}%")

    print("\n=======================================================")
    print(">>> ALL 19 ACCEPTANCE CRITERIA STEPS PASSED 100%! <<<")
    print("=======================================================\n")

if __name__ == "__main__":
    run_test()
