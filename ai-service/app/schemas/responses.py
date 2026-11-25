from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str = "Healthy"
    service: str
    version: str

class FeatureAttribution(BaseModel):
    feature: str
    contributionPct: int
    rawMetric: str
    impactDirection: str = "INCREASES_ANOMALY"

class AnomalyDetectionResponse(BaseModel):
    status: str = "COMPLETED"
    anomalyScore: float
    riskLevel: str = "MODERATE"
    algorithm: str = "Tri-Model Outlier Ensemble (iForest + Robust Covariance)"
    modelVersion: str = "scikit-learn/isolation-forest-v2.0-enterprise"
    signals: List[str]
    featureAttributions: Optional[List[Dict[str, Any]]] = None
    ensembleWeights: Optional[Dict[str, float]] = None
    advisoryOnly: bool = True

class ExceptionExplanationResponse(BaseModel):
    status: str = "COMPLETED"
    summary: str
    evidenceReferences: List[str]
    recommendedReview: str
    advisoryOnly: bool = True
    modelVersion: str = "nvidia/nemotron-3.5-bolt-e4b"
    executionTimeMs: Optional[int] = None
    provider: str = "nvidia"
