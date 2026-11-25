import os
import re
import time
import json
import logging
import urllib.request
import urllib.error
from typing import List, Tuple, Optional
from app.schemas.requests import ExplanationEvidence
from app.config import settings

logger = logging.getLogger("lendguard.llm_explainer")

# Active high-performance NVIDIA Nemotron models prioritized first (verified 1.6s-2.2s response times)
CANDIDATE_MODELS_FAST = [
    "nvidia/nemotron-3.5-bolt-e4b",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "minimaxai/minimax-m3.1-flash",
]

CANDIDATE_MODELS_REASONING = [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "nvidia/nemotron-3.5-bolt-e4b",
    "minimaxai/minimax-m3.1-flash",
]

class LLMExplainerService:
    def _get_model_cascade(self, exception_type: str) -> List[str]:
        """Dynamically orders models based on exception complexity and user preferences."""
        # Ambiguous matches and multi-part partial splits benefit from deep reasoning MoE models
        if exception_type in ("AMBIGUOUS_MATCH", "PARTIAL_SETTLEMENT", "DUPLICATE"):
            base_pool = list(CANDIDATE_MODELS_REASONING)
        else:
            base_pool = list(CANDIDATE_MODELS_FAST)

        # Prioritize user's explicitly configured model if set and not "auto"
        user_model = (settings.ai_model or "").strip()
        if user_model and user_model.lower() not in ("auto", "adaptive"):
            if user_model in base_pool:
                base_pool.remove(user_model)
            base_pool.insert(0, user_model)

        return base_pool

    def _call_single_model(self, model: str, exception_type: str, evidence: ExplanationEvidence, timeout: float = 6.0) -> Optional[Tuple[str, str, int]]:
        url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.ai_api_key}",
            "Content-Type": "application/json"
        }

        evidence_dict = {k: v for k, v in evidence.model_dump().items() if v is not None}
        system_prompt = (
            "You are an expert Financial Reconciliation and Audit AI for LendGuard. "
            "Analyze the provided discrepancy evidence and produce a concise, strictly factual audit explanation. "
            "Output ONLY a raw valid JSON object with exactly two keys: 'summary' and 'recommendation'. "
            "- 'summary': 1-2 factual sentences explaining the exact variance, numbers, and currency.\n"
            "- 'recommendation': 1 actionable next step for the finance operations team.\n"
            "Rules: Zero PII, no speculation, strict financial audit terminology. Do not output markdown code blocks."
        )
        user_prompt = f"Exception Type: {exception_type}\nEvidence: {json.dumps(evidence_dict)}"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 1024
        }

        t0 = time.time()
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                elapsed_ms = int((time.time() - t0) * 1000)
                res_data = json.loads(resp.read().decode("utf-8"))
                choices = res_data.get("choices", [])
                if not choices:
                    return None
                msg = choices[0].get("message", {})
                content = msg.get("content") or msg.get("reasoning_content") or ""

                # Extract JSON from response
                cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE).strip()
                match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
                if match:
                    cleaned = match.group(0)

                data = json.loads(cleaned)
                summary = data.get("summary")
                recommendation = data.get("recommendation")
                if summary and recommendation and isinstance(summary, str) and isinstance(recommendation, str):
                    logger.info("NVIDIA NIM model '%s' succeeded in %d ms", model, elapsed_ms)
                    return summary.strip(), recommendation.strip(), elapsed_ms
        except Exception as ex:
            elapsed_ms = int((time.time() - t0) * 1000)
            logger.warning("NVIDIA NIM model '%s' failed after %d ms: %s", model, elapsed_ms, ex)

        return None

    def _call_nvidia_nim_router(self, exception_type: str, evidence: ExplanationEvidence) -> Optional[Tuple[str, str, str, int]]:
        """Adaptive Multi-Model Router with cascading failover across active free NIM models."""
        if not settings.ai_api_key:
            return None

        cascade = self._get_model_cascade(exception_type)
        logger.info("Routing exception '%s' through model cascade: %s", exception_type, cascade)

        for model in cascade:
            res = self._call_single_model(model, exception_type, evidence, timeout=min(settings.ai_timeout_seconds, 5.5))
            if res:
                summary, recommendation, elapsed_ms = res
                return summary, recommendation, model, elapsed_ms

        logger.warning("All NVIDIA NIM models in the cascade failed or timed out.")
        return None

    def _explain_deterministic(self, exception_type: str, evidence: ExplanationEvidence) -> Tuple[str, str]:
        curr = evidence.currency or "INR"

        if exception_type == "AMOUNT_MISMATCH":
            int_amt = evidence.internalAmount or "0.00"
            ext_amt = evidence.externalAmount or "0.00"
            try:
                diff = abs(float(int_amt) - float(ext_amt))
                diff_str = f"{diff:.2f}"
            except ValueError:
                diff_str = "unspecified"
            summary = f"The transaction amounts differ by {curr} {diff_str}. Internal expected amount is {curr} {int_amt}, while external settlement amount is {curr} {ext_amt}."
            recommendation = "Review settlement advice and bank chargeback/fee deductions to reconcile the variance."

        elif exception_type == "MISSING_SETTLEMENT":
            int_amt = evidence.internalAmount or "0.00"
            summary = f"Internal transaction for {curr} {int_amt} has no counterparty settlement record in the external bank file."
            recommendation = "Verify settlement cutoff timing or request unreceived settlement log from the payment gateway."

        elif exception_type == "UNMATCHED_EXTERNAL":
            ext_amt = evidence.externalAmount or "0.00"
            summary = f"External settlement of {curr} {ext_amt} was received from payment counterparty without a corresponding internal loan ledger transaction."
            recommendation = "Inspect internal loan origination/repayment staging queues for missing ingestion or unallocated customer deposits."

        elif exception_type == "DUPLICATE":
            summary = "Duplicate transaction detected with identical reference identifier or candidate key within the batch."
            recommendation = "Verify if counterparty processed an accidental double charge/settlement or if the source file was ingested twice."

        elif exception_type == "PARTIAL_SETTLEMENT":
            int_amt = evidence.internalAmount or "0.00"
            ext_amt = evidence.externalAmount or "0.00"
            summary = f"Received external settlement amount ({curr} {ext_amt}) is less than the expected internal total ({curr} {int_amt})."
            recommendation = "Confirm whether borrower paid in multiple tranches or if counterparty withheld gateway processing fees."

        elif exception_type == "AMBIGUOUS_MATCH":
            summary = "Multiple plausible external settlements match the same reference criteria, preventing automated one-to-one resolution."
            recommendation = "Conduct human review to determine the exact borrower counterparty before approving allocation."

        else:
            summary = f"Reconciliation discrepancy flagged for review under rule condition: {exception_type}."
            recommendation = "Inspect raw transaction payloads and counterparty settlement advice."

        return summary, recommendation

    def explain(self, exception_type: str, evidence: ExplanationEvidence) -> Tuple[str, List[str], str, str, int]:
        evidence_refs: List[str] = []
        if evidence.internalAmount is not None:
            evidence_refs.append("internalAmount")
        if evidence.externalAmount is not None:
            evidence_refs.append("externalAmount")
        if evidence.currency is not None:
            evidence_refs.append("currency")
        if evidence.referenceMatch is not None:
            evidence_refs.append("referenceMatch")
        if evidence.candidateCount is not None:
            evidence_refs.append("candidateCount")
        if not evidence_refs:
            evidence_refs = ["referenceMatch"]

        # 1. Attempt adaptive NVIDIA NIM inference if enabled
        if settings.ai_provider.lower() == "nvidia" and settings.ai_api_key:
            nim_result = self._call_nvidia_nim_router(exception_type, evidence)
            if nim_result:
                summary, recommendation, model_used, elapsed_ms = nim_result
                return summary, evidence_refs, recommendation, model_used, elapsed_ms

        # 2. Honest AI-Offline fallback: never disguise canned text as AI explanation
        summary, recommendation = self._explain_deterministic(exception_type, evidence)
        offline_summary = f"AI explanation service is currently offline and will be back shortly. Standard rule reference while AI is offline: {summary}"
        return offline_summary, evidence_refs, recommendation, "ai-offline-standard-fallback", 0

llm_explainer_service = LLMExplainerService()
