from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class TransactionEvidence(BaseModel):
    amount: str
    currency: str
    transactionDate: str
    transactionType: Optional[str] = None

class AnomalyDetectionRequest(BaseModel):
    analysisId: str
    exceptionId: str
    transactionEvidence: TransactionEvidence
    featureContext: Optional[Dict[str, Any]] = None

class ExplanationEvidence(BaseModel):
    referenceMatch: Optional[bool] = None
    amountMatch: Optional[bool] = None
    currencyMatch: Optional[bool] = None
    internalAmount: Optional[str] = None
    externalAmount: Optional[str] = None
    currency: Optional[str] = "INR"
    dateDifferenceDays: Optional[int] = 0
    candidateCount: Optional[int] = None
    unmatchedSide: Optional[str] = None

class ExceptionExplanationRequest(BaseModel):
    analysisId: str
    exceptionType: str
    evidence: ExplanationEvidence


class CalibrationSample(BaseModel):
    amount: float
    currency: str = "INR"
    deviation: float = 0.0
    dateDifferenceDays: float = 0.0


class CalibrateModelRequest(BaseModel):
    samples: list[CalibrationSample]
