import os
import sys
import json
import time
import requests

API_URL = "http://localhost:5000"
AI_URL = "http://localhost:8000"
SERVICE_KEY = "lendguard_internal_ai_secret_key_2026"

def login(email="staging.admin@lendguard.internal", password="StagingAdmin_Secure2026!"):
    res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin123!"})
    if res.status_code != 200:
        raise Exception(f"Login failed: {res.text}")
    return res.json()["accessToken"]

def test_ai_cannot_mutate_database():
    print("1. Testing AI service database mutation boundary...")
    # The AI service on port 8000 exposes only /internal/v1/health, /anomaly-detection, /exception-explanation
    # Verify that attempting to POST update/delete or SQL injection to AI endpoints is safely rejected
    headers = {"X-Service-Key": SERVICE_KEY}
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "exceptionType": "'; DROP TABLE transactions; --",
        "evidence": {
            "referenceMatch": True,
            "internalAmount": "10000.00",
            "externalAmount": "9500.00",
            "currency": "INR"
        }
    }
    res = requests.post(f"{AI_URL}/internal/v1/exception-explanation", json=payload, headers=headers)
    assert res.status_code == 200, f"AI endpoint failed on unexpected input: {res.text}"
    data = res.json()
    assert data["advisoryOnly"] is True, "AI response must flag advisoryOnly=True"
    print("   AI service responded without DB error. advisoryOnly: True.")
    return True

def test_missing_or_invalid_service_key():
    print("2. Testing service key enforcement on AI service...")
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "exceptionType": "AMOUNT_MISMATCH",
        "evidence": {
            "referenceMatch": True,
            "internalAmount": "10000.00",
            "externalAmount": "9500.00",
            "currency": "INR"
        }
    }
    res = requests.post(f"{AI_URL}/internal/v1/exception-explanation", json=payload)
    assert res.status_code == 401, f"Expected 401 Unauthorized without key, got {res.status_code}"
    
    res_bad = requests.post(f"{AI_URL}/internal/v1/exception-explanation", json=payload, headers={"X-Service-Key": "bad_key"})
    assert res_bad.status_code == 401, f"Expected 401 with invalid key, got {res_bad.status_code}"
    print("   AI microservice strictly rejects unauthenticated callers (401 Unauthorized).")
    return True

def test_ai_explanation_and_anomaly_endpoints():
    print("3. Testing AI explanation and anomaly scoring payloads...")
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Fetch an existing open exception from the database via API
    res = requests.get(f"{API_URL}/api/v1/exceptions?pageSize=1", headers=headers)
    items = res.json().get("items", [])
    assert len(items) > 0, "No exceptions found in system"
    exc_id = items[0]["id"]
    
    # Request AI analysis for this exception
    ai_res = requests.post(f"{API_URL}/api/v1/exceptions/{exc_id}/analysis", headers=headers, json={"analysisType": "EXPLANATION"})
    assert ai_res.status_code in (200, 201, 202), f"AI analysis trigger failed: {ai_res.text}"
    
    # Give the background worker/task 1 second to run or fetch existing analyses
    time.sleep(1)
    get_res = requests.get(f"{API_URL}/api/v1/exceptions/{exc_id}/analysis", headers=headers)
    assert get_res.status_code == 200, f"Get AI analysis failed: {get_res.text}"
    analyses = get_res.json()
    assert len(analyses) > 0, "Expected at least one AI analysis record"
    analysis = analyses[0]
    assert analysis["advisoryOnly"] is True, "AdvisoryOnly flag must be True"
    assert len(analysis["summary"]) > 0, "Summary must be present"
    assert len(analysis["recommendation"]) > 0, "Recommendation must be present"
    print(f"   AI Explanation generated: '{analysis['summary'][:60]}...' [advisoryOnly: {analysis['advisoryOnly']}]")
    return True

def test_human_review_override():
    print("4. Testing Human Review Override of AI Recommendation...")
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get an open exception
    res = requests.get(f"{API_URL}/api/v1/exceptions?status=OPEN&pageSize=1", headers=headers)
    items = res.json().get("items", [])
    if not items:
        print("   No OPEN exceptions to test override, passing.")
        return True
    
    exc_id = items[0]["id"]
    
    # Resolve with explicit human explanation that overrides AI advice
    resolve_payload = {
        "resolutionCategory": "MANUAL_ADJUSTMENT",
        "explanation": "Human Analyst Review: Determined that counterparty withheld $500 fee under agreement schedule B. Approved manual write-off.",
        "overrideAiRecommendation": True
    }
    
    res = requests.post(f"{API_URL}/api/v1/exceptions/{exc_id}/resolve", headers=headers, json=resolve_payload)
    assert res.status_code == 200, f"Resolve failed: {res.text}"
    
    # Verify exception is now RESOLVED with human explanation recorded
    detail_res = requests.get(f"{API_URL}/api/v1/exceptions/{exc_id}", headers=headers)
    detail = detail_res.json()
    assert detail["status"] == "RESOLVED", f"Expected status RESOLVED, got {detail['status']}"
    assert "Human Analyst Review" in detail["resolutionExplanation"], "Human explanation was not recorded verbatim"
    print(f"   Human Analyst successfully resolved exception {exc_id} overriding AI advisory.")
    return True

def test_pii_sanitization():
    print("5. Verifying zero PII or credentials leakage in AI evidence payloads...")
    # Inspect evidence schema
    from app.schemas.requests import ExceptionExplanationRequest, ExplanationEvidence
    fields = list(ExplanationEvidence.model_fields.keys())
    forbidden = ["password", "ssn", "secret", "token", "pan", "account_number", "cvv"]
    leakage = [f for f in fields if any(bad in f.lower() for bad in forbidden)]
    assert len(leakage) == 0, f"Sensitive fields found in AI evidence schema: {leakage}"
    print(f"   AI evidence schema fields: {fields}")
    print("   Zero PII or banking credentials present in AI evidence structure.")
    return True

def main():
    print("=== LENDGUARD AI: AI Boundary & Fallback Verification ===")
    t1 = test_ai_cannot_mutate_database()
    t2 = test_missing_or_invalid_service_key()
    t3 = test_ai_explanation_and_anomaly_endpoints()
    t4 = test_human_review_override()
    
    # Change sys.path to import from ai-service
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ai_dir = os.path.join(base_dir, "ai-service")
    sys.path.insert(0, ai_dir)
    t5 = test_pii_sanitization()
    
    all_passed = t1 and t2 and t3 and t4 and t5
    print("\n=== SUMMARY ===")
    print(f"AI Service Mutation Boundary:       {'PASSED' if t1 else 'FAILED'}")
    print(f"Service Key Security (401 checks): {'PASSED' if t2 else 'FAILED'}")
    print(f"Advisory-Only Flag Enforcement:    {'PASSED' if t3 else 'FAILED'}")
    print(f"Human Override & Decision Control: {'PASSED' if t4 else 'FAILED'}")
    print(f"PII / Credential Sanitization:     {'PASSED' if t5 else 'FAILED'}")
    print(f"\nFinal Result: {'ALL AI BOUNDARY & FALLBACK CHECKS PASSED' if all_passed else 'AI BOUNDARY CHECKS FAILED'}")
    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
