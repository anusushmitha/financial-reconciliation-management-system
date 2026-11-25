# LENDGUARD AI — AI Boundary & Fallback Verification Report

**Document Reference:** `docs/testing/AI_BOUNDARY_AND_FALLBACK_REPORT.md`  
**Execution Timestamp:** 2026-11-19T11:46:24Z  
**Verification Status:** **100% PASSED — Advisory Boundary Enforced**  
**Components Evaluated:** Python 3.11 FastAPI AI Microservice (Port 8000), ASP.NET Core `AiClientService`, `ExceptionsController`, and PostgreSQL Schema.

---

## 1. Architectural Guardrails & Executive Summary

LENDGUARD AI strictly establishes that **artificial intelligence is advisory only**. Reconciliation decisions, matching logic, and exception resolutions are strictly governed by deterministic C# business logic and human analysts.

Under no circumstances can the AI service:
1. Direct mutate or write to the PostgreSQL database.
2. Alter reconciliation matches or match statuses.
3. Automatically or independently resolve exceptions.
4. Process, inspect, or leak customer PII, account numbers, or authentication secrets.

The automated test suite ([test_ai_boundary_and_fallback.py](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/tests/ai/test_ai_boundary_and_fallback.py)) executed live boundary probes, network isolation tests, authentication enforcement, and human override validations.

---

## 2. Boundary Verification Results

### 2.1 Database Mutation Boundary
- **Architecture:** The AI microservice (`ai-service/app`) has no database client libraries, connection strings, or ORM configurations. It is entirely stateless.
- **Verification:** Probing the AI explanation endpoint with SQL injection payloads (`'; DROP TABLE transactions; --`) returned pure text analysis without database execution.
- **Status:** **VERIFIED (Read-only, Stateless)**

### 2.2 Mutual Service Key Authentication
- **Requirement:** Calls to the internal AI service must present an authorized `X-Service-Key` header.
- **Test:** Unauthenticated requests and requests with invalid keys were rejected immediately with `HTTP 401 Unauthorized`.
- **Status:** **VERIFIED**

### 2.3 Advisory-Only Flag Enforcement
- **Requirement:** Every payload returned by the AI microservice and backend DTO must contain `"advisoryOnly": true`.
- **Test:** Verified on both `/internal/v1/anomaly-detection` and `/internal/v1/exception-explanation`. Both endpoints explicitly include `"advisoryOnly": true`. The backend `AiAnalysisDto` strictly mirrors this constraint.
- **Status:** **VERIFIED**

### 2.4 Resilient Heuristic Fallbacks (Network Failure & Service Downtime)
- **Architecture:** The C# `AiClientService` wraps all HTTP calls to the AI service with a 10-second timeout and structured `try/catch` fallbacks.
- **Fallback Behavior:** If the Python AI service is unreachable, crashing, or returns an error, the backend automatically transitions to `heuristic-fallback-v1` and `evidence-explainer-v1`.
- **Impact on Core Platform:** Zero platform degradation. Batch ingestion, deterministic reconciliation runs, and exception assignments continue operating without interruption.
- **Status:** **VERIFIED**

### 2.5 Human Review Override & Decision Control
- **Requirement:** The human analyst retains final authority over all financial resolutions.
- **Test:** An analyst resolved an open discrepancy with custom reasoning (`"Human Analyst Review: Determined that counterparty withheld $500 fee under agreement schedule B."`) with `overrideAiRecommendation: true`.
- **Verification:** The human explanation was stored verbatim in `exceptions.resolution_explanation` and logged to `audit_logs` with the analyst's `user_id`. The advisory recommendation was archived as supplementary context only.
- **Status:** **VERIFIED**

### 2.6 PII and Credential Sanitization
- **Inspection:** Inspected `ExplanationEvidence` schema:
  - Allowed fields: `referenceMatch`, `amountMatch`, `currencyMatch`, `internalAmount`, `externalAmount`, `currency`, `dateDifferenceDays`, `candidateCount`, `unmatchedSide`.
  - Sensitive terms scanned: `password`, `ssn`, `tax_id`, `pan`, `account_number`, `routing_number`, `token`, `secret`.
- **Result:** Zero customer PII or credentials are sent to the AI microservice or external LLM providers.
- **Status:** **VERIFIED**
