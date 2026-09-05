import time
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any
from sklearn.ensemble import IsolationForest
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier

# =====================================================================
# 2.1 MICROSTRUCTURE FEATURE EXTRACTOR
# =====================================================================
class MicrostructureFeatureExtractor:
    """
    Converts raw L2 LOB tick snapshots into an 8-dimensional feature vector:
    1. ofi_500ms: Order Flow Imbalance at 500ms horizon
    2. ofi_2000ms: Order Flow Imbalance at 2000ms horizon
    3. vpin: Volume-Synchronized Probability of Toxicity (rolling trade-toxicity bucket)
    4. cancel_to_fill: Canceled limit volume / executed volume (rolling window)
    5. depth_imbalance: Normalized top-5 bid vs top-5 ask volume
    6. micro_price_elasticity: VWAP mid-price minus standard mid-price
    7. book_slope_delta: Rate of change of order-book depth density
    8. bid_ask_spread: Relative bid-ask spread in basis points
    """
    FEATURE_NAMES = [
        "ofi_500ms",
        "ofi_2000ms",
        "vpin",
        "cancel_to_fill",
        "depth_imbalance",
        "micro_price_elasticity",
        "book_slope_delta",
        "bid_ask_spread"
    ]

    def extract_vectorized(self, df_ticks: pd.DataFrame) -> np.ndarray:
        ofi_500 = df_ticks["ofi_500ms"].values
        ofi_2000 = df_ticks["ofi_2000ms"].values
        vpin = df_ticks["vpin"].values
        cancel_to_fill = df_ticks["cancel_to_fill"].values
        depth_imb = df_ticks["depth_imbalance"].values
        elasticity = df_ticks["micro_price_elasticity"].values
        slope_delta = df_ticks["book_slope_delta"].values
        spread = df_ticks.get("bid_ask_spread", pd.Series(0.0005, index=df_ticks.index)).values

        features = np.column_stack([
            ofi_500, ofi_2000, vpin, cancel_to_fill,
            depth_imb, elasticity, slope_delta, spread
        ]).astype(np.float32)

        return features

    def raw_payload_to_array(self, raw_features: Dict[str, float]) -> np.ndarray:
        return np.array([
            float(raw_features.get("ofi_500ms", 0.0)),
            float(raw_features.get("ofi_2000ms", 0.0)),
            float(raw_features.get("vpin", 0.15)),
            float(raw_features.get("cancel_to_fill", 1.0)),
            float(raw_features.get("depth_imbalance", 0.0)),
            float(raw_features.get("micro_price_elasticity", 0.0)),
            float(raw_features.get("book_slope_delta", 0.0)),
            float(raw_features.get("bid_ask_spread", 0.0005))
        ], dtype=np.float32)


# =====================================================================
# 2.2 - 2.5 GHOST LIQUIDITY ML PIPELINE & FAST REGIME CLASSIFIER
# =====================================================================
class GhostLiquidityPipeline:
    """
    Production-grade hybrid ML Pipeline:
    - IsolationForest (120 estimators) continuous min-max scaled Anomaly Index [0.0, 1.0]
    - Horizontally stacked 9D augmented matrix (8D raw features + Anomaly Index)
    - XGBClassifier (150 estimators) + CalibratedClassifierCV(method='sigmoid')
    - Sub-5ms predict_tick_fast() single-tick hot path using raw NumPy operations
    """
    def __init__(self):
        self.iso_forest = IsolationForest(
            n_estimators=120,
            contamination=0.03,
            random_state=42,
            n_jobs=1
        )
        self.xgb_base = XGBClassifier(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.03,
            tree_method='hist',
            objective='binary:logistic',
            random_state=42,
            n_jobs=1
        )
        self.calibrated_model = CalibratedClassifierCV(
            estimator=self.xgb_base,
            method='sigmoid',
            cv=3
        )
        self.feature_extractor = MicrostructureFeatureExtractor()
        self.is_fitted = False
        self._min_s = 0.0
        self._max_s = 1.0

    def fit(self, X_raw: np.ndarray, y_labels: np.ndarray):
        # Fit IsolationForest
        self.iso_forest.fit(X_raw)
        raw_scores = -self.iso_forest.score_samples(X_raw)
        self._min_s = float(raw_scores.min())
        self._max_s = float(raw_scores.max())
        anomaly_index = (raw_scores - self._min_s) / (self._max_s - self._min_s + 1e-8)

        # 2.3 Feature Stacking -> 9D X_augmented
        X_augmented = np.hstack([X_raw, anomaly_index.reshape(-1, 1)])

        # Train Calibrated Model
        self.calibrated_model.fit(X_augmented, y_labels)
        self.is_fitted = True

    def predict_tick_fast(self, raw_features_input: Any) -> Dict[str, Any]:
        """
        Hot path single-tick inference (<5ms). Avoids DataFrame construction.
        Operates directly on raw NumPy arrays.
        """
        t0 = time.perf_counter()

        if isinstance(raw_features_input, dict):
            raw_array = self.feature_extractor.raw_payload_to_array(raw_features_input)
            raw_features_dict = raw_features_input
        else:
            raw_array = np.asarray(raw_features_input, dtype=np.float32)
            raw_features_dict = {
                name: round(float(val), 4)
                for name, val in zip(MicrostructureFeatureExtractor.FEATURE_NAMES, raw_array)
            }

        X_single = raw_array.reshape(1, -1)

        if self.is_fitted:
            # 1. Compute Anomaly Score
            raw_score = -self.iso_forest.score_samples(X_single)[0]
            anomaly_index = float((raw_score - self._min_s) / (self._max_s - self._min_s + 1e-8))
            anomaly_index = float(np.clip(anomaly_index, 0.0, 1.0))

            # 2. Feature Stacking -> 9D
            X_aug = np.hstack([X_single, np.array([[anomaly_index]])])

            # 3. Fast Supervised Calibrated Risk Prediction
            crash_risk = float(self.calibrated_model.predict_proba(X_aug)[0, 1])
        else:
            anomaly_index = 0.10
            crash_risk = 0.05

        # 2.5 Market Regime Classifier (Priority Order Evaluation)
        ofi_500ms = float(raw_array[0])
        vpin = float(raw_array[2])
        cancel_to_fill = float(raw_array[3])

        if crash_risk > 0.65 or (cancel_to_fill > 4.5 and ofi_500ms < -20.0):
            regime = "Ghost Liquidity Drain"
        elif anomaly_index > 0.75 and vpin > 0.55:
            regime = "Toxic Spoofing Surge"
        elif abs(ofi_500ms) > 12.0:
            regime = "Algorithmic Churn"
        else:
            regime = "Organic Market"

        latency_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "timestamp": pd.Timestamp.now().isoformat(),
            "symbol": "SYNTH-01",
            "crash_risk": round(crash_risk, 4),
            "anomaly_index": round(anomaly_index, 4),
            "regime": regime,
            "latency_ms": round(latency_ms, 2),
            "raw_features": raw_features_dict
        }


