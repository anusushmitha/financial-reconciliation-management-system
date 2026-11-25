# LENDGUARD AI — Operational Troubleshooting Matrix

This matrix provides operational personnel and system administrators with diagnostic procedures and resolutions for common system symptoms.

| Category | Symptom | Root Cause | Diagnostic Check | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Operator cannot log in; receives "Email or password is incorrect" | Bad credentials, deactivated account, or expired password | Check `SELECT is_active, failed_login_attempts FROM users WHERE email = ?` | Verify account status; reset password via Admin User Management (S16) or Forgot Password (S02). |
| **Ingestion** | CSV upload fails with HTTP 422 or syntax rejection | Missing headers, invalid date format, or invalid currency | Inspect `SELECT * FROM import_row_errors WHERE import_batch_id = ?` | Ensure CSV conforms to RFC 4180 with standard headers (`transaction_reference`, `transaction_date`, `amount`, `currency`). |
| **Reconciliation** | Run stays in `QUEUED` or `PROCESSING` indefinitely | Worker daemon stopped or job locked by dead worker instance | Query `SELECT id, status, locked_at, locked_by FROM background_jobs WHERE status = 'LOCKED'` | Restart `LendGuard.Worker`. Worker will automatically reclaim expired leases (`locked_at < NOW() - 5 min`). |
| **Reconciliation** | Reconciliation produces `AMBIGUOUS_MATCH` | Conflicting candidates or transaction date falls outside configured tolerance window | Query `SELECT evidence FROM reconciliation_matches WHERE id = ?` or check `discrepancy_exceptions` | Review side-by-side evidence on S10/S12; adjudicate manually via human resolution dialog. |
| **AI Advisory** | AI Analysis returns fallback heuristic explanation | Python AI service offline or hosted LLM API key quota exhausted | `curl http://localhost:8000/health` | Restart AI uvicorn daemon; verify LLM provider credentials. Fallback ensures zero workflow interruption. |
| **Database** | Migration fails with "relation already exists" or connection refused | Port mismatch (host 5433 vs Docker 5432) or partial migration | Check PostgreSQL listening port and `__EFMigrationsHistory` | Verify `ConnectionStrings__DefaultConnection` matches target PostgreSQL instance port. |
| **Security / RBAC** | Analyst receives HTTP 403 when modifying exception | IDOR / BOLA protection: exception assigned to another analyst | Check `assigned_to` column in `exceptions` table | Reassign exception to the requesting analyst via Admin console (S11/S16) or act as Admin. |
| **Storage** | File upload returns "Disk full" or IO exception | Storage directory permissions or disk threshold reached | Check free disk space on storage volume | Expand storage partition or archive old batch files using `scripts/backup/backup.ps1`. |
