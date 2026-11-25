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
    # Small INR unmatched record -> MODERATE risk
    inr_payload = {
        "analysisId": "3fa85f64-5717-4562-b3fc-2c963f66afb0",
        "exceptionId": "3fa85f64-5717-4562-b3fc-2c963f66afb1",
        "transactionEvidence": {
            "amount": "500.00",
            "currency": "INR",
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
    inr_res = client.post("/internal/v1/anomaly-detection", json=inr_payload, headers=headers)
    assert inr_res.status_code == 200
    inr_data = inr_res.json()
    assert inr_data["riskLevel"] in ("LOW", "MODERATE")
    assert inr_data["anomalyScore"] < 0.70
    assert inr_data["featureAttributions"][0]["rawMetric"] == "INR 500.00"

    # EUR 500.00 (~INR 45,000 FX exposure) -> preserves EUR metric while scoring true economic exposure
    eur_payload = {
        **inr_payload,
        "transactionEvidence": {**inr_payload["transactionEvidence"], "currency": "EUR"},
    }
    eur_res = client.post("/internal/v1/anomaly-detection", json=eur_payload, headers=headers)
    assert eur_res.status_code == 200
    eur_data = eur_res.json()
    assert eur_data["featureAttributions"][0]["rawMetric"] == "EUR 500.00"
    assert eur_data["anomalyScore"] > inr_data["anomalyScore"]


def test_calibrate_endpoint_fits_live_portfolio():
    headers = {"X-Service-Key": settings.ai_service_key}
    samples = [{"amount": 15000.0 + (i * 1000.0), "currency": "INR", "deviation": 0.0, "dateDifferenceDays": 0.0} for i in range(15)]
    res = client.post("/internal/v1/calibrate", json={"samples": samples}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "CALIBRATED"
    assert data["sampleCount"] == 15
    assert data["calibrationMode"] == "live-portfolio-fitted"
