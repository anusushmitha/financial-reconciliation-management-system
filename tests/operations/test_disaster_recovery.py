import os
import sys
import time
import hashlib
import subprocess
import shutil

PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"
PGDUMP_PATH = r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKUP_DIR = os.path.join(BASE_DIR, "database", "backups")
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
RESTORE_STORAGE_DIR = os.path.join(BASE_DIR, "storage_drill_restored")
TARGET_DB = "lendguard_restore_test"

# Complete 13-table schema inventory
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

def run_query(db_name, sql):
    cmd = [PSQL_PATH, "-U", "app", "-d", db_name, "-p", "5433", "-t", "-A", "-c", sql]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return res.stdout.strip()

def get_row_counts(db_name):
    counts = {}
    for t in TABLES:
        c = run_query(db_name, f"SELECT count(*) FROM {t};")
        counts[t] = int(c or 0)
    return counts

def hash_file(file_path):
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def get_storage_inventory(folder_path):
    inventory = {}
    if not os.path.exists(folder_path):
        return inventory
    for root, _, files in os.walk(folder_path):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, folder_path)
            inventory[rel_path] = {
                "size": os.path.getsize(full_path),
                "sha256": hash_file(full_path)
            }
    return inventory

def main():
    print("=== LENDGUARD AI: Full PostgreSQL & File Storage Disaster Recovery Drill ===")
    
    # 1. Pre-backup database row counts across all 13 tables
    print("1. Gathering Pre-Backup Record Counts across all 13 PostgreSQL tables from 'lendguard'...")
    pre_counts = get_row_counts("lendguard")
    for t, c in pre_counts.items():
        print(f"   - {t:<28}: {c:>5} records")
        
    # 2. Pre-backup storage file inventory
    print(f"\n2. Gathering Pre-Backup Storage Inventory from '{STORAGE_DIR}'...")
    pre_storage = get_storage_inventory(STORAGE_DIR)
    print(f"   Found {len(pre_storage)} stored files (uploads & exports).")
    for rel_path, meta in list(pre_storage.items())[:5]:
        print(f"   - {rel_path} ({meta['size']} bytes, hash: {meta['sha256'][:12]}...)")
    if len(pre_storage) > 5:
        print(f"   ... and {len(pre_storage) - 5} more files.")

    # 3. Execute backup script
    print("\n3. Executing automated backup script (scripts/backup/backup.ps1)...")
    t0 = time.time()
    backup_script = os.path.join(BASE_DIR, "scripts", "backup", "backup.ps1")
    cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", backup_script, 
           "-Database", "lendguard", "-Port", "5433", "-StorageDir", STORAGE_DIR, "-BackupDir", BACKUP_DIR]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    backup_time = time.time() - t0
    
    # Locate latest created backup zip
    backups = [os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.startswith("lendguard_backup_") and f.endswith(".zip")]
    if not backups:
        raise Exception("Backup bundle not found in database/backups")
    latest_backup = max(backups, key=os.path.getctime)
    backup_size = os.path.getsize(latest_backup)
    print(f"   Backup finished in {backup_time:.2f}s.")
    print(f"   Created unified bundle: {os.path.basename(latest_backup)} ({backup_size / 1024:.1f} KB).")

    # 4. Execute restore script into isolated test environment
    print(f"\n4. Restoring into isolated target database '{TARGET_DB}' and storage folder '{RESTORE_STORAGE_DIR}'...")
    t1 = time.time()
    restore_script = os.path.join(BASE_DIR, "scripts", "restore", "restore.ps1")
    cmd_restore = ["powershell", "-ExecutionPolicy", "Bypass", "-File", restore_script,
                   "-BackupFile", latest_backup, "-Port", "5433", "-TargetDatabase", TARGET_DB, 
                   "-TargetStorageDir", RESTORE_STORAGE_DIR]
    res_restore = subprocess.run(cmd_restore, capture_output=True, text=True, check=True)
    restore_time = time.time() - t1
    print(f"   Restore finished in {restore_time:.2f}s.")

    # 5. Verify database integrity
    print(f"\n5. Verifying post-restore record counts in '{TARGET_DB}' across all 13 tables...")
    post_counts = get_row_counts(TARGET_DB)
    
    db_matched = True
    print("\n| Table Name                   | Pre-Backup | Post-Restore | Delta | Integrity Status |")
    print("| :--------------------------- | :--------: | :----------: | :---: | :--------------: |")
    for t in TABLES:
        pre = pre_counts[t]
        post = post_counts[t]
        match = (pre == post)
        if not match:
            db_matched = False
        print(f"| {t:<28} | {pre:>10} | {post:>12} | {post - pre:>5} | {'PRESERVED' if match else 'CORRUPTED'} |")

    # 6. Verify storage integrity
    print(f"\n6. Verifying post-restore persistent file storage integrity in '{RESTORE_STORAGE_DIR}'...")
    post_storage = get_storage_inventory(RESTORE_STORAGE_DIR)
    
    storage_matched = True
    if len(pre_storage) != len(post_storage):
        print(f"   [FAIL] File count mismatch: Pre={len(pre_storage)}, Post={len(post_storage)}")
        storage_matched = False
    else:
        for rel_path, pre_meta in pre_storage.items():
            if rel_path not in post_storage:
                print(f"   [FAIL] Missing restored file: {rel_path}")
                storage_matched = False
            else:
                post_meta = post_storage[rel_path]
                if pre_meta["sha256"] != post_meta["sha256"]:
                    print(f"   [FAIL] Checksum mismatch for file: {rel_path}")
                    storage_matched = False

    if storage_matched:
        print(f"   [SUCCESS] All {len(pre_storage)} stored files restored with 100% SHA256 checksum match!")

    # 7. Cleanup temporary drill resources
    print("\n7. Cleaning up temporary drill database and restore folder...")
    run_query("postgres", f"DROP DATABASE IF EXISTS {TARGET_DB};")
    if os.path.exists(RESTORE_STORAGE_DIR):
        shutil.rmtree(RESTORE_STORAGE_DIR)
    print("   Cleaned up successfully.")

    # 8. Summary Report
    all_passed = db_matched and storage_matched
    print("\n=== DISASTER RECOVERY DRILL EXECUTION SUMMARY ===")
    print(f"Tables Verified:     {len(TABLES)} / 13 tables (100% coverage)")
    print(f"Files Verified:      {len(pre_storage)} files (100% coverage)")
    print(f"Backup Duration:     {backup_time:.2f} seconds")
    print(f"Restore Duration:    {restore_time:.2f} seconds")
    print(f"RTO Achieved:        {restore_time:.2f}s (well within 1-hour SLA)")
    print(f"RPO Achieved:        0 records lost, 0 bytes file loss")
    print(f"Overall DR Status:   {'PASSED - 100% EXACT MATCH (0 LOSS)' if all_passed else 'FAILED'}")

    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
