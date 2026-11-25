# LENDGUARD AI — Platform Administrator Runbook

**Document Reference:** `docs/user-guides/ADMINISTRATOR_RUNBOOK.md`  
**Role:** System Administrator (`ADMIN`)  
**Scope:** Identity Governance, Exception Reassignment, Audit Trail Auditing, and Operational Maintenance  

---

## 1. Administrative Responsibilities & Boundaries

Platform Administrators oversee system integrity, user accounts, operational health, and audit compliance. Administrators **never** have the authority to bypass audit logging or directly delete financial records.

---

## 2. User Management Procedures (Screen S16 & S17)

### 2.1 Provisioning a New User
1. Navigate to **Users** (`/users`).
2. Click **Create User**.
3. Fill in user details:
   - **Full Name:** Official employee legal name.
   - **Email:** Corporate email address (must be unique).
   - **Role:** Select `ANALYST` or `ADMIN`.
   - **Temporary Password:** Meets complexity rules ($\ge 8$ chars, uppercase, lowercase, number, symbol).
4. Click **Save User**. The user is created in active status and logged to `audit_logs`.

### 2.2 Modifying Permitted User Details
1. In the User list, locate the user and click **Edit**.
2. Administrators can update:
   - Full Name
   - Role (`ANALYST` $\leftrightarrow$ `ADMIN`)
3. Email addresses and password hashes cannot be modified arbitrarily without audit verification.

### 2.3 Deactivating a User Account
1. Click the toggle or status button on the user row.
2. Select **Deactivate**.
3. **Safety Controls:**
   - **Self-Deactivation Prevention:** An Administrator cannot deactivate their own active account. The system rejects the attempt with an error.
   - **Last Admin Protection:** The system prevents deactivating or downgrading the last active Administrator in the organization.

---

## 3. Workload Reassignment (Screen S11 & S12)

When an analyst is on leave or an exception requires senior review:
1. Navigate to **Exceptions** (`/exceptions`).
2. Click on the target exception to view details.
3. In the assignment panel, select the new assignee from the dropdown of active users.
4. Click **Reassign**.
5. The reassignment is immediately logged with the Administrator's user ID in `audit_logs`.

---

## 4. Audit Trail Inspection (Screen S15)

1. Navigate to **Audit Logs** (`/audit-logs`).
2. Filter the immutable ledger by:
   - Date range (`From` - `To`)
   - Action type: `LOGIN`, `IMPORT_UPLOADED`, `RECONCILIATION_STARTED`, `EXCEPTION_RESOLVED`, `USER_CREATED`, `USER_DEACTIVATED`, `EXCEPTION_REASSIGNED`.
   - User ID or Entity ID.
3. Review details: Every row includes actor user ID, entity type, entity ID, action, JSON payload details, correlation ID, and UTC timestamp.
4. Remember: Audit log rows cannot be edited or deleted by anyone; database engine triggers enforce append-only immutability.

---

## 5. Operational Health & Troubleshooting

### 5.1 Checking Worker Service Health
If reconciliation runs remain in `QUEUED` status for $> 30$ seconds:
1. Verify the Background Worker process is running:
   ```powershell
   Get-Process -Name "*Worker*"
   ```
2. Query the PostgreSQL background jobs outbox:
   ```sql
   SELECT id, job_type, status, attempts, locked_at, locked_by 
   FROM background_jobs 
   WHERE status IN ('PENDING', 'PROCESSING');
   ```
3. If jobs appear stuck in `PROCESSING` past 5 minutes, the worker's automated recovery query will reclaim and re-queue them automatically upon next poll.
