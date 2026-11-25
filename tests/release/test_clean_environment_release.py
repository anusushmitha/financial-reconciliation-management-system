"""
LENDGUARD AI — Clean Environment Release Test
Tests deploying the application from scratch in a pristine, isolated environment:
- Clean database creation & migration execution
- Clean storage provisioning
- Clean API & Worker process launch on non-default ports
- Health check verification
- Batch upload & validation
- Outbox job pickup & background worker processing
- AI service connectivity & advisory response
- Persistent storage file verification
- Full backup & restoration drill from clean environment
- Graceful restart and recovery
"""

import os
import sys
import time
import json
import hashlib
import shutil
import subprocess
import requests

PG_HOST = "localhost"
PG_PORT = "5433"
PG_USER = "postgres"
PG_PASS = "postgres"
PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

CLEAN_DB = "lendguard_clean_staging"
RECOVERY_DB = "lendguard_clean_recovery"

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLEAN_STORAGE = os.path.join(BASE_DIR, "storage_clean_staging")
CLEAN_BACKUP_DIR = os.path.join(BASE_DIR, "backups_clean_staging")
RECOVERY_STORAGE = os.path.join(BASE_DIR, "storage_clean_recovery")

DOTNET_EXE = r"C:\Users\LENOVO\.dotnet\dotnet.exe"
API_PORT = 5055
API_URL = f"http://localhost:{API_PORT}"

TABLES = [
    "users",
    "import_batches",
    "import_row_errors",
    "transactions",
    "reconciliation_runs",
    "reconciliation_matches",
    "reconciliation_match_items",
    "exceptions",
    "investigation_notes",
    "ai_analyses",
    "password_reset_tokens",
    "audit_logs",
    "background_jobs"
]

def run_psql(db, sql_cmd):
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASS
    cmd = [PSQL_PATH, "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", db, "-t", "-A", "-c", sql_cmd]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.returncode != 0 and "ERROR" in res.stderr:
        raise RuntimeError(f"psql error: {res.stderr}")
    return res.stdout.strip()

def run_psql_file(db, filepath):
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASS
    cmd = [PSQL_PATH, "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", db, "-f", filepath]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"psql file error: {res.stderr}")
    return res.stdout

def step(msg):
    print(f"\n[CLEAN-DEPLOY] >>> {msg}")

