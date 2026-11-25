"""
LENDGUARD AI — Enterprise Initial Administrator Bootstrap Utility
Provisions an initial enterprise Administrator account directly into PostgreSQL.
Used when SEED_TEST_USERS=false to securely bootstrap staging and production environments
without hardcoded development credentials or credentials stored in source control.
"""

import sys
import os
import argparse
import uuid
import datetime
import subprocess

PSQL_PATH = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

def run_psql(host, port, user, password, db, sql_cmd):
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    cmd = [PSQL_PATH, "-h", host, "-p", str(port), "-U", user, "-d", db, "-t", "-A", "-c", sql_cmd]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.returncode != 0 and "ERROR" in res.stderr:
        raise RuntimeError(f"Database query error: {res.stderr}")
    return res.stdout.strip()

def hash_password(password: str) -> str:
    # Use BCrypt if installed, or call C# / python bcrypt
    try:
        import bcrypt
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")
    except ImportError:
        # Fallback to dotnet inline execution or standard python library
        script = f"""
using System;
Console.Write(BCrypt.Net.BCrypt.HashPassword("{password}"));
"""
        # Alternatively call python with virtual environment
        venv_py = os.path.join(os.path.dirname(__file__), "..", "..", "ai-service", "venv", "Scripts", "python.exe")
        if os.path.exists(venv_py):
            py_code = f"import bcrypt; print(bcrypt.hashpw(b'{password}', bcrypt.gensalt(12)).decode('utf-8'))"
            res = subprocess.run([venv_py, "-c", py_code], capture_output=True, text=True)
            if res.returncode == 0:
                return res.stdout.strip()
        # Direct hash via powershell
        ps_cmd = f"& '{os.path.join(os.environ.get('USERPROFILE', ''), '.dotnet', 'dotnet.exe')}' run --project '{os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'LendGuard.Domain')}'"
        raise RuntimeError("bcrypt package required. Install with 'pip install bcrypt'.")

def bootstrap_admin(host, port, user, password, db, email, name, admin_pass, role="Admin"):
    role_normalized = role.upper()
    print("=" * 70)
    print(f" LENDGUARD AI: ENTERPRISE {role_normalized} PROVISIONING")
    print("=" * 70)
    print(f"Target Database : {db} on {host}:{port}")
    print(f"User Email      : {email}")
    print(f"User Name       : {name}")
    print(f"Assigned Role   : {role_normalized}")

    # Check if user already exists
    existing = run_psql(host, port, user, password, db, f"SELECT count(*) FROM users WHERE email = '{email}';")
    if int(existing or "0") > 0:
        print(f"\n[INFO] User '{email}' already exists in database. Updating credentials & role...")
        pwd_hash = hash_password(admin_pass)
        update_sql = f"""
        UPDATE users 
        SET full_name = '{name}', 
            password_hash = '{pwd_hash}', 
            role = '{role_normalized}', 
            is_active = TRUE, 
            updated_at = now() 
        WHERE email = '{email}';
        """
        run_psql(host, port, user, password, db, update_sql)
        print(f"[SUCCESS] User '{email}' credentials updated successfully.")
        return

    # Generate BCrypt hash
    pwd_hash = hash_password(admin_pass)
    user_id = str(uuid.uuid4())

    insert_sql = f"""
    INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
    VALUES (
        '{user_id}',
        '{name}',
        '{email}',
        '{pwd_hash}',
        '{role_normalized}',
        TRUE,
        now(),
        now()
    );
    """
    run_psql(host, port, user, password, db, insert_sql)
    print(f"\n[SUCCESS] Enterprise {role_normalized} provisioned successfully.")
    print(f"User ID   : {user_id}")
    print(f"Role      : {role_normalized}")
    print(f"Status    : Active")
    print("=" * 70)

def main():
    parser = argparse.ArgumentParser(description="Bootstrap initial LendGuard enterprise administrator or analyst.")
    parser.add_argument("--host", default=os.getenv("STAGING_DB_HOST", "localhost"), help="PostgreSQL host")
    parser.add_argument("--port", type=int, default=int(os.getenv("STAGING_DB_PORT", "5433")), help="PostgreSQL port")
    parser.add_argument("--db", default=os.getenv("STAGING_DB_NAME", "lendguard_staging"), help="Database name")
    parser.add_argument("--user", default=os.getenv("STAGING_DB_USER", "postgres"), help="Database user")
    parser.add_argument("--password", default=os.getenv("STAGING_DB_PASSWORD", "postgres"), help="Database password")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--name", default="Staging Enterprise Administrator", help="User full name")
    parser.add_argument("--admin-password", required=True, help="Secure password for user")
    parser.add_argument("--role", default="Admin", choices=["Admin", "Analyst"], help="User role (Admin/Analyst)")

    args = parser.parse_args()

    bootstrap_admin(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        db=args.db,
        email=args.email,
        name=args.name,
        admin_pass=args.admin_password,
        role=args.role
    )

if __name__ == "__main__":
    main()
