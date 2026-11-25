# LENDGUARD AI — Environment Configuration & Secrets Guide

**Document Reference:** `docs/deployment/ENVIRONMENT_CONFIGURATION_GUIDE.md`  
**Classification:** DevOps / Systems Administration  

---

## 1. Master Configuration Parameter Catalog

LENDGUARD AI services are completely configured via environment variables.

### 1.1 ASP.NET Core Web API & Background Worker

| Variable Name | Required? | Default / Example Value | Description |
| :--- | :---: | :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | Yes | `Production` | Runtime environment (`Development`, `Staging`, `Production`). |
| `ConnectionStrings__DefaultConnection` | Yes | `Host=postgres;Port=5432;Database=lendguard;Username=app;Password=...` | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | `[64+ char random hex string]` | HMAC-SHA256 signing secret for user authentication tokens. |
| `JWT_EXPIRY_MINUTES` | No | `480` | Access token lifespan in minutes (default: 8 hours). |
| `AI_SERVICE_BASE_URL` | Yes | `http://ai-service:8000` | Internal URL of the Python AI microservice. |
| `AI_SERVICE_KEY` | Yes | `[32+ char random hex string]` | Shared secret key for mutual inter-service API authorization. |
| `FILE_STORAGE_PATH` | No | `/app/storage` | Persistent storage directory for uploaded CSVs and report exports. |
| `MAX_UPLOAD_SIZE_BYTES` | No | `26214400` | Maximum upload size threshold (default: 25MB). |

### 1.2 Python FastAPI AI Microservice

| Variable Name | Required? | Default / Example Value | Description |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` | Microservice environment mode. |
| `AI_SERVICE_KEY` | Yes | `[Must match backend key]` | Service authorization key enforced on incoming requests. |
| `OPENAI_API_KEY` | No | `sk-...` | Hosted LLM API key for advisory explanations (falls back to deterministic explanations if omitted). |
| `LLM_MODEL_NAME` | No | `gpt-4o-mini` | Model identifier for LLM explanation generation. |
| `ANOMALY_THRESHOLD` | No | `0.70` | Cutoff score above which deviations trigger high-severity advisory alerts. |

### 1.3 React Frontend (Vite)

| Variable Name | Required? | Default / Example Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | `/api/v1` | Base API route prefix passed to Axios/Fetch client. |
| `VITE_APP_TITLE` | No | `LENDGUARD AI` | Application title presented in browser header. |

---

## 2. Environment Profiles Comparison

| Configuration Key | Development | Staging | Production |
| :--- | :--- | :--- | :--- |
| **Database Host** | `localhost:5433` | `staging-pg.internal:5432` | `prod-cluster.internal:5432` |
| **Database SSL Mode** | `Prefer` | `Require` | `Verify-Full` |
| **JWT Expiry** | 480 min | 120 min | 60 min |
| **AI Fallback Mode** | Heuristic Local | Mock / Staging LLM Key | Production Hosted LLM |
| **CORS Origins** | `*` | `https://staging.lendguard.internal` | `https://app.lendguard.internal` |
| **HSTS Enforced** | False | True | True (`max-age=31536000`) |
