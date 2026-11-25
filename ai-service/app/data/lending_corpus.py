"""Domain-grounded multi-regime financial lending & settlement corpus for ML anomaly baseline training."""
import numpy as np
from typing import Tuple

FX_TO_INR = {
    "INR": 1.0,
    "USD": 84.0,
    "EUR": 90.0,
    "GBP": 106.0,
}


def build_lending_training_corpus(seed: int = 42) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Generates a stratified 2,400-sample multi-regime lending & settlement corpus
    (Retail UPI/NACH EMIs, Commercial NEFT/RTGS Term Loans, Cross-Border FX/SWIFT,
    and controlled anomaly regimes for held-out ROC-AUC validation).

    Returns:
        X_normal: (2280, 7) feature matrix of normal / near-normal lending settlements
        X_val: labeled held-out feature matrix (normal + anomalies)
        y_val: binary labels (0 = normal, 1 = anomaly)
        dev_median, dev_iqr: baseline INR deviation scale stats
    """
    rng = np.random.RandomState(seed)

    def make_features(amt_inr: np.ndarray, dev_inr: np.ndarray, drift: np.ndarray, single_sided: np.ndarray, cross_curr: np.ndarray, dev_med: float, dev_scale: float) -> np.ndarray:
        rel = dev_inr / (amt_inr + 1.0)
        z_dev = np.clip((dev_inr - dev_med) / max(dev_scale, 1.0), 0.0, 20.0)
        return np.column_stack([
            np.log1p(np.maximum(amt_inr, 0.0)),
            np.log1p(np.maximum(dev_inr, 0.0)),
            rel,
            drift,
            single_sided,
            cross_curr,
            z_dev,
        ])

    # 1. Normal Regime A: Retail & Micro-Lending EMIs (UPI / NACH, ~1,100 rows)
    n_retail = 1100
    amt_retail = np.clip(rng.lognormal(mean=np.log(16000.0), sigma=0.65, size=n_retail), 1200.0, 85000.0)
    dev_retail = np.abs(rng.normal(loc=0.0, scale=8.0, size=n_retail))
    drift_retail = np.clip(rng.exponential(scale=0.25, size=n_retail), 0.0, 1.0)

    # 2. Normal Regime B: Commercial & SME Term Loans (NEFT / RTGS, ~800 rows)
    n_comm = 800
    amt_comm = np.clip(rng.lognormal(mean=np.log(75000.0), sigma=0.60, size=n_comm), 25000.0, 450000.0)
    dev_comm = np.abs(rng.normal(loc=0.0, scale=22.0, size=n_comm))
    drift_comm = np.clip(rng.exponential(scale=0.45, size=n_comm), 0.0, 1.5)

    # 3. Normal Regime C: Cross-Border FX & SWIFT Fees (~380 rows, 1.0-1.5d clearing)
    n_fx = 380
    amt_fx = np.clip(rng.lognormal(mean=np.log(95000.0), sigma=0.55, size=n_fx), 18000.0, 500000.0)
    dev_fx = amt_fx * np.clip(rng.normal(loc=0.001, scale=0.0015, size=n_fx), 0.0, 0.005)
    drift_fx = np.clip(rng.exponential(scale=0.65, size=n_fx), 0.0, 2.0)

    amt_norm = np.concatenate([amt_retail, amt_comm, amt_fx])
    dev_norm = np.concatenate([dev_retail, dev_comm, dev_fx])
    drift_norm = np.concatenate([drift_retail, drift_comm, drift_fx])
    single_norm = np.zeros_like(amt_norm)
    cross_norm = np.concatenate([np.zeros(n_retail + n_comm), np.ones(n_fx)])

    dev_median = float(np.median(dev_norm))
    dev_iqr = float(max(np.percentile(dev_norm, 75) - np.percentile(dev_norm, 25), 25.0))

    X_normal = make_features(amt_norm, dev_norm, drift_norm, single_norm, cross_norm, dev_median, dev_iqr)

    # 4. Held-out Validation Set (200 normal + 120 realistic anomalies)
    n_val_norm = 200
    v_amt_n = np.clip(rng.lognormal(mean=np.log(28000.0), sigma=0.75, size=n_val_norm), 1500.0, 350000.0)
    v_dev_n = np.abs(rng.normal(loc=0.0, scale=12.0, size=n_val_norm))
    v_drift_n = np.clip(rng.exponential(scale=0.35, size=n_val_norm), 0.0, 1.2)
    X_val_norm = make_features(v_amt_n, v_dev_n, v_drift_n, np.zeros(n_val_norm), np.zeros(n_val_norm), dev_median, dev_iqr)

    n_val_anom = 120
    a_amt = np.clip(rng.lognormal(mean=np.log(45000.0), sigma=0.80, size=n_val_anom), 5000.0, 600000.0)
    a_dev = a_amt * rng.uniform(0.15, 0.90, size=n_val_anom)
    a_drift = rng.uniform(2.5, 10.0, size=n_val_anom)
    a_single = rng.choice([0.0, 1.0], size=n_val_anom, p=[0.6, 0.4])
    X_val_anom = make_features(a_amt, a_dev, a_drift, a_single, np.zeros(n_val_anom), dev_median, dev_iqr)

    X_val = np.vstack([X_val_norm, X_val_anom])
    y_val = np.concatenate([np.zeros(n_val_norm, dtype=int), np.ones(n_val_anom, dtype=int)])

    return X_normal, X_val, y_val, dev_median, dev_iqr
