# AegisLOB — Ghost Liquidity & Flash Crash Surveillance Terminal

> Production-grade real-time market surveillance system predicting **flash crashes (>1.5% price drop within 10s)** and detecting **ghost liquidity drains** with sub-5ms model inference latency.

---

## ⚡ Executive Summary

**AegisLOB** is an institutional-grade Level-2 (L2) limit order book market surveillance terminal built for quantitative trading desks and compliance teams. 

Unlike traditional risk systems that react *after* prices fall, AegisLOB detects high-frequency market microstructure anomalies—such as **Order Flow Imbalance (OFI)**, **Volume-Synchronized Probability of Toxicity (VPIN)**, and **Cancel-to-Fill surges**—to spot liquidity withdrawals and predict flash crashes seconds before price collapses occur.

---

## 🏗️ System Architecture

```
                                [ L2 Limit Order Book Stream ]
                                              │
                                              ▼
                        1. Microstructure Feature Extractor (8D Vector)
             (OFI 500ms/2000ms, VPIN, Cancel/Fill Ratio, Depth Imbalance, Elasticity, Slope)
                                              │
                                ┌─────────────┴─────────────┐
                                ▼                           │
                 2. IsolationForest (Unsupervised)           │
                  - Measures order book deformation         │
                  - Outputs Anomaly Index [0.0 - 1.0]       │
                                │                           │
                                ▼                           │
                 3. Feature Stacking (9D Matrix) <──────────┘
                    (8 Raw Features + Anomaly Index)
                                │
                                ▼
                 4. Calibrated XGBoost Classifier (Supervised)
                  - CalibratedClassifierCV(method='sigmoid')
                  - Predicts Empirical Flash Crash Risk %
                                │
                                ▼
                 5. Sub-5ms Hot-Path Priority Decision Engine
                  - Evaluates Priority Market Regimes
                  - Payload: { timestamp, symbol, crash_risk, anomaly_index, regime, latency_ms }
                                │
                                ├───────────────────────────┐
                                ▼                           ▼
                      WebSocket Live Feed            REST API Endpoints
                    `WS /stream/ticks`            `/accuracy/backtest`, `/regimes/history`
                                │
                                ▼
                     NOC Surveillance Dashboard
```

---

## 🔥 Key Features

- **8D Microstructure Feature Extraction**:
  - `ofi_500ms` & `ofi_2000ms`: Directional Order Flow Imbalance over short & medium windows.
  - `vpin`: Volume-Synchronized Probability of Toxicity (order flow toxicity metric).
  - `cancel_to_fill`: Canceled limit order volume ÷ executed trade volume.
  - `depth_imbalance`: Normalized top-5 bid vs ask volume imbalance.
  - `micro_price_elasticity`: VWAP mid-price minus standard mid-price deviation.
  - `book_slope_delta`: Rate of change of order book depth density.
  - `bid_ask_spread`: Relative bid-ask spread in basis points.

- **Hybrid Unsupervised/Supervised ML Core (`pipeline.py`)**:
  - `IsolationForest` (120 trees) generates a non-parametric **Anomaly Index** to flag novel order book deformations.
  - Feature Stacking creates a 9D augmented matrix ($X_{\text{augmented}} = [\vec{X}, \text{AnomalyIndex}]$).
  - `CalibratedClassifierCV(XGBClassifier)` outputs Platt-sigmoid calibrated empirical crash probabilities.

- **Sub-5ms Hot-Path Execution**:
  - Fast-path single-tick inference (`predict_tick_fast`) operates directly on raw NumPy vectors (zero DataFrame creation overhead) to guarantee sub-5ms SLA.

- **Real-Time $T_0$ vs $T_{+10s}$ Backtest Verification (`/accuracy/backtest`)**:
  - Every prediction made at $T_0$ is held in a rolling buffer and verified against realized price movements 10 seconds later ($T_{+10s}$) to compute live **Accuracy %, Precision %, Recall %, and F1-Score**.

- **Terminal-Grade NOC UI Dashboard (`frontend/`)**:
  - High-density dark mode design system (`#08090a` canvas, JetBrains Mono font, 1px solid hairline borders).
  - Flat HTML5 canvas 60s crash-risk sparkline chart.
  - Selected tick microstructure feature inspector with plain-English diagnostics.
  - Interactive Regime Classification Guide modal.

---

## 📊 Market Regime Definitions

| Regime Token | Trigger Condition | Market Meaning |
|---|---|---|
| 🔴 **Ghost Liquidity Drain** | Crash Risk > 65% OR (Cancel/Fill > 4.5 AND OFI < -20.0) | Market makers pulling bid volume while order flow turns heavily negative. Precursor to flash crashes. |
| 🟡 **Toxic Spoofing Surge** | Anomaly Index > 0.75 AND VPIN > 0.55 | Deceptive phantom quotes placed by algorithms to coerce market order flow. |
| 🔵 **Algorithmic Churn** | \|OFI_500ms\| > 12.0 | High-frequency directional momentum and order book churn. |
| ⚪ **Organic Market** | Default State | Standard, balanced two-sided order book activity. |

---

## 🚀 Quickstart & Installation

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/priyansh-codeit/AegisLOB.git
cd AegisLOB
pip install fastapi uvicorn numpy pandas scikit-learn xgboost
```

### 2. Launch Real-Time Surveillance Backend
```bash
python server.py
```

### 3. Access Dashboard
Open your browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🌐 API Reference

| Endpoint | Protocol | Description |
|---|---|---|
| **`/stream/ticks`** | `WebSocket` | Pushes real-time L2 tick JSON payloads every ~500ms |
| **`/regimes/history?window=5m`** | `GET REST` | Rolling 5-minute counts and percentage breakdown by market regime |
| **`/accuracy/backtest`** | `GET REST` | Verified outcome ledger ($T_0$ vs $T_{+10s}$), Precision/Recall stats, and Confusion Matrix |
| **`/model/meta`** | `GET REST` | Model metadata, feature list, training timestamp, and calibration mode |

---

## 📁 Repository Directory Structure

```
AegisLOB/
├── pipeline.py            # ML Core Engine: Feature Extractor, IsolationForest & XGBoost
├── server.py              # FastAPI Backend: WebSocket Producer & REST Telemetry API
├── ticks_dataset.csv      # 1,575-row L2 Microstructure Benchmark Dataset
├── design.md              # Design System Specification Contract
├── vercel.json            # Vercel Deployment Routing Configuration
├── README.md              # Official Documentation
├── index.html             # Terminal Dashboard Root Entry Point
├── styles.css             # High-Density Monospace Terminal Stylesheet
├── app.js                 # WebSocket Client & Real-time Canvas Sparkline Logic
└── frontend/              # Frontend Assets Backup Directory
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for details.
