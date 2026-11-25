# LENDGUARD AI — Environment Startup, Operation & Reset Guide
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Git Commit Hash:** `89117ee` (Base: `3b5aab3`)  
**Target Audience:** Site Reliability Engineers, DevOps Engineers, and Demonstration Leads  
**Classification:** Operational Runbook & Environment Control Guide  

---

## 1. Overview & Architecture Port Matrix

This guide provides the exact, repeatable procedure for starting, verifying, operating, resetting, and shutting down the LendGuard AI multi-service staging environment.

```
+-----------------------------------------------------------------------------------+
|                            SERVICE PORT & NETWORK MATRIX                          |
+-----------------------------------------------------------------------------------+
 Service Component         Runtime / Engine         Port      Network Binding
 -----------------------------------------------------------------------------------
 PostgreSQL Database       PostgreSQL 16.3          5433      localhost / Internal
 Python AI Microservice    FastAPI / Uvicorn        8000      127.0.0.1 (Loopback)
 Backend Web API           ASP.NET Core (.NET 10)   5000      localhost / Internal
 Background Outbox Worker  C# Worker Service        --        Background Daemon
 Frontend Web SPA          React 18 / Vite          5173      localhost / Ingress
+-----------------------------------------------------------------------------------+
```

---

## 2. Step-by-Step Environment Startup Procedure

To prevent race conditions, services must be initialized in the exact order specified below:

```
[ Step 1: PostgreSQL ] --> [ Step 2: AI Service ] --> [ Step 3: Backend API ] --> [ Step 4: Worker ] --> [ Step 5: Frontend ]
```

### Step 1: Start PostgreSQL 16 Database Cluster
Ensure PostgreSQL 16 is running on port 5433 with the staging data directory:
```powershell
# In PowerShell Terminal 1:
& "C:\Program Files\PostgreSQL\16\bin\postgres.exe" -D "C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\database\data" -p 5433
```
*Verification:* Confirm PostgreSQL is listening on port 5433.

---

### Step 2: Start Python AI Advisory Microservice
Activate the virtual environment and start the Uvicorn ASGI server:
```powershell
# In PowerShell Terminal 2:
cd "C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\ai-service"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*Verification:* `curl http://localhost:8000/internal/v1/health -H "X-Internal-Service-Key: lendguard_internal_ai_secret_key_2026"` returns `{"status":"Healthy"}`.

---

### Step 3: Start ASP.NET Core Backend Web API (.NET 10 LTS)
Initialize the API service with staging environment variables:
```powershell
# In PowerShell Terminal 3:
$env:ASPNETCORE_ENVIRONMENT="Staging"
$env:SEED_TEST_USERS="false"
$env:ConnectionStrings__DefaultConnection="Host=localhost;Port=5433;Database=lendguard_staging;Username=postgres;Password=postgres"
$env:FILE_STORAGE_PATH="C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\storage_staging"
$env:JWT_SECRET="LendGuard_Staging_Super_Secret_High_Entropy_Key_2026_Secure_Must_Be_Long!"
$env:JWT_EXPIRY_MINUTES="120"
$env:AI_SERVICE_BASE_URL="http://localhost:8000"
$env:AI_SERVICE_KEY="lendguard_internal_ai_secret_key_2026"

cd "C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\backend\LendGuard.Api"
& "C:\Users\LENOVO\.dotnet\dotnet.exe" run --urls "http://localhost:5000"
```
*Verification:* `curl http://localhost:5000/health` returns `{"status":"Healthy"}` in `< 10ms`.

---

### Step 4: Start C# Background Outbox Worker (.NET 10 LTS)
Initialize the outbox worker to process asynchronous reconciliation and AI jobs:
```powershell
# In PowerShell Terminal 4:
$env:DOTNET_ENVIRONMENT="Staging"
$env:ConnectionStrings__DefaultConnection="Host=localhost;Port=5433;Database=lendguard_staging;Username=postgres;Password=postgres"
$env:FILE_STORAGE_PATH="C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\storage_staging"
$env:AI_SERVICE_BASE_URL="http://localhost:8000"
$env:AI_SERVICE_KEY="lendguard_internal_ai_secret_key_2026"

cd "C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\backend\LendGuard.Worker"
& "C:\Users\LENOVO\.dotnet\dotnet.exe" run
```
*Verification:* Logs show: `"LendGuard Background Worker Service started. Worker ID: worker-..."`.

