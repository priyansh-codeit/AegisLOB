# AegisLOB — Design System Specification Contract

## 0. Role & Objective
This document defines the strict visual, layout, and behavioral design contract for **AegisLOB** — the terminal-grade Ghost Liquidity & Flash Crash Surveillance System built for institutional quantitative desks.

## 1. Aesthetic Principles
- **Style**: Dark NOC / Bloomberg Terminal surveillance dashboard.
- **Background Canvas**: `#08090a` (Near-black).
- **Surface Panels**: `#101216` with `#161920` header bars.
- **Hairline Borders**: `1px solid #222630`.
- **Typography**: `JetBrains Mono` / `IBM Plex Mono` / `Cascadia Code` (Monospace only, tabular numbers).

## 2. Market Regime Color Tokens (Flat Fills Only)
- **Organic Market**: Background `#1a222a`, Foreground `#9ab0c7`, Border `#2d3b48`.
- **Algorithmic Churn**: Background `#0f2b48`, Foreground `#66b2ff`, Border `#1a4d80`.
- **Toxic Spoofing Surge**: Background `#3d2600`, Foreground `#ffaa33`, Border `#664000`.
- **Ghost Liquidity Drain**: Background `#3a1212`, Foreground `#ff6666`, Border `#661a1a`.

## 3. Strict Anti-Patterns
- Zero gradients, zero glassmorphism / blur effects, zero rounded pill buttons, zero emojis as UI icons, zero drop shadows.

## 4. Operational Layout Grid
1. **Header Bar**: Title, System Badge (`AEGISLOB TERMINAL`), Live Navigation Tabs (`[LIVE SURVEILLANCE]`, `[ACCURACY & BACKTEST LOG]`), Accuracy Ticker, Regime Guide button, UTC Clock, and WebSocket status.
2. **Threat Status Banner**: Full-width system alert strip (`OPERATIONAL` vs `ALERT: GHOST LIQUIDITY DRAIN`).
3. **Regime Status Strip**: 4-column metric cards tracking rolling 5m counts and percentage shares.
4. **Main Workspace (3 Panels)**:
   - Panel 1: Live L2 Tick Stream Table.
   - Panel 2: 60s Crash Risk Sparkline Chart & Selected Tick Microstructure Inspector.
   - Panel 3: Anomalous Alert Log Table with Regime Filter.
5. **Accuracy & Backtest Log View**:
   - Accuracy explanation cards (`TRUE POSITIVE`, `TRUE NEGATIVE`, `FALSE POSITIVE`, `FALSE NEGATIVE`).
   - Prediction at $T_0$ vs Realized 10s Market Outcome Ledger.
   - Confusion Matrix Grid (TP, FP, FN, TN).
6. **Telemetry Footer Bar**: Ingested tick count, p50/p99 hot-path latency, calibration status, and sub-5ms model budget indicator.