# =====================================================================
# 2.6 SYNTHETIC VERIFICATION BLOCK
# =====================================================================
if __name__ == "__main__":
    print("=" * 70)
    print("INITIALIZING GHOST LIQUIDITY PIPELINE & SYNTHETIC VERIFICATION")
    print("=" * 70)

    np.random.seed(42)
    N_samples = 1500

    X_organic = np.random.normal(
        loc=[0.0, 0.0, 0.20, 1.2, 0.05, 0.0001, 0.001, 0.0005],
        scale=[3.0, 3.0, 0.08, 0.4, 0.10, 0.0002, 0.002, 0.0001],
        size=(N_samples, 8)
    )

    X_crash = np.random.normal(
        loc=[-26.5, -18.2, 0.68, 5.8, -0.65, -0.0045, -0.120, 0.0025],
        scale=[4.0, 4.0, 0.10, 1.0, 0.15, 0.0010, 0.030, 0.0005],
        size=(int(N_samples * 0.05), 8)
    )

    X_all = np.vstack([X_organic, X_crash]).astype(np.float32)
    y_all = np.array([0] * N_samples + [1] * int(N_samples * 0.05))

    pipeline = GhostLiquidityPipeline()
    t_start = time.time()
    pipeline.fit(X_all, y_all)
    fit_time = (time.time() - t_start) * 1000.0
    print(f"[+] Model Fit Completed in {fit_time:.2f} ms")

    dummy_tick = {
        "ofi_500ms": -24.1, "ofi_2000ms": -11.3, "vpin": 0.61, "cancel_to_fill": 5.2,
        "depth_imbalance": -0.44, "micro_price_elasticity": 0.0021, "book_slope_delta": -0.09, "bid_ask_spread": 0.0012
    }
    _ = pipeline.predict_tick_fast(dummy_tick)

    print("\n" + "=" * 70)
    print("SIMULATING SPOOFED / GHOST-LIQUIDITY TICK INFERENCE")
    print("=" * 70)

    spoofed_tick = {
        "ofi_500ms": -25.8,
        "ofi_2000ms": -14.2,
        "vpin": 0.65,
        "cancel_to_fill": 5.6,
        "depth_imbalance": -0.52,
        "micro_price_elasticity": -0.0035,
        "book_slope_delta": -0.14,
        "bid_ask_spread": 0.0018
    }

    pred = pipeline.predict_tick_fast(spoofed_tick)

    print(f"\nPrediction Payload:")
    print(f"  Timestamp:     {pred['timestamp']}")
    print(f"  Symbol:        {pred['symbol']}")
    print(f"  Crash Risk %:  {pred['crash_risk'] * 100:.1f}%")
    print(f"  Anomaly Index: {pred['anomaly_index']:.4f}")
    print(f"  Market Regime: {pred['regime']}")
    print(f"  Hot Latency:   {pred['latency_ms']} ms")

    print("\nRaw Features Matrix:")
    for k, v in pred['raw_features'].items():
        print(f"  - {k:<24}: {v}")

    assert pred['regime'] in ["Ghost Liquidity Drain", "Toxic Spoofing Surge"], "Failed to flag spoofed tick!"

    print("\n" + "=" * 70)
    print("GHOST LIQUIDITY PIPELINE VERIFIED SUCCESSFULLY")
    print("=" * 70)
