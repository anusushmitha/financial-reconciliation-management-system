from fastapi import APIRouter, Header, HTTPException, status
from app.config import settings
from app.schemas.requests import AnomalyDetectionRequest, ExceptionExplanationRequest
from app.schemas.responses import (
    HealthResponse,
    AnomalyDetectionResponse,
    ExceptionExplanationResponse,
)
from app.services.anomaly_detector import anomaly_detector_service
from app.services.llm_explainer import llm_explainer_service

router = APIRouter(prefix="/internal/v1")

def verify_service_key(x_service_key: str | None = Header(None, alias="X-Service-Key")):
    if settings.ai_service_key and x_service_key != settings.ai_service_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service authentication key."
        )

@router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="Healthy",
        service=settings.service_name,
        version=settings.service_version,
    )

@router.post("/anomaly-detection", response_model=AnomalyDetectionResponse)
def detect_anomaly(
    request: AnomalyDetectionRequest,
    x_service_key: str | None = Header(None, alias="X-Service-Key")
):
    verify_service_key(x_service_key)
    score, risk_level, signals, algo, model_ver, attributions, weights = anomaly_detector_service.analyze(
        request.transactionEvidence, request.featureContext
    )
    return AnomalyDetectionResponse(
        status="COMPLETED",
        anomalyScore=score,
        riskLevel=risk_level,
        algorithm=algo,
        modelVersion=model_ver,
        signals=signals,
        featureAttributions=attributions,
        ensembleWeights=weights,
        advisoryOnly=True
    )

@router.post("/exception-explanation", response_model=ExceptionExplanationResponse)
def explain_exception(
    request: ExceptionExplanationRequest,
    x_service_key: str | None = Header(None, alias="X-Service-Key")
):
    verify_service_key(x_service_key)
    summary, refs, rec, model_used, elapsed_ms = llm_explainer_service.explain(
        request.exceptionType, request.evidence
    )
    provider = "nvidia" if ("nvidia" in model_used or "minimax" in model_used) else "internal"
    return ExceptionExplanationResponse(
        status="COMPLETED",
        summary=summary,
        evidenceReferences=refs,
        recommendedReview=rec,
        advisoryOnly=True,
        modelVersion=model_used,
        executionTimeMs=elapsed_ms,
        provider=provider
    )
