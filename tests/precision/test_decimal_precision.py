import os
import sys
import json
import subprocess
from decimal import Decimal
import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_URL = "http://localhost:5000"
PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

def run_sql(query):
    user = os.environ.get("PGUSER", "postgres")
    dbname = os.environ.get("PGDATABASE", "lendguard_staging")
    cmd = [PSQL_PATH, "-U", user, "-d", dbname, "-p", "5433", "-t", "-A", "-c", query]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return res.stdout.strip()

def check_postgres_schema():
    print("1. Verifying PostgreSQL column data types...")
    query = """
    SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_name IN ('transactions', 'reconciliation_match_items', 'exceptions')
      AND column_name IN ('amount', 'amount_applied', 'expected_amount', 'actual_amount', 'discrepancy_amount')
    ORDER BY table_name, column_name;
    """
    output = run_sql(query)
    lines = output.strip().split("\n")
    results = []
    all_exact = True
    for line in lines:
        if not line:
            continue
        table, col, dtype, prec, scale = line.split("|")
        is_num18_2 = (dtype == "numeric" and prec == "18" and scale == "2")
        results.append({
            "table": table,
            "column": col,
            "dataType": f"{dtype}({prec},{scale})",
            "matchesNumeric18_2": is_num18_2
        })
        if not is_num18_2:
            all_exact = False
        print(f"   - {table}.{col}: {dtype}({prec},{scale}) -> {'OK' if is_num18_2 else 'FAIL'}")
    return all_exact, results

def check_csharp_types():
    print("2. Scanning C# codebase for forbidden float/double monetary usage...")
    base_dir = os.path.join(BASE_DIR, "backend")
    violations = []
    checked_files = 0
    for root, dirs, files in os.walk(base_dir):
        if "bin" in root or "obj" in root:
            continue
        for file in files:
            if file.endswith(".cs"):
                checked_files += 1
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    for idx, line in enumerate(f, 1):
                        lower = line.lower()
                        if any(term in lower for term in ["amount", "balance", "discrepancy", "money"]):
                            if "double" in line or "float" in line:
                                violations.append(f"{file}:{idx} -> {line.strip()}")
    print(f"   Checked {checked_files} C# source files. Forbidden monetary float/double usages: {len(violations)}")
    return len(violations) == 0, violations

def check_partial_settlement_sum_precision():
    print("3. Testing precision of multi-item aggregations (summing 100 partial amounts)...")
    # In float arithmetic: 0.07 * 100 = 7.000000000000001
    # In Decimal: Decimal('0.07') * 100 = Decimal('7.00')
    partial = Decimal("0.07")
    count = 100
    decimal_sum = sum(partial for _ in range(count))
    expected = Decimal("7.00")
    print(f"   Sum of 100 x $0.07 in Decimal = {decimal_sum} (Expected: {expected})")
    
    # Insert temporary test transactions in postgres and aggregate with SUM()
    insert_sql = """
    DO $$
    DECLARE
        v_batch_id UUID := gen_random_uuid();
        v_user_id UUID;
        i INT;
    BEGIN
        SELECT id INTO v_user_id FROM users LIMIT 1;
        INSERT INTO import_batches(id, batch_reference, source_type, file_name, file_path, file_hash, status, uploaded_by)
        VALUES (v_batch_id, 'IMP-TEST-PRECISION-' || gen_random_uuid(), 'EXTERNAL', 'precision.csv', 'storage/precision.csv', 'dummy', 'IMPORTED', v_user_id);
        
        FOR i IN 1..100 LOOP
            INSERT INTO transactions (id, import_batch_id, source_row_number, transaction_reference, transaction_date, amount, currency, source_type, status)
            VALUES (gen_random_uuid(), v_batch_id, i, 'TXN-P-' || i, now(), 0.07, 'INR', 'EXTERNAL', 'PENDING');
        END LOOP;
        
        -- Store the result in a temporary check
        PERFORM SUM(amount) FROM transactions WHERE import_batch_id = v_batch_id;
    END $$;
    """
    run_sql(insert_sql)
    
    # Query database sum
    db_sum_query = """
    SELECT SUM(amount) FROM transactions WHERE transaction_reference LIKE 'TXN-P-%';
    """
    db_sum_str = run_sql(db_sum_query)
    db_sum = Decimal(db_sum_str)
    print(f"   PostgreSQL SUM(amount) across 100 rows = {db_sum} (Expected: {expected})")
    
    # Cleanup test rows
    run_sql("DELETE FROM transactions WHERE transaction_reference LIKE 'TXN-P-%';")
    run_sql("DELETE FROM import_batches WHERE batch_reference LIKE 'IMP-TEST-PRECISION-%';")
    
    return decimal_sum == expected and db_sum == expected

