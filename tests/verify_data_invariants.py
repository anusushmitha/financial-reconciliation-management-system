"""Financial accounting, ledger, and API invariant verification against live LendGuard AI staging."""
import json
import os
import subprocess
import sys
import urllib.request

API_URL = os.getenv("API_URL", "http://localhost:5000")
PSQL = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"
DB_NAME = os.getenv("STAGING_DB_NAME", "lendguard_staging")


def api_json(path: str, token: str | None = None, method: str = "GET", body: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{API_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def psql_scalar(sql: str) -> str:
    env = os.environ.copy()
    env.setdefault("PGPASSWORD", "postgres")
    res = subprocess.run(
        [PSQL, "-h", "localhost", "-p", "5433", "-U", "postgres", "-d", DB_NAME, "-t", "-A", "-c", sql],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return res.stdout.strip()


def main() -> int:
    admin_login = api_json(
        "/api/v1/auth/login",
        method="POST",
        body={"email": "staging.admin@lendguard.internal", "password": "StagingAdmin_Secure2026!"},
    )
    token = admin_login["accessToken"]

    summary = api_json("/api/v1/dashboard/summary", token)
    trends = api_json("/api/v1/dashboard/trends?interval=day", token)
    recon_rep = api_json("/api/v1/reports/reconciliation", token)
    exc_rep = api_json("/api/v1/reports/exceptions", token)
    exceptions = api_json("/api/v1/exceptions?pageSize=100", token)["items"]

    # 1. Dashboard accounting identity: matched + unmatched == total
    assert summary["totalTransactions"] > 0, "Expected non-zero transactions"
    assert summary["matchedTransactions"] + summary["unmatchedTransactions"] == summary["totalTransactions"], (
        f"Summary accounting mismatch: {summary}"
    )

    # 2. Summary, Trends, and Executive Report agree on matched transactions & match rate
    trend_matched = sum(item["matched"] for item in trends["items"])
    trend_total = sum(item["total"] for item in trends["items"])
    trend_exc = sum(item["exceptions"] for item in trends["items"])

    assert trend_total == summary["totalTransactions"], f"Trend total {trend_total} != {summary['totalTransactions']}"
    assert trend_matched == summary["matchedTransactions"], f"Trend matched {trend_matched} != {summary['matchedTransactions']}"
    assert recon_rep["totals"]["matchedTransactions"] == summary["matchedTransactions"], (
        f"Report matchedTxns {recon_rep['totals']['matchedTransactions']} != {summary['matchedTransactions']}"
    )
    assert recon_rep["matchRate"] == summary["matchRate"], (
        f"Report matchRate {recon_rep['matchRate']} != Summary matchRate {summary['matchRate']}"
    )
    assert trend_exc == exc_rep["totals"]["total"], f"Trend exceptions {trend_exc} != Report {exc_rep['totals']['total']}"
    assert exc_rep["totals"]["total"] == summary["openExceptions"] + summary["resolvedExceptions"], (
        f"Exception status partition mismatch: {exc_rep['totals']} vs {summary}"
    )

    # 3. No fake fallback data when filtering out-of-range dates
    empty_trends = api_json("/api/v1/dashboard/trends?dateFrom=2020-01-01&dateTo=2020-01-05", token)
    assert empty_trends["items"] == [], f"Expected empty trends for empty date window, got {empty_trends}"

    # 4. Multi-currency preservation on exceptions (USD & EUR must NOT become INR)
    currencies = {ex["currency"] for ex in exceptions}
    assert {"INR", "USD", "EUR"}.issubset(currencies), f"Expected INR, USD, EUR exceptions, got {currencies}"

    # 5. All severity tiers represented without zero-bucket blindspot
    for sev in ("low", "medium", "high", "critical"):
        assert exc_rep["totals"][sev] > 0, f"Expected positive count for severity '{sev}', got {exc_rep['totals']}"

    # 6. PostgreSQL row-level mathematical invariants: 0 corrupted math discrepancies
    bad_math = int(
        psql_scalar(
            """
            SELECT count(*)
            FROM exceptions e
            LEFT JOIN transactions it ON it.id = e.internal_transaction_id
            LEFT JOIN transactions et ON et.id = e.external_transaction_id
            WHERE (it.id IS NOT NULL AND e.expected_amount IS DISTINCT FROM it.amount)
               OR (e.exception_type = 'AMOUNT_MISMATCH' AND e.expected_amount IS NOT NULL AND e.actual_amount IS NOT NULL AND e.discrepancy_amount IS DISTINCT FROM abs(e.expected_amount - e.actual_amount))
               OR (e.exception_type IN ('PARTIAL_SETTLEMENT', 'AMBIGUOUS_MATCH') AND e.expected_amount IS NOT NULL AND e.actual_amount IS NOT NULL AND e.discrepancy_amount IS DISTINCT FROM abs(e.expected_amount - e.actual_amount))
               OR (e.exception_type IN ('MISSING_SETTLEMENT', 'UNMATCHED_EXTERNAL') AND e.discrepancy_amount IS DISTINCT FROM COALESCE(it.amount, et.amount))
               OR (e.exception_type = 'AMBIGUOUS_MATCH' AND e.external_transaction_id IS NULL AND et.id IS NOT NULL);
            """
        )
    )
    assert bad_math == 0, f"Detected {bad_math} exception rows violating Expected/Actual/Discrepancy arithmetic!"

    orphan_matches = int(
        psql_scalar(
            """
            SELECT count(*) FROM transactions
            WHERE status = 'MATCHED'
              AND id NOT IN (SELECT transaction_id FROM reconciliation_match_items);
            """
        )
    )
    assert orphan_matches == 0, f"Found {orphan_matches} MATCHED transactions lacking match_items lineage!"

    print(
        f"[PASS] All accounting & ledger invariants verified: "
        f"total={summary['totalTransactions']}, matched={summary['matchedTransactions']}, "
        f"unmatched={summary['unmatchedTransactions']}, matchRate={summary['matchRate']}%, "
        f"exceptions={exc_rep['totals']['total']} (open={summary['openExceptions']}, resolved={summary['resolvedExceptions']}), "
        f"currencies={sorted(currencies)}, badMath=0, orphanMatches=0."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