---

### Step 5: Start React 18 Frontend Application
Launch the production preview server on port 5173:
```powershell
# In PowerShell Terminal 5:
cd "C:\Users\LENOVO\.gemini\antigravity\scratch\lendguard-ai\frontend"
npm run preview -- --port 5173 --host
```
*Verification:* Navigate to `http://localhost:5173` in a web browser; login page renders.

---

## 3. End-to-End Health Verification

Execute the automated multi-service health monitoring utility:
```bash
python scripts/monitoring/health_check.py --format text
```

**Expected JSON Response:**
```json
{
  "timestamp": "2026-11-19T11:09:25Z",
  "overall_status": "HEALTHY",
  "components": {
    "database": {
      "status": "HEALTHY",
      "latency_ms": 279.12,
      "table_count": 13,
      "active_connections": 1,
      "pending_outbox_jobs": 0,
      "deadlocks_recorded": 0
    },
    "backend_api": {
      "status": "HEALTHY",
      "status_code": 200,
      "latency_ms": 5.05,
      "payload": {
        "status": "Healthy"
      }
    },
    "ai_service": {
      "status": "HEALTHY",
      "status_code": 200,
      "latency_ms": 1057.0,
      "payload": {
        "status": "Healthy",
        "service": "lendguard-ai-service",
        "version": "1.0.0"
      }
    },
    "persistent_storage": {
      "status": "HEALTHY",
      "path": "C:\\Users\\LENOVO\\.gemini\\antigravity\\scratch\\lendguard-ai\\storage_staging",
      "read_write_verified": true
    }
  }
}
```

---

## 4. Safe Reset Procedure Between Demonstrations

To ensure that each demonstration begins with a clean, pristine database state, execute the following safe reset routine:

```bash
# 1. Terminate any active sessions in browser
# 2. Run the clean database restoration drill
python scripts/dr/restore_database.py --backup-file database/backups/lendguard_backup_clean_baseline.zip

# 3. Clean temporary CSV exports
Remove-Item -Path "storage_staging/exports/*" -Force -Recurse

# 4. Verify baseline users
python scripts/monitoring/verify_pilot_baseline.py
```

---

## 5. Live Demonstration Troubleshooting & Failure Recovery

| Anomaly / Failure | Root Cause | Immediate Recovery Action |
| :--- | :--- | :--- |
| **API returns 500 on Login** | Staging database connection dropped | Verify PostgreSQL process on port 5433: `Get-Process postgres`. If stopped, rerun Step 1. |
| **Outbox Jobs remain 'QUEUED'** | Worker daemon crashed or paused | Restart `LendGuard.Worker` in Terminal 4. It will immediately claim pending jobs with `FOR UPDATE SKIP LOCKED`. |
| **AI Explanation times out** | Python ASGI service hung | In Terminal 2, press `Ctrl+C` and re-run Uvicorn. System automatically applies deterministic rule fallback. |
| **Frontend displays white screen** | Vite preview process stopped | In Terminal 5, run: `npm run preview -- --port 5173 --host`. Refresh browser. |

---

## 6. Safe Environment Shutdown Procedure

When demonstrations are completed, terminate processes in reverse order:
1. Stop Frontend: Press `Ctrl+C` in Terminal 5.
2. Stop Worker: Press `Ctrl+C` in Terminal 4.
3. Stop API: Press `Ctrl+C` in Terminal 3.
4. Stop AI Service: Press `Ctrl+C` in Terminal 2.
5. Stop PostgreSQL: Send fast shutdown to PostgreSQL in Terminal 1.
