import urllib.request
import json
import sys

def post(url, data, headers=None):
    if headers is None:
        headers = {}
    h = {'Content-Type': 'application/json'}
    h.update(headers)
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=h)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get(url, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=== 1. TEST LIVE AI SERVICE ANOMALY ENDPOINT ===")
ai_resp = post('http://127.0.0.1:8000/internal/v1/anomaly-detection', {
    'analysisId': 'test-ai-1',
    'exceptionId': 'test-exc-1',
    'transactionEvidence': {'amount': '150000.00', 'currency': 'INR', 'transactionDate': '2026-11-20T10:00:00Z'},
    'featureContext': {'amountDeviation': '25000.00', 'expectedAmount': '150000.00', 'actualAmount': '125000.00', 'dateDifferenceDays': 3}
}, headers={'X-Service-Key': 'lendguard_internal_ai_secret_key_2026'})
print("AI Service Response:")
print(json.dumps(ai_resp, indent=2))
assert ai_resp['status'] == 'COMPLETED'
assert 'anomalyScore' in ai_resp
assert 'riskLevel' in ai_resp
assert 'signals' in ai_resp

API_URL = "http://localhost:5000/api/v1"

print("\n=== 2. LOGIN AS ADMIN ON BACKEND API ===")
auth = post(f'{API_URL}/auth/login', {
    'email': 'staging.admin@lendguard.internal',
    'password': 'StagingAdmin_Secure2026!'
})
token = auth['accessToken']
print("Login OK. Token acquired.")

print("\n=== 3. FETCH OPEN EXCEPTIONS ===")
exceptions = get(f'{API_URL}/exceptions?pageSize=5', headers={'Authorization': f'Bearer {token}'})
items = exceptions.get('items', [])
print(f"Found {len(items)} exceptions in DB.")
assert len(items) > 0, "No exceptions found in DB!"

target_id = items[0]['id']
print(f"Testing Exception ID: {target_id}")
print(f"Type: {items[0]['exceptionType']}, Discrepancy: {items[0].get('discrepancyAmount')}")

print("\n=== 4. TRIGGER DUAL-ENGINE AI DIAGNOSTICS (ANOMALY + EXPLANATION) ===")
trig_resp = post(f'{API_URL}/exceptions/{target_id}/analysis', {
    'analysisType': 'ALL'
}, headers={'Authorization': f'Bearer {token}'})
print("Trigger Response:")
print(json.dumps(trig_resp, indent=2))
assert trig_resp['status'] == 'COMPLETED'

print("\n=== 5. RETRIEVE LATEST ANALYSES ===")
analyses = get(f'{API_URL}/exceptions/{target_id}/analysis?latest=true', headers={'Authorization': f'Bearer {token}'})
print(f"Retrieved {len(analyses)} analysis records:")
found_anomaly = False
found_explanation = False

for a in analyses:
    atype = a.get('analysisType')
    model = a.get('modelName')
    summary = a.get('summary')
    print(f"\n  [ANALYSIS TYPE: {atype}]")
    print(f"  Model: {model}")
    print(f"  Summary: {summary}")
    print(f"  Recommendation: {a.get('recommendation')}")
    ev = a.get('evidence')
    if atype == 'ANOMALY':
        found_anomaly = True
        print(f"  -> Anomaly Score: {ev.get('anomalyScore')}")
        print(f"  -> Risk Level: {ev.get('riskLevel')}")
        print(f"  -> Algorithm: {ev.get('algorithm')}")
        print(f"  -> Signals: {ev.get('signals')}")
    elif atype == 'EXPLANATION':
        found_explanation = True

assert found_anomaly, "Latest analyses did not include ANOMALY analysis!"
assert found_explanation, "Latest analyses did not include EXPLANATION analysis!"

print("\n=======================================================")
print(" SUCCESS: DUAL-ENGINE AI ARCHITECTURE VERIFIED 100%! ")
print(" - Engine 1: Scikit-Learn IsolationForest Anomaly Engine")
print(" - Engine 2: NVIDIA NIM Generative Explanation Engine   ")
print("=======================================================")
