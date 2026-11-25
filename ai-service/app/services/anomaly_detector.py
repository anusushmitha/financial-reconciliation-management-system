import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import roc_auc_score
from typing import Dict, Any, List, Tuple, Optional
from app.schemas.requests import TransactionEvidence
from app.data.lending_corpus import FX_TO_INR, build_lending_training_corpus


class AnomalyDetectorService:
    def __init__(self):
        self.model_version = "scikit-learn/tri-ensemble-v3.0-enterprise"
        self.algorithm = "Scaled Tri-Model Outlier Ensemble (iForest + LOF + Robust Mahalanobis)"
        self.calibration_mode = "multi-regime-lending-corpus"
        self.calibrated_sample_count = 0
        self.validation_roc_auc = 0.0
        self.feedback_clf: Optional[LogisticRegression] = None
        self._init_baseline_model()

    def _build_feature_row(self, amt_inr: float, dev_inr: float, rel: float, drift: float, is_single: float, is_cross: float) -> np.ndarray:
        z_dev = float(np.clip((dev_inr - self.dev_median) / max(self.dev_iqr, 1.0), 0.0, 20.0))
        return np.array([
            np.log1p(max(amt_inr, 0.0)),
            np.log1p(max(dev_inr, 0.0)),
            rel,
            drift,
            is_single,
            is_cross,
            z_dev,
        ], dtype=float)

    def _fit_matrix(self, X: np.ndarray, mode: str, sample_count: int):
        self.X_train = X
        self.scaler = RobustScaler()
        self.X_scaled = self.scaler.fit_transform(self.X_train)

        self.mean_centroid = np.mean(self.X_scaled, axis=0)
        cov = np.cov(self.X_scaled, rowvar=False)
        cov_reg = cov + np.eye(cov.shape[0]) * 1e-3
        self.inv_cov = np.linalg.pinv(cov_reg)

        self.clf = IsolationForest(
            n_estimators=160,
            contamination=0.05,
            max_samples="auto",
            random_state=42,
        )
        self.clf.fit(self.X_scaled)

        self.lof = LocalOutlierFactor(
            n_neighbors=min(25, max(5, len(self.X_scaled) // 4)),
            contamination=0.05,
            novelty=True,
        )
        self.lof.fit(self.X_scaled)

        self.calibration_mode = mode
        self.calibrated_sample_count = sample_count

    def _raw_ensemble_score(self, sample_2d: np.ndarray) -> Tuple[float, float, float]:
        scaled = self.scaler.transform(sample_2d)
        raw_iforest = float(self.clf.decision_function(scaled)[0])
        iforest_norm = float(np.clip(0.50 - (raw_iforest * 1.15), 0.05, 0.98))

        raw_lof = float(self.lof.decision_function(scaled)[0])
        lof_norm = float(np.clip(0.50 - (raw_lof * 0.35), 0.05, 0.98))

        diff = scaled - self.mean_centroid
        mahal_sq = float(np.dot(np.dot(diff, self.inv_cov), diff.T).item())
        mahal_dist = float(np.sqrt(max(mahal_sq, 0.0)))
        mahal_norm = float(np.clip(mahal_dist / 6.5, 0.05, 0.98))

        ensemble = (0.45 * iforest_norm) + (0.30 * lof_norm) + (0.25 * mahal_norm)
        return ensemble, iforest_norm, mahal_norm

    def _init_baseline_model(self):
        self.feedback_clf = None
        X_normal, X_val, y_val, dev_med, dev_iqr = build_lending_training_corpus(seed=42)
        self.dev_median = dev_med
        self.dev_iqr = dev_iqr
        self._fit_matrix(X_normal, "multi-regime-lending-corpus", len(X_normal))

        val_scores = [self._raw_ensemble_score(row.reshape(1, -1))[0] for row in X_val]
        self.validation_roc_auc = round(float(roc_auc_score(y_val, val_scores)), 4)

    def calibrate(self, samples: List[Dict[str, Any]]) -> Tuple[int, str, str]:
        X_corpus, X_val, y_val, dev_med, dev_iqr = build_lending_training_corpus(seed=42)
        self.dev_median = dev_med
        self.dev_iqr = dev_iqr

        normal_rows = []
        feedback_X = []
        feedback_y = []
        for s in samples:
            amt = max(float(s.get("amount", 0.0)), 0.0)
            curr = str(s.get("currency", "INR") or "INR").strip().upper()
            fx = FX_TO_INR.get(curr, 1.0)
            amt_inr = amt * fx
            dev_inr = abs(float(s.get("deviation", 0.0))) * fx
            drift = abs(float(s.get("dateDifferenceDays", 0.0)))
            rel = dev_inr / (amt_inr + 1.0) if amt_inr > 0 else 0.0
            is_cross = 1.0 if curr != "INR" else 0.0
            feat = self._build_feature_row(amt_inr, dev_inr, rel, drift, 0.0, is_cross)

            label = s.get("isAnomaly")
            if label is True:
                feedback_X.append(feat)
                feedback_y.append(1)
            elif label is False:
                normal_rows.append(feat)
                feedback_X.append(feat)
                feedback_y.append(0)
            else:
                normal_rows.append(feat)

        total_count = len(normal_rows) + len([y for y in feedback_y if y == 1])
        if total_count < 10:
            self._init_baseline_model()
            return self.calibrated_sample_count, self.model_version, self.calibration_mode

        X_live_normal = np.array(normal_rows if normal_rows else feedback_X, dtype=float)
        # Blend real portfolio normal rows with stratified corpus anchor so small live portfolios remain well-regularized
        X_blended = np.vstack([X_corpus[:600], X_live_normal])
        mode = "live-portfolio-blended"
        self._fit_matrix(X_blended, mode, total_count)

        # Fit supervised analyst-feedback classifier when labeled resolutions are provided
        self.feedback_clf = None
        if len(feedback_y) >= 4 and len(set(feedback_y)) == 2:
            X_fb = self.scaler.transform(np.array(feedback_X, dtype=float))
            clf_fb = LogisticRegression(class_weight="balanced", max_iter=500, random_state=42)
            clf_fb.fit(X_fb, np.array(feedback_y, dtype=int))
            self.feedback_clf = clf_fb
            self.calibration_mode = "live-feedback-hybrid"

        val_scores = [self._raw_ensemble_score(row.reshape(1, -1))[0] for row in X_val]
        self.validation_roc_auc = round(float(roc_auc_score(y_val, val_scores)), 4)
        return self.calibrated_sample_count, self.model_version, self.calibration_mode

    def analyze(self, evidence: TransactionEvidence, feature_context: Dict[str, Any] | None) -> Tuple[float, str, List[str], str, str, List[Dict[str, Any]], Dict[str, float]]:
        signals = []
        try:
            amt = float(evidence.amount)
        except (ValueError, TypeError):
            amt = 0.0

        deviation = 0.0
        expected = 0.0
        date_drift = 0.0
        unmatched_side = None

        if feature_context:
            try:
                deviation = abs(float(feature_context.get("amountDeviation", 0.0)))
            except (ValueError, TypeError):
                deviation = 0.0

            try:
                expected = float(feature_context.get("expectedAmount", 0.0))
            except (ValueError, TypeError):
                expected = 0.0

            try:
                date_drift = abs(float(feature_context.get("dateDifferenceDays", 0.0)))
            except (ValueError, TypeError):
                date_drift = 0.0

            unmatched_side = feature_context.get("unmatchedSide")

        curr = (evidence.currency or "INR").strip().upper()
        fx = FX_TO_INR.get(curr, 1.0)
        amt_inr = amt * fx
        expected_inr = expected * fx
        deviation_inr = deviation * fx

        base_amt = expected_inr if expected_inr > 0 else amt_inr
        rel_ratio = deviation_inr / (base_amt + 1.0) if base_amt > 0 else (1.0 if deviation_inr > 0 else 0.0)

        # Multi-signal extraction (FX-normalized to INR-equivalent exposure; single-sided unmatched records naturally have ~100% rel_ratio)
        if deviation_inr >= 5000 or (not unmatched_side and rel_ratio >= 0.20):
            signals.append("CRITICAL_AMOUNT_DEVIATION")
        elif deviation_inr >= 500 or (not unmatched_side and rel_ratio >= 0.05):
            signals.append("MODERATE_AMOUNT_DEVIATION")
        elif deviation_inr > 0:
            signals.append("MINOR_VARIANCE_TOLERANCE")

        if amt_inr >= 100000 or expected_inr >= 100000:
            signals.append("HIGH_VALUE_EXPOSURE")

        if date_drift >= 3.0:
            signals.append("TEMPORAL_DRIFT_OUTLIER")
        elif date_drift >= 1.0:
            signals.append("SETTLEMENT_DATE_SLIPPAGE")

        if unmatched_side:
            signals.append("COUNTERPARTY_RECONCILIATION_GAP")

        if amt <= 0 and expected <= 0:
            signals.append("ZERO_OR_NEGATIVE_VALUATION")

        # 7-feature FX-normalized vector
        sample = self._build_feature_row(
            amt_inr,
            deviation_inr,
            rel_ratio,
            date_drift,
            1.0 if unmatched_side else 0.0,
            1.0 if curr != "INR" else 0.0,
        )
        sample_2d = sample.reshape(1, -1)

        ensemble_score, _, _ = self._raw_ensemble_score(sample_2d)
        if self.feedback_clf is not None:
            fb_prob = float(self.feedback_clf.predict_proba(self.scaler.transform(sample_2d))[0][1])
            ensemble_score = (0.75 * ensemble_score) + (0.25 * fb_prob)

        # Calibrated domain floors scaled cleanly to INR-equivalent exposure severity
        if "CRITICAL_AMOUNT_DEVIATION" in signals:
            ensemble_score = max(ensemble_score, 0.85 if deviation_inr >= 10000 or (not unmatched_side and rel_ratio >= 0.20) else 0.76)
        if "COUNTERPARTY_RECONCILIATION_GAP" in signals:
            if deviation_inr >= 15000:
                ensemble_score = max(ensemble_score, 0.82)
            elif deviation_inr >= 5000:
                ensemble_score = max(ensemble_score, 0.72)
            elif deviation_inr >= 1000:
                ensemble_score = max(ensemble_score, 0.56)
            else:
                ensemble_score = min(max(ensemble_score, 0.42), 0.58)
        if "HIGH_VALUE_EXPOSURE" in signals and deviation_inr > 0:
            ensemble_score = max(ensemble_score, 0.88)
        if "TEMPORAL_DRIFT_OUTLIER" in signals:
            ensemble_score = max(ensemble_score, 0.68)
        if deviation_inr == 0 and date_drift <= 0.5 and not unmatched_side:
            ensemble_score = min(ensemble_score, 0.15)

        anomaly_score = round(float(np.clip(ensemble_score, 0.05, 0.98)), 2)

        # Risk level categorization
        if anomaly_score >= 0.80:
            risk_level = "CRITICAL"
        elif anomaly_score >= 0.60:
            risk_level = "HIGH"
        elif anomaly_score >= 0.35:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        # 4. Explainable Feature Attributions (SHAP-style mathematical signal contribution)
        dev_imp = min(deviation / 10000.0, 1.0) * 0.40
        rel_imp = min(rel_ratio / 0.25, 1.0) * 0.30
        drift_imp = min(date_drift / 3.0, 1.0) * 0.18
        orphan_imp = (0.22 if unmatched_side else 0.0)

        total_imp = dev_imp + rel_imp + drift_imp + orphan_imp
        if total_imp <= 0:
            total_imp = 1.0
            dev_imp = 0.25
            rel_imp = 0.25
            drift_imp = 0.25
            orphan_imp = 0.25

        p_dev = int(round((dev_imp / total_imp) * 100))
        p_rel = int(round((rel_imp / total_imp) * 100))
        p_drift = int(round((drift_imp / total_imp) * 100))
        p_orphan = max(0, 100 - (p_dev + p_rel + p_drift))

        feature_attributions = [
            {
                "feature": "Discrepancy Magnitude",
                "contributionPct": p_dev,
                "rawMetric": f"{curr} {deviation:,.2f}",
                "impactDirection": "INCREASES_ANOMALY" if deviation > 0 else "NORMAL_RANGE"
            },
            {
                "feature": "Relative Variance Ratio",
                "contributionPct": p_rel,
                "rawMetric": f"{rel_ratio:.1%}",
                "impactDirection": "INCREASES_ANOMALY" if rel_ratio > 0.02 else "NORMAL_RANGE"
            },
            {
                "feature": "Settlement Date Slippage",
                "contributionPct": p_drift,
                "rawMetric": f"{date_drift:.1f} days",
                "impactDirection": "INCREASES_ANOMALY" if date_drift >= 1.0 else "NORMAL_RANGE"
            },
            {
                "feature": "Counterparty Reconciliation Gap",
                "contributionPct": p_orphan,
                "rawMetric": "Single-Sided Unmatched" if unmatched_side else "Dual-Sided Matched",
                "impactDirection": "INCREASES_ANOMALY" if unmatched_side else "NORMAL_RANGE"
            }
        ]

        if self.feedback_clf is not None:
            ensemble_weights = {
                "isolationForest": 0.34,
                "localOutlierFactor": 0.22,
                "robustMahalanobis": 0.19,
                "analystFeedbackClassifier": 0.25,
            }
        else:
            ensemble_weights = {
                "isolationForest": 0.45,
                "localOutlierFactor": 0.30,
                "robustMahalanobis": 0.25,
            }

        return anomaly_score, risk_level, signals, self.algorithm, self.model_version, feature_attributions, ensemble_weights

anomaly_detector_service = AnomalyDetectorService()
