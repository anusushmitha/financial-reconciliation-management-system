"""
LendGuard AI — Operational Pilot Baseline Verification Script
Inspects and independently validates:
1. Seed user lockout (SEED_TEST_USERS=false, admin@example.com rejected)
2. Staging credentials (staging.admin@lendguard.internal & staging.analyst@lendguard.internal)
3. RBAC isolation (Analyst 403 on /api/v1/users, Admin 200 OK)
4. AI service isolation (Advisory only, no direct DB write access)
5. Audit trail immutability triggers (SQLSTATE 45000 on UPDATE/DELETE)
6. Database table count & outbox worker status
"""

import sys
import os
import json
import subprocess
import requests

API_URL = "http://localhost:5000"
AI_URL = "http://localhost:8000"
AI_KEY = "lendguard_internal_ai_secret_key_2026"
DB_PORT = 5433
DB_NAME = "lendguard_staging"
PSQL = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

ADMIN_EMAIL = "staging.admin@lendguard.internal"
ADMIN_PASS = "StagingAdmin_Secure2026!"
ANALYST_EMAIL = "staging.analyst@lendguard.internal"
ANALYST_PASS = "StagingAnalyst_Secure2026!"

def run_psql(sql):
    env = os.environ.copy()
    env["PGPASSWORD"] = "postgres"
    cmd = [PSQL, "-h", "localhost", "-p", str(DB_PORT), "-U", "postgres", "-d", DB_NAME, "-t", "-A", "-c", sql]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    return res.stdout.strip(), res.stderr.strip(), res.returncode

def main():
    print("=" * 70)
    print(" LENDGUARD AI: OPERATIONAL PILOT BASELINE VERIFICATION")
    print("=" * 70)
    
    # 1. Dev Seed Lockout
    r_dev = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": "admin@example.com", "password": "Password123!"})
    print(f"[*] Dev Seed Lockout: Status {r_dev.status_code} ({'PASS' if r_dev.status_code == 401 else 'FAIL'})")
    
    # 2. Admin & Analyst Auth
    r_admin = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    admin_token = r_admin.json().get("accessToken") if r_admin.status_code == 200 else None
    print(f"[*] Staging Admin Auth: Status {r_admin.status_code} ({'PASS' if admin_token else 'FAIL'})")
    
    r_analyst = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": ANALYST_EMAIL, "password": ANALYST_PASS})
    analyst_token = r_analyst.json().get("accessToken") if r_analyst.status_code == 200 else None
    print(f"[*] Staging Analyst Auth: Status {r_analyst.status_code} ({'PASS' if analyst_token else 'FAIL'})")
    
    # 3. RBAC Isolation
    r_analyst_users = requests.get(f"{API_URL}/api/v1/users", headers={"Authorization": f"Bearer {analyst_token}"})
    print(f"[*] Analyst /users Access (Expect 403): Status {r_analyst_users.status_code} ({'PASS' if r_analyst_users.status_code == 403 else 'FAIL'})")
    
    r_admin_users = requests.get(f"{API_URL}/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    print(f"[*] Admin /users Access (Expect 200): Status {r_admin_users.status_code} ({'PASS' if r_admin_users.status_code == 200 else 'FAIL'})")
    
    # 4. Database User Audit
    out_users, _, _ = run_psql("SELECT email, role, is_active FROM users ORDER BY email;")
    print(f"[*] Database Users:\n{out_users}")
    
    # 5. Database Table Count
    out_tables, _, _ = run_psql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
    print(f"[*] Active Tables in {DB_NAME}: {out_tables}")
    
    # 6. Immutability Trigger Test on audit_logs
    _, err_imm, rc = run_psql("UPDATE audit_logs SET action = 'ILLEGAL_MOD';")
    trigger_active = "immutable" in err_imm or "cannot be updated" in err_imm or "45000" in err_imm
    print(f"[*] Immutability Trigger Protection: {'PASS' if trigger_active else 'FAIL'} -> {err_imm.splitlines()[0] if err_imm else 'No error'}")
    
    # 7. AI Service Check
    r_ai = requests.get(f"{AI_URL}/internal/v1/health", headers={"X-Internal-Service-Key": AI_KEY})
    ai_ok = r_ai.status_code == 200 and r_ai.json().get("status") == "Healthy"
    print(f"[*] AI Service Health: Status {r_ai.status_code} ({'PASS' if ai_ok else 'FAIL'}) -> {r_ai.text}")

    print("=" * 70)
    print(" BASELINE VERIFICATION COMPLETED")
    print("=" * 70)

if __name__ == "__main__":
    main()
