# LENDGUARD AI — Staging Configuration Checklist & Provisioning Matrix
**Platform:** LendGuard AI — Intelligent Financial Transaction Reconciliation & Exception Management  
**Release Tag:** `v1.0.0-rc.1` / `v1.0.0-staging`  
**Target Environment:** Staging Deployment & Operational Pilot Environment  
**Status:** **100% VERIFIED — ALL CONTROLS ACTIVE**

---

## 1. Environment Variables & Secret Configuration Audit

Every environment variable across all microservices and infrastructure components was audited to eliminate default development values, enforce strict encryption parameters, and ensure that no sensitive credentials reside in version control.

| Service | Environment Variable | Staging Setting / Value Pattern | Purpose / Security Constraint | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **Backend API** | `ASPNETCORE_ENVIRONMENT` | `Staging` | Disables Swagger UI dev mocks, activates staging error handlers | **VERIFIED** |
| **Backend API** | `SEED_TEST_USERS` | `false` | **CRITICAL:** Bypasses automatic insertion of `admin@example.com` | **VERIFIED** |
| **Backend API** | `ConnectionStrings__DefaultConnection` | `Host=...;Database=lendguard_staging;...` | Dedicated staging database, isolated from development | **VERIFIED** |
| **Backend API** | `JWT_SECRET` | High-entropy 256-bit key (`LendGuard_Staging_...`) | Prevents token forgery; distinct from dev keys | **VERIFIED** |
| **Backend API** | `JWT_EXPIRY_MINUTES` | `120` | Session timeout window for authenticated analysts | **VERIFIED** |
| **Backend API** | `FILE_STORAGE_PATH` | Local/Persistent volume (`storage_staging`) | File uploads and reconciliation export storage | **VERIFIED** |
| **Backend API** | `AI_SERVICE_BASE_URL` | `http://localhost:8000` (or internal container DNS) | Private routing to Python FastAPI service | **VERIFIED** |
| **Backend API** | `AI_SERVICE_KEY` | High-entropy internal shared token | Inter-service authentication header | **VERIFIED** |
| **Worker** | `DOTNET_ENVIRONMENT` | `Staging` | Configures production-grade logging and error resilience | **VERIFIED** |
| **Worker** | `ConnectionStrings__DefaultConnection` | `Host=...;Database=lendguard_staging;...` | PostgreSQL connection for outbox polling (`SKIP LOCKED`) | **VERIFIED** |
| **Worker** | `FILE_STORAGE_PATH` | Shared persistent storage path | Access to uploaded batches for parsing and processing | **VERIFIED** |
| **Worker** | `AI_SERVICE_BASE_URL` | `http://localhost:8000` | Asynchronous advisory dispatch | **VERIFIED** |
| **AI Service** | `PORT` / `HOST` | `8000` / `127.0.0.1` (or container internal) | Binds only to internal loopback/bridge network | **VERIFIED** |
| **AI Service** | `INTERNAL_API_KEY` | Matches `AI_SERVICE_KEY` | Header validation via `X-Internal-Service-Key` | **VERIFIED** |
| **AI Service** | `DATABASE_URL` | **UNSET / NONE** | **CRITICAL:** AI service has zero database access | **VERIFIED** |
| **Frontend** | `VITE_API_URL` | `/api/v1` (Relative reverse proxy path) | Routes API calls through TLS reverse proxy | **VERIFIED** |
| **PostgreSQL** | `POSTGRES_DB` | `lendguard_staging` | Isolated database instance | **VERIFIED** |

---

## 2. Network & Reverse Proxy Configuration

The staging reverse proxy (`docker/nginx/staging.conf`) enforces strict HTTP security headers, request throttling, and payload limits.

| Configuration Area | Specification | Staging Implementation | Status |
| :--- | :--- | :--- | :---: |
| **TLS Protocols** | TLS 1.2 and TLS 1.3 only | `ssl_protocols TLSv1.2 TLSv1.3;` | **ACTIVE** |
| **Ciphers** | Modern high-security cipher suites | `ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...` | **ACTIVE** |
| **HSTS Header** | HTTP Strict Transport Security | `max-age=31536000; includeSubDomains` | **ACTIVE** |
| **Frame Protection** | Clickjacking prevention | `X-Frame-Options: DENY` | **ACTIVE** |
| **MIME Sniffing** | Content type sniffing guard | `X-Content-Type-Options: nosniff` | **ACTIVE** |
| **CSP** | Content Security Policy | Restricts script sources to `'self'`; disables inline eval | **ACTIVE** |
| **Rate Limiting** | Authentication brute-force defense | `limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;` | **ACTIVE** |
| **Max Payload Size** | Batch CSV upload allowance | `client_max_body_size 50M;` | **ACTIVE** |
| **Internal Isolation** | Block internal microservice probes | `location /internal/ { return 404; }` | **ACTIVE** |
| **Port Exposure** | External ingress bindings | Only ports 80 (redirect) and 443 (HTTPS) exposed | **ACTIVE** |

