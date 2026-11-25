import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_health():
    response = client.get("/internal/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Healthy"
    assert data["service"] == "lendguard-ai-service"

def test_anomaly_detection():
    headers = {"X-Service-Key": settings.ai_service_key}
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "exceptionId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
        "transactionEvidence": {
            "amount": "9500.00",
            "currency": "INR",
            "transactionDate": "2026-11-17T00:00:00Z",
            "transactionType": "REPAYMENT"
        },
        "featureContext": {"amountDeviation": 500.00}
    }
    response = client.post("/internal/v1/anomaly-detection", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert "anomalyScore" in data
    assert 0.0 <= data["anomalyScore"] <= 1.0
    assert data["advisoryOnly"] is True

def test_exception_explanation():
    headers = {"X-Service-Key": settings.ai_service_key}
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "exceptionType": "AMOUNT_MISMATCH",
        "evidence": {
            "referenceMatch": True,
            "internalAmount": "10000.00",
            "externalAmount": "9500.00",
            "currency": "INR",
            "dateDifferenceDays": 0
        }
    }
    response = client.post("/internal/v1/exception-explanation", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert "500.00" in data["summary"] and "INR" in data["summary"]
    assert "internalAmount" in data["evidenceReferences"]
    assert data["advisoryOnly"] is True

def test_unauthorized_without_key():
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "exceptionType": "AMOUNT_MISMATCH",
        "evidence": {}
    }
    response = client.post("/internal/v1/exception-explanation", json=payload, headers={"X-Service-Key": "wrong-key"})
    assert response.status_code == 401

def test_anomaly_feature_attributions_and_ensemble_metadata():
    headers = {"X-Service-Key": settings.ai_service_key}
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
        "exceptionId": "3fa85f64-5717-4562-b3fc-2c963f66afa9",
        "transactionEvidence": {
            "amount": "250000.00",
            "currency": "INR",
            "transactionDate": "2026-11-20T10:00:00Z",
            "transactionType": "REPAYMENT"
        },
        "featureContext": {
            "amountDeviation": 50000.00,
            "expectedAmount": 250000.00,
            "actualAmount": 200000.00,
            "dateDifferenceDays": 4
        }
    }
    response = client.post("/internal/v1/anomaly-detection", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["riskLevel"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert "featureAttributions" in data and len(data["featureAttributions"]) > 0
    assert "ensembleWeights" in data and len(data["ensembleWeights"]) > 0
    assert "signals" in data and isinstance(data["signals"], list)
    assert data["advisoryOnly"] is True


def test_small_multicurrency_unmatched_calibrated_properly():
    headers = {"X-Service-Key": settings.ai_service_key}
    payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afb0",
        "exceptionId": "3fa85f64-5717-4562-b3fc-2c963f66afb1",
        "transactionEvidence": {
            "amount": "500.00",
            "currency": "EUR",
            "transactionDate": "2026-11-25T10:00:00Z",
            "transactionType": "SETTLEMENT"
        },
        "featureContext": {
            "amountDeviation": 500.00,
            "expectedAmount": 0.00,
            "actualAmount": 500.00,
            "dateDifferenceDays": 0,
            "exceptionType": "UNMATCHED_EXTERNAL",
            "unmatchedSide": "INTERNAL"
        }
    }
    response = client.post("/internal/v1/anomaly-detection", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["riskLevel"] in ("LOW", "MODERATE")
    assert data["anomalyScore"] < 0.70
    assert data["featureAttributions"][0]["rawMetric"] == "EUR 500.00"