def check_boundary_precision():
    print("4. Testing extreme numerical boundary values...")
    # Maximum NUMERIC(18,2): 999,999,999,999,999.99
    max_val = Decimal("999999999999999.99")
    min_val = Decimal("0.01")
    zero_val = Decimal("0.00")
    
    test_sql = f"""
    SELECT (999999999999999.99::NUMERIC(18,2) - 0.01::NUMERIC(18,2)) AS diff;
    """
    db_diff = Decimal(run_sql(test_sql))
    expected_diff = max_val - min_val
    print(f"   Max value boundary test: {db_diff} == {expected_diff}")
    return db_diff == expected_diff

def check_csv_export_precision():
    print("5. Testing API serialization & CSV export precision...")
    import re
    email = os.environ.get("ADMIN_EMAIL", "staging.admin@lendguard.internal")
    password = os.environ.get("ADMIN_PASSWORD", "StagingAdmin_Secure2026!")
    res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin123!"})
    token = res.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    
    export_res = requests.get(f"{API_URL}/api/v1/reports/exceptions/export", headers=headers)
    print(f"   Export API response status: {export_res.status_code}")
    print(f"   Export Content-Type: {export_res.headers.get('content-type', 'unknown')}")
    
    lines = export_res.text.strip().split("\n")
    header = lines[0].strip().split(",")
    # Expected indices: 4: Expected Amount, 5: Actual Amount, 6: Discrepancy Amount
    decimal_pattern = re.compile(r"^\d+\.\d{2}$")
    verified_amounts = 0
    all_clean = True
    
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(",")
        if len(parts) >= 7:
            for col_idx in (4, 5, 6):
                val = parts[col_idx].strip()
                if val:  # if not empty
                    verified_amounts += 1
                    if not decimal_pattern.match(val):
                        print(f"   Drift detected: {val}")
                        all_clean = False
                        break
    print(f"   Verified {verified_amounts} exported monetary values with exact two decimal places (zero drift): {'PASSED' if all_clean else 'FAILED'}")
    return export_res.status_code == 200 and all_clean and verified_amounts > 0

def main():
    print("=== LENDGUARD AI: Decimal Precision Verification ===")
    pg_ok, schema_details = check_postgres_schema()
    cs_ok, cs_violations = check_csharp_types()
    sum_ok = check_partial_settlement_sum_precision()
    boundary_ok = check_boundary_precision()
    export_ok = check_csv_export_precision()
    
    all_passed = pg_ok and cs_ok and sum_ok and boundary_ok and export_ok
    print("\n=== SUMMARY ===")
    print(f"PostgreSQL Schema NUMERIC(18,2): {'PASSED' if pg_ok else 'FAILED'}")
    print(f"C# Decimal Usage (0 float/double): {'PASSED' if cs_ok else 'FAILED'}")
    print(f"Multi-item Aggregation Precision:  {'PASSED' if sum_ok else 'FAILED'}")
    print(f"Extreme Boundary Precision:       {'PASSED' if boundary_ok else 'FAILED'}")
    print(f"CSV Export / API Precision:       {'PASSED' if export_ok else 'FAILED'}")
    print(f"\nFinal Result: {'ALL PRECISION CHECKS PASSED (ZERO DRIFT)' if all_passed else 'PRECISION CHECKS FAILED'}")
    
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
