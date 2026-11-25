import sys
import subprocess

import os

PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

def run_psql(cmd_str):
    user = os.environ.get("PGUSER", "postgres")
    dbname = os.environ.get("PGDATABASE", "lendguard_staging")
    cmd = [PSQL_PATH, "-U", user, "-d", dbname, "-p", "5433", "-c", cmd_str]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode, res.stdout, res.stderr

def test_audit_logs_immutability():
    print("1. Testing audit_logs UPDATE rejection...")
    # First, ensure there's at least one audit log entry or insert a test log
    code, out, err = run_psql("INSERT INTO audit_logs (id, action, entity_type, details) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'TEST_ACTION', 'TEST_ENTITY', '{}');")
    
    # Try updating the audit log
    code_upd, out_upd, err_upd = run_psql("UPDATE audit_logs SET action = 'TAMPERED' WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';")
    assert code_upd != 0, "Expected UPDATE on audit_logs to fail!"
    assert "immutable" in (err_upd + out_upd).lower(), f"Expected immutability error, got: {err_upd}"
    print(f"   PostgreSQL rejected UPDATE on audit_logs: {err_upd.strip()}")

    # Try deleting the audit log
    print("2. Testing audit_logs DELETE rejection...")
    code_del, out_del, err_del = run_psql("DELETE FROM audit_logs WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';")
    assert code_del != 0, "Expected DELETE on audit_logs to fail!"
    assert "immutable" in (err_del + out_del).lower(), f"Expected immutability error, got: {err_del}"
    print(f"   PostgreSQL rejected DELETE on audit_logs: {err_del.strip()}")
    return True

def test_investigation_notes_immutability():
    print("3. Testing investigation_notes UPDATE rejection...")
    # Get an existing exception and user to insert a note
    code, out, err = run_psql("""
    DO $$
    DECLARE
        v_exc_id UUID;
        v_user_id UUID;
    BEGIN
        SELECT id INTO v_exc_id FROM exceptions LIMIT 1;
        SELECT id INTO v_user_id FROM users LIMIT 1;
        IF v_exc_id IS NOT NULL AND v_user_id IS NOT NULL THEN
            INSERT INTO investigation_notes (id, exception_id, user_id, note)
            VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', v_exc_id, v_user_id, 'Original Note');
        END IF;
    END $$;
    """)

    # Try updating the note
    code_upd, out_upd, err_upd = run_psql("UPDATE investigation_notes SET note = 'Tampered Note' WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';")
    assert code_upd != 0, "Expected UPDATE on investigation_notes to fail!"
    assert "append-only" in (err_upd + out_upd).lower(), f"Expected append-only error, got: {err_upd}"
    print(f"   PostgreSQL rejected UPDATE on investigation_notes: {err_upd.strip()}")

    # Try deleting the note
    print("4. Testing investigation_notes DELETE rejection...")
    code_del, out_del, err_del = run_psql("DELETE FROM investigation_notes WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';")
    assert code_del != 0, "Expected DELETE on investigation_notes to fail!"
    assert "append-only" in (err_del + out_del).lower(), f"Expected append-only error, got: {err_del}"
    print(f"   PostgreSQL rejected DELETE on investigation_notes: {err_del.strip()}")
    return True

def main():
    print("=== LENDGUARD AI: Audit & Investigation Note Immutability Verification ===")
    t1 = test_audit_logs_immutability()
    t2 = test_investigation_notes_immutability()
    
    all_passed = t1 and t2
    print("\n=== SUMMARY ===")
    print(f"audit_logs Immutability:           {'PASSED' if t1 else 'FAILED'}")
    print(f"investigation_notes Append-Only:   {'PASSED' if t2 else 'FAILED'}")
    print(f"\nFinal Result: {'ALL IMMUTABILITY CHECKS PASSED' if all_passed else 'IMMUTABILITY CHECKS FAILED'}")
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
