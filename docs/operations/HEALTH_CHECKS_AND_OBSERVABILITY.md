# LENDGUARD AI — Health Checks, Monitoring & Observability Guide

**Document Reference:** `docs/operations/HEALTH_CHECKS_AND_OBSERVABILITY.md`  
**Classification:** DevOps / SRE Operations  

---

## 1. Health Probe Specifications

All LENDGUARD AI components expose standardized HTTP health probes for load balancers and container orchestrators.

| Component | Endpoint | Expected Status | Response Format | Check Type |
| :--- | :--- | :---: | :--- | :--- |
| **ASP.NET Core Web API** | `GET /health` | `200 OK` | `{"status":"Healthy"}` | Liveness & Readiness |
| **Python AI Microservice** | `GET /internal/v1/health` | `200 OK` | `{"status":"Healthy","service":"lendguard-ai-service","version":"1.0.0"}` | Liveness & Readiness |
| **PostgreSQL Database** | Direct TCP / `SELECT 1;` | `0 Exit Code` | `1` | Readiness |
| **C# Background Worker** | Process Heartbeat / OS PID | Alive | Log output polling | Liveness |

---

## 2. Structured Logging & Distributed Correlation IDs

### 2.1 Correlation Tracking
Every inbound HTTP request to the Web API is assigned a unique `X-Correlation-ID` header (or generated via `Guid.NewGuid():D` if absent). 
- The correlation ID is attached to the ASP.NET Core logging scope.
- When an action triggers an audit log, the correlation ID is persisted in `audit_logs.correlation_id`.
- If an error occurs, the API error response returns the correlation ID:
  ```json
  {
    "Success": false,
    "Error": {
      "Code": "INTERNAL_ERROR",
      "Message": "An unexpected error occurred.",
      "CorrelationId": "49c28c92-0736-4066-ac7e-7c79ce5c1f68"
    }
  }
  ```

---

## 3. Recommended Prometheus Metrics & Telemetry

| Metric Name | Type | Description | Target / SLA |
| :--- | :--- | :--- | :--- |
| `lendguard_recon_runs_total` | Counter | Total reconciliation runs partitioned by status (`COMPLETED`, `FAILED`). | 99.9% Success |
| `lendguard_recon_duration_seconds` | Histogram | Time taken to execute deterministic reconciliation per batch. | $P_{95} < 5.0$ seconds |
| `lendguard_outbox_queue_depth` | Gauge | Count of pending background jobs (`status = 'PENDING'`). | $< 50$ queued |
| `lendguard_stuck_jobs_recovered_total` | Counter | Total stuck background jobs recovered and re-queued. | Alert if $> 5$ in 1 hour |
| `lendguard_exceptions_open_total` | Gauge | Count of unresolved exceptions in the system. | Monitor SLA |
| `lendguard_http_requests_duration_seconds`| Histogram | API response latency across all endpoints. | $P_{99} < 200$ ms |

---

## 4. Alerting Thresholds & PagerDuty Rules

1. **Stuck Outbox Jobs Alert (P1):** Triggered if any background job remains in `PROCESSING` status for $> 10$ minutes without completion.
2. **Reconciliation Failure Alert (P2):** Triggered if any reconciliation run transitions to `FAILED` status.
3. **Database Connection Pool Saturation (P1):** Triggered if active Npgsql connections reach $> 85\%$ of maximum pool size (42/50).
4. **AI Service Fallback Degradation (P3):** Triggered if backend logs more than 20 fallback heuristic events in 5 minutes (indicates AI service downtime or network partition).