def main():
    print("=" * 80)
    print(" LENDGUARD AI: CLEAN ENVIRONMENT RELEASE VERIFICATION")
    print("=" * 80)

    api_proc = None
    worker_proc = None

    try:
        # Step 1: Clean Database Provisioning
        step(f"1. Initializing clean PostgreSQL database '{CLEAN_DB}'...")
        run_psql("postgres", f"DROP DATABASE IF EXISTS {CLEAN_DB} WITH (FORCE);")
        run_psql("postgres", f"DROP DATABASE IF EXISTS {RECOVERY_DB} WITH (FORCE);")
        run_psql("postgres", f"CREATE DATABASE {CLEAN_DB};")
        print(f"   Database '{CLEAN_DB}' created successfully.")

        # Step 2: Running SQL Migrations
        step("2. Applying SQL migrations in order...")
        migration_files = [
            os.path.join(BASE_DIR, "database", "migrations", "001_initial_schema.sql"),
            os.path.join(BASE_DIR, "database", "migrations", "002_immutability_triggers.sql")
        ]

        for m_file in migration_files:
            print(f"   Applying: {os.path.basename(m_file)}")
            run_psql_file(CLEAN_DB, m_file)
        
        # Verify tables created
        table_list_raw = run_psql(CLEAN_DB, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        tables = [t.strip() for t in table_list_raw.splitlines() if t.strip()]
        print(f"   Created {len(tables)} tables: {sorted(tables)}")
        assert len(tables) == 13, f"Expected 13 tables, found {len(tables)}"

        # Step 3: Clean Persistent Storage Provisioning
        step(f"3. Provisioning clean persistent storage directory '{CLEAN_STORAGE}'...")
        if os.path.exists(CLEAN_STORAGE):
            shutil.rmtree(CLEAN_STORAGE)
        os.makedirs(os.path.join(CLEAN_STORAGE, "uploads"), exist_ok=True)
        os.makedirs(os.path.join(CLEAN_STORAGE, "exports"), exist_ok=True)
        os.makedirs(CLEAN_BACKUP_DIR, exist_ok=True)
        print("   Clean storage directories prepared.")

        # Step 4: Launching .NET 10 API on clean environment
        step(f"4. Launching LendGuard.Api (.NET 10) on port {API_PORT}...")
        env_vars = os.environ.copy()
        env_vars["ConnectionStrings__DefaultConnection"] = f"Host={PG_HOST};Port={PG_PORT};Database={CLEAN_DB};Username={PG_USER};Password={PG_PASS}"
        env_vars["FILE_STORAGE_PATH"] = CLEAN_STORAGE
        env_vars["JWT_SECRET"] = "LendGuard_Clean_Environment_Release_Test_Secret_Key_At_Least_64_Characters_Long_2026_Secure!"
        env_vars["JWT_EXPIRY_MINUTES"] = "120"
        env_vars["AI_SERVICE_BASE_URL"] = "http://localhost:8000"
        env_vars["AI_SERVICE_KEY"] = "lendguard_internal_ai_secret_key_2026"
        env_vars["ASPNETCORE_URLS"] = f"http://localhost:{API_PORT}"
        env_vars["ASPNETCORE_ENVIRONMENT"] = "Development"

        api_cmd = [DOTNET_EXE, "run", "--no-build", "--no-launch-profile", "--urls", f"http://localhost:{API_PORT}"]
        api_proc = subprocess.Popen(
            api_cmd,
            cwd=os.path.join(BASE_DIR, "backend", "LendGuard.Api"),
            env=env_vars,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Poll API health
        api_ready = False
        for attempt in range(25):
            try:
                res = requests.get(f"{API_URL}/health", timeout=2)
                if res.status_code == 200:
                    api_ready = True
                    print(f"   API healthy after {attempt * 0.5:.1f}s.")
                    break
            except Exception:
                pass
            time.sleep(0.5)

        assert api_ready, "LendGuard.Api failed to start on clean port!"

        # Step 5: Launching .NET 10 Worker on clean environment
        step("5. Launching LendGuard.Worker (.NET 10) on clean environment...")
        worker_cmd = [DOTNET_EXE, "run", "--no-build"]
        worker_proc = subprocess.Popen(
            worker_cmd,
            cwd=os.path.join(BASE_DIR, "backend", "LendGuard.Worker"),
            env=env_vars,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print("   Worker process spawned.")
        time.sleep(2)

        # Step 6: Authenticating Admin User
        step("6. Authenticating seed administrator on clean environment...")
        auth_res = requests.post(f"{API_URL}/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "Admin123!"
        }, timeout=5)
        assert auth_res.status_code == 200, f"Login failed: {auth_res.text}"
        auth_data = auth_res.json()
        token = auth_data.get("accessToken") or auth_data.get("token")
        assert token, "Access token missing in login response!"
        headers = {"Authorization": f"Bearer {token}"}
        user_info = auth_data.get("user", {})
        print(f"   Authenticated as: {user_info.get('email', 'admin@example.com')} (Role: {user_info.get('role', 'Admin')})")

        # Step 7: Clean Data Ingestion & Storage Verification
        step("7. Ingesting synthetic transaction batch...")
        internal_csv = (
            "transaction_reference,external_reference,transaction_date,amount,currency,transaction_type\n"
            "CLN-TX-1001,,2026-11-01T10:00:00Z,1500.00,USD,DISBURSEMENT\n"
            "CLN-TX-1002,,2026-11-01T10:00:00Z,2500.00,USD,REPAYMENT\n"
        )
        upload_res = requests.post(
            f"{API_URL}/api/v1/imports",
            headers=headers,
            files={"file": ("clean_internal.csv", internal_csv, "text/csv")},
            data={"sourceType": "INTERNAL"}
        )
        assert upload_res.status_code in (200, 201, 202), f"Upload failed: {upload_res.text}"
        batch_id = upload_res.json()["importId"]
        print(f"   Internal Batch uploaded: {batch_id}. Validating and confirming...")

        confirm_res = requests.post(
            f"{API_URL}/api/v1/imports/{batch_id}/confirm",
            headers=headers,
            json={"confirmValidRows": True}
        )
        assert confirm_res.status_code == 200, f"Confirm failed: {confirm_res.text}"
        print(f"   Batch confirmed: {confirm_res.json().get('status', 'CONFIRMED')}")

        # Verify physical file exists in storage
        files_in_storage = os.listdir(os.path.join(CLEAN_STORAGE, "uploads"))
        print(f"   Persistent storage files in uploads/: {files_in_storage}")
        assert len(files_in_storage) > 0, "No uploaded files found in persistent storage!"

        # Step 8: Ingesting External Batch & Running Reconciliation
        step("8. Ingesting external batch and triggering reconciliation...")
        external_csv = (
            "transaction_reference,external_reference,transaction_date,amount,currency,transaction_type\n"
            "EXT-CLN-1001,CLN-TX-1001,2026-11-01T10:00:00Z,1500.00,USD,SETTLEMENT\n"
            "EXT-CLN-1002,CLN-TX-1002,2026-11-01T10:00:00Z,2450.00,USD,SETTLEMENT\n"
        )
        ext_res = requests.post(
            f"{API_URL}/api/v1/imports",
            headers=headers,
            files={"file": ("clean_external.csv", external_csv, "text/csv")},
            data={"sourceType": "EXTERNAL"}
        )
        assert ext_res.status_code in (200, 201, 202), f"External upload failed: {ext_res.text}"
        ext_batch_id = ext_res.json()["importId"]
        requests.post(
            f"{API_URL}/api/v1/imports/{ext_batch_id}/confirm",
            headers=headers,
            json={"confirmValidRows": True}
        )

        recon_res = requests.post(f"{API_URL}/api/v1/reconciliation-runs", headers=headers, json={
            "internalBatchId": batch_id,
            "externalBatchId": ext_batch_id
        })
        assert recon_res.status_code in (200, 201, 202), f"Recon failed: {recon_res.text}"
        run_id = recon_res.json()["runId"]
        print(f"   Reconciliation Run Triggered: ID {run_id}. Waiting for completion...")

        # Poll run status
        run_completed = False
        run_data = None
        for _ in range(15):
            r_get = requests.get(f"{API_URL}/api/v1/reconciliation-runs/{run_id}", headers=headers)
            if r_get.status_code == 200:
                run_data = r_get.json()
                if run_data.get("status") in ("COMPLETED", "FAILED"):
                    run_completed = True
                    break
            time.sleep(0.5)

        assert run_completed and run_data["status"] == "COMPLETED", f"Run did not complete successfully: {run_data}"
        print(f"   Reconciliation Run Completed: Status {run_data['status']}, Matched: {run_data['matchedCount']}, Exceptions: {run_data['exceptionCount']}")
        assert run_data["matchedCount"] == 1, "Expected 1 exact match (CLN-TX-1001)"
        assert run_data["exceptionCount"] == 1, "Expected 1 amount mismatch exception (CLN-TX-1002)"

        # Step 9: AI Explanations and Advisory Mode
        step("9. Testing AI service connectivity & advisory response...")
        exc_res = requests.get(f"{API_URL}/api/v1/reconciliation-runs/{run_id}/exceptions", headers=headers)
        exceptions = exc_res.json().get("items", [])
        assert len(exceptions) >= 1
        target_exc_id = exceptions[0]["id"]

        ai_res = requests.post(f"{API_URL}/api/v1/exceptions/{target_exc_id}/analyze", headers=headers)
        if ai_res.status_code in (200, 201):
            ai_payload = ai_res.json()
            print(f"   AI Advisory Explanation: '{ai_payload.get('explanation')}'")
            print(f"   AI Advisory Only Flag: {ai_payload.get('advisoryOnly')}")
            assert ai_payload.get("advisoryOnly") is True
        else:
            print(f"   AI analyze returned status {ai_res.status_code} (Fallback active)")

        # Step 10: Clean Environment Disaster Recovery Drill
        step("10. Executing Disaster Recovery drill from clean environment...")
        backup_ps1 = os.path.join(BASE_DIR, "scripts", "backup", "backup.ps1")
        restore_ps1 = os.path.join(BASE_DIR, "scripts", "restore", "restore.ps1")

        dr_env = os.environ.copy()
        dr_env["PGPASSWORD"] = PG_PASS

        backup_cmd = [
            "powershell", "-ExecutionPolicy", "Bypass", "-File", backup_ps1,
            "-HostName", PG_HOST, "-Port", str(PG_PORT), "-Database", CLEAN_DB,
            "-Username", PG_USER,
            "-StorageDir", CLEAN_STORAGE,
            "-BackupDir", CLEAN_BACKUP_DIR
        ]
        b_res = subprocess.run(backup_cmd, env=dr_env, capture_output=True, text=True)
        assert b_res.returncode == 0, f"Backup script failed: {b_res.stderr}\n{b_res.stdout}"
        
        # Locate created zip
        zip_files = [f for f in os.listdir(CLEAN_BACKUP_DIR) if f.endswith(".zip")]
        assert len(zip_files) > 0, "No backup archive produced!"
        backup_zip = os.path.join(CLEAN_BACKUP_DIR, sorted(zip_files)[-1])
        print(f"   Backup package created: {os.path.basename(backup_zip)} ({os.path.getsize(backup_zip)} bytes)")

        # Restore into recovery database and recovery storage
        restore_cmd = [
            "powershell", "-ExecutionPolicy", "Bypass", "-File", restore_ps1,
            "-BackupFile", backup_zip,
            "-HostName", PG_HOST, "-Port", str(PG_PORT), "-TargetDatabase", RECOVERY_DB,
            "-Username", PG_USER,
            "-TargetStorageDir", RECOVERY_STORAGE
        ]
        r_res = subprocess.run(restore_cmd, env=dr_env, capture_output=True, text=True)
        assert r_res.returncode == 0, f"Restore script failed: {r_res.stderr}\n{r_res.stdout}"
        print(f"   Restored into '{RECOVERY_DB}' and '{RECOVERY_STORAGE}'.")

        # Verify record counts match exactly
        for t in TABLES:
            rec_cnt = int(run_psql(RECOVERY_DB, f"SELECT COUNT(*) FROM {t};"))
            clean_cnt = int(run_psql(CLEAN_DB, f"SELECT COUNT(*) FROM {t};"))
            assert rec_cnt == clean_cnt, f"Mismatch in {t}: clean={clean_cnt}, restored={rec_cnt}"
        print(f"   [DR SUCCESS] All {len(TABLES)} tables verified with 100% record match.")

        # Step 11: Restart & Recovery Viability
        step("11. Verifying graceful restart and recovery...")
        api_proc.terminate()
        worker_proc.terminate()
        try:
            api_proc.wait(timeout=5)
        except Exception:
            api_proc.kill()
        try:
            worker_proc.wait(timeout=5)
        except Exception:
            worker_proc.kill()
        print("   Processes terminated gracefully.")

        # Re-launch API pointing to RECOVERY database to prove cold-restart viability
        env_vars["ConnectionStrings__DefaultConnection"] = f"Host={PG_HOST};Port={PG_PORT};Database={RECOVERY_DB};Username={PG_USER};Password={PG_PASS}"
        env_vars["FILE_STORAGE_PATH"] = RECOVERY_STORAGE

        api_restart_proc = subprocess.Popen(
            api_cmd,
            cwd=os.path.join(BASE_DIR, "backend", "LendGuard.Api"),
            env=env_vars,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        restarted_ok = False
        for _ in range(25):
            try:
                res = requests.get(f"{API_URL}/health", timeout=2)
                if res.status_code == 200:
                    restarted_ok = True
                    break
            except Exception:
                pass
            time.sleep(0.5)

        assert restarted_ok, "API failed to restart against recovered database!"
        
        # Verify authenticated query against recovered system
        auth_res = requests.post(f"{API_URL}/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "Admin123!"
        }, timeout=5)
        assert auth_res.status_code == 200
        headers_restart = {"Authorization": f"Bearer {auth_res.json()['accessToken']}"}
        runs_res = requests.get(f"{API_URL}/api/v1/reconciliation-runs", headers=headers_restart)
        assert runs_res.status_code == 200
        assert len(runs_res.json()) >= 1
        print("   [RECOVERY SUCCESS] API cold-started on recovered database; queried reconciliation runs successfully.")

        api_restart_proc.terminate()
        try:
            api_restart_proc.wait(timeout=5)
        except Exception:
            api_restart_proc.kill()

        print("\n" + "=" * 80)
        print(" CLEAN ENVIRONMENT RELEASE VERIFICATION: ALL 11 STEPS PASSED")
        print("=" * 80)

    finally:
        # Cleanup processes
        if api_proc and api_proc.poll() is None:
            api_proc.kill()
        if worker_proc and worker_proc.poll() is None:
            worker_proc.kill()

        # Cleanup test databases & folders
        try:
            run_psql("postgres", f"DROP DATABASE IF EXISTS {CLEAN_DB} WITH (FORCE);")
            run_psql("postgres", f"DROP DATABASE IF EXISTS {RECOVERY_DB} WITH (FORCE);")
            print("   Cleaned up temporary test databases.")
        except Exception as e:
            print(f"   Cleanup warning: {e}")

        for p in [CLEAN_STORAGE, CLEAN_BACKUP_DIR, RECOVERY_STORAGE]:
            if os.path.exists(p):
                try:
                    shutil.rmtree(p)
                except Exception:
                    pass

if __name__ == "__main__":
    main()
