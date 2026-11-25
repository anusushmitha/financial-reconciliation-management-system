"""
LENDGUARD AI — Unified Health Monitoring Utility
Continuously or on-demand monitors the health of:
- PostgreSQL 16 database connectivity & schema integrity
- Backend Web API (.NET 10 LTS) health endpoint
- AI Microservice (FastAPI) internal health & advisory status
- Background Worker outbox backlog & deadlock metrics
- Persistent storage volume read/write permissions
"""

import sys
import os
import json
import time
import subprocess
import requests

PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

def run_psql(host, port, user, password, db, sql_cmd):
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    cmd = [PSQL_PATH, "-h", host, "-p", str(port), "-U", user, "-d", db, "-t", "-A", "-c", sql_cmd]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.returncode != 0 and "ERROR" in res.stderr:
        raise RuntimeError(f"Database query error: {res.stderr}")
    return res.stdout.strip()

def check_health(api_url, ai_url, ai_key, db_host, db_port, db_user, db_pass, db_name, storage_dir):
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overall_status": "HEALTHY",
        "components": {}
    }

    # 1. Database Check
    try:
        t0 = time.time()
        table_count = int(run_psql(db_host, db_port, db_user, db_pass, db_name, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"))
        active_conns = int(run_psql(db_host, db_port, db_user, db_pass, db_name, "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"))
        pending_jobs = int(run_psql(db_host, db_port, db_user, db_pass, db_name, "SELECT count(*) FROM background_jobs WHERE status = 'PENDING';"))
        deadlocks = int(run_psql(db_host, db_port, db_user, db_pass, db_name, "SELECT deadlocks FROM pg_stat_database WHERE datname = current_database();") or "0")
        db_lat = round((time.time() - t0) * 1000, 2)

        db_ok = table_count == 13
        report["components"]["database"] = {
            "status": "HEALTHY" if db_ok else "DEGRADED",
            "latency_ms": db_lat,
            "table_count": table_count,
            "active_connections": active_conns,
            "pending_outbox_jobs": pending_jobs,
            "deadlocks_recorded": deadlocks
        }
        if not db_ok:
            report["overall_status"] = "DEGRADED"
    except Exception as e:
        report["components"]["database"] = {"status": "UNHEALTHY", "error": str(e)}
        report["overall_status"] = "UNHEALTHY"

    # 2. Backend API Check
    try:
        t0 = time.time()
        res = requests.get(f"{api_url}/health", timeout=3)
        lat = round((time.time() - t0) * 1000, 2)
        api_ok = res.status_code == 200 and "Healthy" in res.text
        report["components"]["backend_api"] = {
            "status": "HEALTHY" if api_ok else "UNHEALTHY",
            "status_code": res.status_code,
            "latency_ms": lat,
            "payload": res.json() if res.status_code == 200 else res.text
        }
        if not api_ok:
            report["overall_status"] = "UNHEALTHY"
    except Exception as e:
        report["components"]["backend_api"] = {"status": "UNHEALTHY", "error": str(e)}
        report["overall_status"] = "UNHEALTHY"

    # 3. AI Microservice Check
    try:
        t0 = time.time()
        headers = {"X-Service-Key": ai_key}
        res = requests.get(f"{ai_url}/internal/v1/health", headers=headers, timeout=3)
        lat = round((time.time() - t0) * 1000, 2)
        ai_ok = res.status_code == 200
        report["components"]["ai_service"] = {
            "status": "HEALTHY" if ai_ok else "UNHEALTHY",
            "status_code": res.status_code,
            "latency_ms": lat,
            "payload": res.json() if res.status_code == 200 else res.text
        }
        if not ai_ok:
            report["overall_status"] = "DEGRADED"
    except Exception as e:
        report["components"]["ai_service"] = {"status": "UNHEALTHY", "error": str(e)}
        report["overall_status"] = "DEGRADED"

    # 4. Persistent Storage Volume Check
    try:
        uploads_dir = os.path.join(storage_dir, "uploads")
        exports_dir = os.path.join(storage_dir, "exports")
        test_file = os.path.join(storage_dir, ".health_check_probe")
        with open(test_file, "w") as f:
            f.write("probe")
        with open(test_file, "r") as f:
            val = f.read()
        os.remove(test_file)
        storage_ok = (val == "probe") and os.path.exists(uploads_dir) and os.path.exists(exports_dir)
        report["components"]["persistent_storage"] = {
            "status": "HEALTHY" if storage_ok else "DEGRADED",
            "path": storage_dir,
            "read_write_verified": True
        }
    except Exception as e:
        report["components"]["persistent_storage"] = {"status": "UNHEALTHY", "error": str(e)}
        report["overall_status"] = "DEGRADED"

    return report

def main():
    api_url = os.getenv("API_URL", "http://localhost:5000")
    ai_url = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
    ai_key = os.getenv("AI_SERVICE_KEY", "lendguard_internal_ai_secret_key_2026")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "5433"))
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "lendguard_staging")
    storage_dir = os.getenv("STORAGE_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage_staging")))

    report = check_health(api_url, ai_url, ai_key, db_host, db_port, db_user, db_pass, db_name, storage_dir)
    print(json.dumps(report, indent=2))
    if report["overall_status"] == "UNHEALTHY":
        sys.exit(1)

if __name__ == "__main__":
    main()
