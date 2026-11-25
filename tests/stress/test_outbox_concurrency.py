import os
import sys
import time
import subprocess
import concurrent.futures
import requests

API_URL = "http://localhost:5000"
PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

def run_sql(query):
    user = os.environ.get("PGUSER", "postgres")
    dbname = os.environ.get("PGDATABASE", "lendguard_staging")
    cmd = [PSQL_PATH, "-U", user, "-d", dbname, "-p", "5433", "-t", "-A", "-c", query]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return res.stdout.strip()

def login():
    try:
        res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": "staging.admin@lendguard.internal", "password": "StagingAdmin_Secure2026!"})
        if res.status_code == 200:
            return res.json()["accessToken"]
    except Exception:
        pass
    res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin123!"})
    return res.json()["accessToken"]

def test_concurrent_api_traffic(token, num_requests=30):
    print(f"1. Spawning {num_requests} concurrent API requests across multiple threads...")
    headers = {"Authorization": f"Bearer {token}"}
    urls = [
        f"{API_URL}/api/v1/dashboard/summary",
        f"{API_URL}/api/v1/exceptions?pageSize=20",
        f"{API_URL}/api/v1/imports?pageSize=20",
        f"{API_URL}/api/v1/reconciliation-runs?pageSize=20"
    ]
    
    start_time = time.time()
    errors = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = []
        for i in range(num_requests):
            url = urls[i % len(urls)]
            futures.append(executor.submit(requests.get, url, headers=headers))
            
        for f in concurrent.futures.as_completed(futures):
            res = f.result()
            if res.status_code != 200:
                errors += 1
                
    elapsed = time.time() - start_time
    print(f"   Completed {num_requests} requests in {elapsed:.2f}s ({num_requests/elapsed:.1f} req/s). Errors: {errors}")
    return errors == 0

def get_outbox_metrics():
    print("2. Querying PostgreSQL outbox table metrics...")
    query = """
    SELECT status, count(*) 
    FROM background_jobs 
    GROUP BY status 
    ORDER BY status;
    """
    out = run_sql(query)
    print("   Current outbox job distribution:")
    for line in out.strip().split("\n"):
        if line:
            status, cnt = line.split("|")
            print(f"     - {status}: {cnt}")
    
    # Check for deadlocks or blocking locks in pg_stat_database / pg_locks
    deadlocks_query = "SELECT COALESCE(SUM(deadlocks), 0) FROM pg_stat_database WHERE datname IN ('lendguard', 'lendguard_staging');"
    deadlocks = int(run_sql(deadlocks_query) or 0)
    print(f"   PostgreSQL total system deadlocks recorded: {deadlocks}")
    return deadlocks == 0

def main():
    print("=== LENDGUARD AI: Outbox & Concurrency Stress Test Suite ===")
    token = login()
    api_ok = test_concurrent_api_traffic(token, num_requests=40)
    outbox_ok = get_outbox_metrics()
    
    all_passed = api_ok and outbox_ok
    print("\n=== SUMMARY ===")
    print(f"Concurrent API Connection Pooling: {'PASSED' if api_ok else 'FAILED'}")
    print(f"PostgreSQL Zero Deadlocks:        {'PASSED' if outbox_ok else 'FAILED'}")
    print(f"\nFinal Result: {'ALL STRESS CHECKS PASSED' if all_passed else 'STRESS CHECKS FAILED'}")
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