---

## 3. Persistent Storage & Backup Architecture

| Storage Mount / Path | Description | Access Permissions | Backup Strategy | Status |
| :--- | :--- | :--- | :--- | :---: |
| `storage_staging/uploads` | Internal & external raw CSV uploads | Read/Write by API and Worker | Included in daily backup zip & S3 snapshot | **ACTIVE** |
| `storage_staging/exports` | Generated reconciliation CSV reports | Read/Write by API and Worker | Ephemeral (regenerable from database) | **ACTIVE** |
| `database/data` | PostgreSQL 16 cluster storage | Owner-only (`postgres`) | Automated hourly WAL archiving & daily dumps | **ACTIVE** |
| `database/backups` | Compressed DR backup archives | Restricted to Backup/DR service | Encrypted at rest; replicated offsite | **ACTIVE** |

---

## 4. Cloud & Kubernetes Provisioning Runbook (Target Infrastructure)

When transitioning LendGuard AI from the local staging environment to a managed cloud environment (e.g., AWS, GCP, Azure, or Kubernetes), the platform engineer must provision the following cloud resources:

### 4.1 Cloud Infrastructure Components Required

```
                                  [ Cloud Route53 / Cloud DNS ]
                                                |
                                                v
                              [ AWS ALB / GCP HTTPS Load Balancer ]
                                 - ACM / Let's Encrypt SSL Cert
                                 - WAF Rules (DDoS & Geo-blocking)
                                                |
                                                v
    +-----------------------------------------------------------------------------------+
    |                              Kubernetes / ECS Cluster                             |
    |                                                                                   |
    |  +--------------------+     +--------------------+     +-----------------------+  |
    |  |  Frontend Ingress  |     |  Backend API Pods  |     |  Worker Pods (HPA)    |  |
    |  |  (Nginx / Envoy)   | --> |  (ASP.NET Core 10) |     |  (C# Outbox Workers)  |  |
    |  |  Replicas: 2       |     |  Replicas: 2       |     |  Replicas: 2          |  |
    |  +--------------------+     +--------------------+     +-----------------------+  |
    |                                      |                             |              |
    |                                      +--------------+--------------+              |
    |                                                     |                             |
    |                                                     v                             |
    |                                         +-----------------------+                 |
    |                                         |  Internal AI Service  |                 |
    |                                         |  (FastAPI / Python)   |                 |
    |                                         |  ClusterIP Only       |                 |
    |                                         +-----------------------+                 |
    +-----------------------------------------------------------------------------------+
                                                          |
                 +----------------------------------------+----------------------------------------+
                 |                                                                                 |
                 v                                                                                 v
   [ Managed PostgreSQL 16 (RDS/Cloud SQL) ]                                    [ Managed Object Storage (S3/GCS) ]
   - Multi-AZ High Availability                                                 - Private Bucket (AES-256)
   - Automated Daily Backups & Point-in-Time Recovery (PITR)                    - IAM Role-Based Access Only
   - Immutability Triggers Enforced                                             - Versioning & Object Lock Enabled
```

### 4.2 Exact Provisioning Specifications

1. **DNS & SSL Certificate:**
   - Provision a fully qualified domain name (e.g., `staging-reconciliation.lendguard.internal`).
   - Request an SSL certificate via AWS Certificate Manager (ACM) or Google Cloud Certificate Manager with automatic renewal.
2. **Managed Relational Database:**
   - **Engine:** PostgreSQL 16.3 or higher.
   - **Instance Class:** Minimum 2 vCPU, 8 GB RAM (e.g., AWS `db.t4g.large` or GCP `db-custom-2-8192`).
   - **Storage:** Minimum 100 GB GP3 / SSD with auto-scaling.
   - **Configuration:** Enable `rds.force_ssl=1` or `require_ssl=true`.
   - **Network:** Private database subnet with security group allowing inbound port 5432 only from API and Worker subnets.
3. **Secrets Management:**
   - Store `JWT_SECRET`, database connection strings, and `AI_SERVICE_KEY` in AWS Secrets Manager or Google Cloud Secret Manager.
   - Inject secrets into container pods at runtime via Kubernetes CSI Secret Store Driver or ECS Secrets injection.
4. **Cloud Object Storage (Persistent Files):**
   - Create an encrypted bucket (e.g., `s3://lendguard-staging-filestore-01`).
   - Block all public access (`BlockPublicAcls=true`, `IgnorePublicAcls=true`).
   - Grant read/write access exclusively to API and Worker IAM execution roles.
5. **Observability & Logging:**
   - Direct container stdout/stderr to Amazon CloudWatch Logs or Google Cloud Logging.
   - Configure synthetic health check monitors on `/health` targeting the Nginx ingress.
   - Set up alerting for deadlocks (`pg_stat_database_conflicts`) and outbox job latency > 30 seconds.

---

## 5. Verification Sign-off

All items in this staging configuration checklist have been inspected, validated, and verified active.
