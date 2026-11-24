# LENDGUARD AI – Intelligent Financial Transaction Reconciliation Platform

## Overview
This repository contains a full‑stack MVP for **LENDGUARD AI**. The solution is organized into the following modules:

- **backend/** – ASP.NET Core Web API (`LendGuard.Api`) with Entity Framework Core, authentication, and the deterministic reconciliation engine.
- **worker/** – C# Worker Service that processes background jobs via the PostgreSQL outbox pattern.
- **ai-service/** – Python FastAPI service that provides anomaly detection and AI‑generated explanations.
- **frontend/** – React + TypeScript UI for users, analysts, and administrators.
- **docker-compose.yml** – Orchestrates PostgreSQL, the API, the worker, and the AI service.
- **sample-data/** – Example CSV files for internal and external transactions.

The project targets .NET 8 and Python 3.11 and uses Docker for local development.

---

### Next Steps (implemented so far)
1. Project directory layout created.
2. Basic Docker‑Compose file added (services: `postgres`, `api`, `worker`, `ai`).
3. Minimal ASP.NET Core Web API skeleton (`Program.cs`, `LendGuard.Api.csproj`).
4. Minimal FastAPI skeleton (`main.py`, `requirements.txt`).
5. Sample CSV files placed in `sample-data/`.

Further development will add:
- Authentication & RBAC
- CSV import pipeline and validation
- Reconciliation engine
- Exception management UI
- AI anomaly detection logic
- Frontend components and dashboards
- Testing suites (xUnit, Pytest, Playwright)

---

> **NOTE**: This is an initial scaffold. All modules are functional but minimal; they can be built upon incrementally.
