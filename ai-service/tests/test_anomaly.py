import pytest
from fastapi.testclient import TestClient
from main import app, extract_features

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_feature_extraction():
    feats = extract_features(1500.0)
    assert "z_score" in feats
    assert "normalized_score" in feats
    assert 0.0 <= feats["normalized_score"] <= 1.0

def test_amount_mismatch_analysis():
    payload = {
        "transaction_reference": "TXN_TEST_01",
        "exception_type": "AmountMismatch",
        "amount": 500.0,
        "severity": "High",
        "internal_record": {
            "reference_id": "TXN_TEST_01",
            "source_system": "Internal",
            "amount": 500.0,
            "transaction_date": "2026-11-20"
        },
        "external_record": {
            "reference_id": "TXN_TEST_01",
            "source_system": "External",
            "amount": 420.0,
            "transaction_date": "2026-11-20"
        }
    }
    res = client.post("/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["anomaly_score"] > 0
    assert "records_compared" in data
    assert len(data["recommended_steps"]) > 0
    assert data["is_advisory"] is True

def test_missing_internal_analysis():
    payload = {
        "transaction_reference": "TXN_MISSING_01",
        "exception_type": "MissingInternal",
        "amount": 1200.0
    }
    res = client.post("/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "Unmatched external bank settlement" in data["detected_indicators"][0]
