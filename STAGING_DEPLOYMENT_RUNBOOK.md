# LENDGUARD AI — STAGING DEPLOYMENT RUNBOOK

**Target Environment:** Staging / Pre-Production Validation  
**Release Tag:** `v1.0.0-rc.1`  
**Execution Audience:** DevOps Engineers, Platform Engineers, Release Managers  

---

## 1. Prerequisites & Target Infrastructure

Before deploying the release candidate to Staging, ensure the following infrastructure is provisioned:

1. **Host Platform:** Linux VM (Ubuntu 22.04 LTS / Debian 12) or Kubernetes Cluster (v1.28+)
2. **Container Runtimes:** Docker Engine 24.0+ & Docker Compose v2.20+
3. **Database Server:** PostgreSQL 16.x instance with `uuid-ossp` extension support
4. **Network Access & Firewall:**
   - Ingress port `443` (HTTPS) to Frontend / Reverse Proxy
   - Ingress port `5000` internal only (API service)
   - Ingress port `8000` internal only (AI microservice - **never public**)
   - Ingress port `5432` internal only (PostgreSQL database)
5. **Persistent Storage Volume:** Mount path `/var/lendguard/storage` (minimum 50 GB SSD)

---

## 2. Environment Configuration & Secret Injection

Create `/etc/lendguard/staging.env` (permissions: `0600`, owned by `lendguard:lendguard`):

```bash
# ASP.NET Core API Configuration
ASPNETCORE_ENVIRONMENT=Staging
REQUIRE_HTTPS=true
ConnectionStrings__DefaultConnection="Host=staging-db.internal;Port=5432;Database=lendguard_staging;Username=lendguard_app;Password=${STAGING_DB_PASSWORD};SslMode=Require"
JWT_SECRET="${STAGING_JWT_SECRET_64_CHAR}"
JWT_EXPIRY_MINUTES=120
FILE_STORAGE_PATH=/var/lendguard/storage
AI_SERVICE_BASE_URL=http://ai-service.internal:8000
AI_SERVICE_KEY="${STAGING_AI_SERVICE_KEY}"

# Production Safety Boundary: NEVER seed development passwords
SEED_TEST_USERS=false

# AI Microservice Configuration
AI_SERVICE_PORT=8000
LLM_PROVIDER=mock
LLM_API_KEY="${STAGING_LLM_KEY}"
LLM_MODEL=gpt-4o-mini
```

---

## 3. Step-by-Step Deployment Procedure

### Step 3.1: Persistent Storage Initialization
```bash
sudo mkdir -p /var/lendguard/storage/uploads
sudo mkdir -p /var/lendguard/storage/exports
sudo mkdir -p /var/lendguard/backups
sudo chown -R 1000:1000 /var/lendguard
sudo chmod -R 750 /var/lendguard
```

### Step 3.2: Database Schema & Migration Execution
Run the migrations in strict numerical order using the PostgreSQL administrator:

```bash
export PGPASSWORD="${STAGING_DB_ADMIN_PASSWORD}"

# 1. Apply primary DDL schema
psql -h staging-db.internal -p 5432 -U postgres -d lendguard_staging \
     -f database/migrations/001_initial_schema.sql

# 2. Apply immutability triggers (audit_logs & investigation_notes)
psql -h staging-db.internal -p 5432 -U postgres -d lendguard_staging \
     -f database/migrations/002_immutability_triggers.sql

# 3. Verify all 13 tables exist
psql -h staging-db.internal -p 5432 -U postgres -d lendguard_staging \
     -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
# Expected output: 13
```

### Step 3.3: Initial Administrator Provisioning (Bootstrap CLI)
Because `SEED_TEST_USERS=false` is enforced, create the initial staging administrator with an approved corporate identity:

```bash
# Generate secure password hash
ADMIN_HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'${STAGING_INITIAL_ADMIN_PASS}', bcrypt.gensalt()).decode())")

# Insert initial enterprise administrator
psql -h staging-db.internal -p 5432 -U postgres -d lendguard_staging <<EOF
INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    'Staging Enterprise Admin',
    'staging-admin@company.com',
    '${ADMIN_HASH}',
    'Admin',
    TRUE,
    now(),
    now()
) ON CONFLICT (email) DO NOTHING;
EOF
```

### Step 3.4: Container Build & Service Startup
```bash
# Pull latest Release Candidate tag
git checkout tags/v1.0.0-rc.1

# Build and start services using Docker Compose
docker compose -f docker-compose.yml --env-file /etc/lendguard/staging.env up -d --build
```

---

## 4. Post-Deployment Verification & Smoke Tests

### 4.1 Health Check Verification
```bash
# 1. Verify Backend API health
curl -f -s http://localhost:5000/health
# Expected: {"status":"Healthy"}

# 2. Verify AI Microservice health
curl -f -s http://localhost:8000/internal/v1/health
# Expected: {"status":"healthy", "advisory_mode":true}
```

### 4.2 Ingestion & Reconciliation Smoke Test
Execute the automated regression runner against the staging endpoint:
```bash
python3 tests/reconciliation/test_reconciliation_matrix.py --api-url https://staging-recon.internal.company.com
# Expected output: ALL RULES VERIFIED SUCCESSFULLY (100% PASS)
```

---

## 5. Rollback Thresholds & Emergency Criteria

Initiate immediate rollback under any of the following conditions:
1. `GET /health` fails for 3 consecutive minutes.
2. Background worker stalls or memory grows monotonically exceeding 1.5 GB.
3. Database connection pool exhaustion (`500 Internal Server Error` on API).
4. Reconciliation discrepancies violate zero-drift decimal tolerances.
