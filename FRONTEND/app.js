// GHOST LIQUIDITY & FLASH CRASH SURVEILLANCE TERMINAL FRONTEND (app.js)

const WS_URL = `ws://${window.location.hostname || "127.0.0.1"}:8000/stream/ticks`;
const API_BASE = `http://${window.location.hostname || "127.0.0.1"}:8000`;

let socket = null;
let streamTicks = [];
let alertTicks = [];
let sparklineData = []; // Last 60 ticks
let activeFilter = "ALL";
let selectedTick = null;

// Tab Navigation
const tabLive = document.getElementById("tab-live");
const tabAccuracy = document.getElementById("tab-accuracy");
const viewLive = document.getElementById("view-live");
const viewAccuracy = document.getElementById("view-accuracy");

tabLive.onclick = () => {
    tabLive.classList.add("active-tab");
    tabAccuracy.classList.remove("active-tab");
    viewLive.classList.remove("hidden");
    viewAccuracy.classList.add("hidden");
};

tabAccuracy.onclick = () => {
    tabAccuracy.classList.add("active-tab");
    tabLive.classList.remove("active-tab");
    viewAccuracy.classList.remove("hidden");
    viewLive.classList.add("hidden");
    fetchAccuracyBacktest();
};

// Clock Updates
function updateClock() {
    const now = new Date();
    document.getElementById("utc-clock").textContent = now.toISOString().substring(11, 19);
}
setInterval(updateClock, 1000);
updateClock();

// Connect WebSocket
function connectWebSocket() {
    const wsStatus = document.getElementById("ws-status");
    wsStatus.textContent = "CONNECTING...";
    wsStatus.style.color = "#ffaa33";

    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        wsStatus.textContent = "CONNECTED (LIVE)";
        wsStatus.style.color = "#00cc66";
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "SNAPSHOT") {
            if (msg.recent_ticks) {
                msg.recent_ticks.forEach(processTick);
            }
        } else if (msg.timestamp) {
            processTick(msg);
        }
    };

    socket.onclose = () => {
        wsStatus.textContent = "DISCONNECTED (RETRYING...)";
        wsStatus.style.color = "#ff6666";
        setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = (err) => {
        console.error("WS Error:", err);
    };
}

// Process Incoming Tick Payload per Data Contract
function processTick(tick) {
    appendStreamRow(tick);
    updateSparkline(tick);
    updateTelemetry(tick);
    updateBanner(tick);

    if (tick.regime !== "Organic Market") {
        alertTicks.unshift(tick);
        if (alertTicks.length > 100) alertTicks.pop();
        renderAlerts();
    }

    updateRegimeCounts();
}

// Update System Threat Banner
function updateBanner(tick) {
    const banner = document.getElementById("system-banner");
    const bannerText = document.getElementById("banner-text");

    if (tick.regime === "Ghost Liquidity Drain") {
        banner.className = "system-banner banner-alert";
        bannerText.textContent = `ALERT: GHOST LIQUIDITY DRAIN DETECTED ON ${tick.symbol} — CRASH RISK ${(tick.crash_risk * 100).toFixed(1)}%`;
    } else if (tick.regime === "Toxic Spoofing Surge") {
        banner.className = "system-banner banner-alert";
        bannerText.textContent = `WARNING: TOXIC SPOOFING SURGE DETECTED ON ${tick.symbol} — ANOMALY INDEX ${tick.anomaly_index.toFixed(4)}`;
    } else {
        banner.className = "system-banner banner-normal";
        bannerText.textContent = `OPERATIONAL — STREAMING REAL-TIME L2 MICROSTRUCTURE ENGINE METRICS`;
    }
}

// Render Tick Stream Table
function appendStreamRow(tick) {
    streamTicks.unshift(tick);
    if (streamTicks.length > 60) streamTicks.pop();

    const tbody = document.getElementById("stream-tbody");
    const tr = document.createElement("tr");

    let regimeClass = "tag-organic";
    if (tick.regime === "Ghost Liquidity Drain") regimeClass = "tag-ghost";
    else if (tick.regime === "Toxic Spoofing Surge") regimeClass = "tag-spoof";
    else if (tick.regime === "Algorithmic Churn") regimeClass = "tag-churn";

    const riskColor = tick.crash_risk > 0.65 ? "#ff6666" : (tick.crash_risk > 0.40 ? "#ffaa33" : "#66b2ff");

    tr.innerHTML = `
        <td>${tick.timestamp.substring(11, 19)}</td>
        <td style="font-weight:700">${tick.symbol || 'SYNTH-01'}</td>
        <td style="font-weight:700; color:${riskColor}">${(tick.crash_risk * 100).toFixed(1)}%</td>
        <td>${tick.anomaly_index.toFixed(4)}</td>
        <td><span class="tag ${regimeClass}">${tick.regime}</span></td>
        <td>${tick.latency_ms.toFixed(2)} ms</td>
    `;

    tr.onclick = () => {
        document.querySelectorAll("#stream-tbody tr").forEach(r => r.classList.remove("selected-row"));
        tr.classList.add("selected-row");
        inspectTick(tick);
    };

    tbody.insertBefore(tr, tbody.firstChild);
    if (tbody.children.length > 60) {
        tbody.removeChild(tbody.lastChild);
    }

    document.getElementById("tick-count").textContent = `${streamTicks.length} TICKS`;
}

// Inspect Selected Tick Microstructure Signals
function inspectTick(tick) {
    selectedTick = tick;
    const inspector = document.getElementById("tick-inspector");
    const rf = tick.raw_features || {};

    let regimeClass = "tag-organic";
    if (tick.regime === "Ghost Liquidity Drain") regimeClass = "tag-ghost";
    else if (tick.regime === "Toxic Spoofing Surge") regimeClass = "tag-spoof";
    else if (tick.regime === "Algorithmic Churn") regimeClass = "tag-churn";

    let expl = "Standard balanced order book depth and organic trade flow.";
    if (tick.regime === "Ghost Liquidity Drain") {
        expl = "CRITICAL RISK: Order flow imbalance is heavily negative while canceled limit orders surge, indicating market makers withdrawing liquidity prior to price drops.";
    } else if (tick.regime === "Toxic Spoofing Surge") {
        expl = "WARNING: Elevated trade toxicity (VPIN > 0.55) combined with non-parametric anomaly score > 0.75, indicating phantom quote manipulation.";
    } else if (tick.regime === "Algorithmic Churn") {
        expl = "MOMENTUM CHURN: High-frequency directional order flow imbalance (|OFI| > 12.0) without immediate liquidity withdrawal.";
    }

    inspector.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>SYMBOL: <b>${tick.symbol || 'SYNTH-01'}</b></span>
            <span class="tag ${regimeClass}">${tick.regime}</span>
        </div>
        <div class="feat-grid">
            <div class="feat-item"><span>CRASH RISK:</span> <span style="color:${tick.crash_risk > 0.65 ? '#ff6666' : '#33ff99'}">${(tick.crash_risk * 100).toFixed(1)}%</span></div>
            <div class="feat-item"><span>ANOMALY INDEX:</span> <span>${tick.anomaly_index.toFixed(4)}</span></div>
            <div class="feat-item"><span>OFI 500MS:</span> <span>${rf.ofi_500ms !== undefined ? rf.ofi_500ms : '-'}</span></div>
            <div class="feat-item"><span>OFI 2000MS:</span> <span>${rf.ofi_2000ms !== undefined ? rf.ofi_2000ms : '-'}</span></div>
            <div class="feat-item"><span>VPIN TOXICITY:</span> <span>${rf.vpin !== undefined ? rf.vpin : '-'}</span></div>
            <div class="feat-item"><span>CANCEL/FILL:</span> <span>${rf.cancel_to_fill !== undefined ? rf.cancel_to_fill : '-'}</span></div>
        </div>
        <div style="font-weight:700; color:var(--text-muted); margin-top:4px;">EXPLANATION / DIAGNOSTIC:</div>
        <div class="inspector-expl">${expl}</div>
    `;
}

// Render Canvas Crash Risk Sparkline Chart (Flat Solid Fill Bars)
function updateSparkline(tick) {
    sparklineData.push({
        risk: tick.crash_risk,
        regime: tick.regime
    });
    if (sparklineData.length > 60) sparklineData.shift();

    document.getElementById("current-risk").textContent = `${(tick.crash_risk * 100).toFixed(1)}%`;

    const canvas = document.getElementById("risk-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width = canvas.clientWidth;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const threshY = height * (1.0 - 0.65);
    ctx.strokeStyle = "#441a1a";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(width, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (sparklineData.length === 0) return;

    const barWidth = Math.max(width / 60, 4);

    for (let i = 0; i < sparklineData.length; i++) {
        const item = sparklineData[i];
        const barHeight = Math.max(item.risk * height, 3);
        const x = i * barWidth;
        const y = height - barHeight;

        let fill = "#2d3b48"; // Organic
        if (item.regime === "Ghost Liquidity Drain") fill = "#ff3333";
        else if (item.regime === "Toxic Spoofing Surge") fill = "#ff9900";
        else if (item.regime === "Algorithmic Churn") fill = "#3399ff";

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
}

// Render Alert Log Table
function renderAlerts() {
    const tbody = document.getElementById("alert-tbody");
    tbody.innerHTML = "";

    const filtered = alertTicks.filter(t => {
        if (activeFilter === "ALL") return true;
        return t.regime === activeFilter;
    });

    document.getElementById("alert-count").textContent = filtered.length;

    filtered.slice(0, 30).forEach(tick => {
        const tr = document.createElement("tr");
        let regimeClass = "tag-churn";
        if (tick.regime === "Ghost Liquidity Drain") regimeClass = "tag-ghost";
        else if (tick.regime === "Toxic Spoofing Surge") regimeClass = "tag-spoof";

        const rf = tick.raw_features || {};

        tr.innerHTML = `
            <td>${tick.timestamp.substring(11, 19)}</td>
            <td><span class="tag ${regimeClass}">${tick.regime}</span></td>
            <td style="font-weight:700; color:#ff6666">${(tick.crash_risk * 100).toFixed(1)}%</td>
            <td>${rf.ofi_500ms !== undefined ? rf.ofi_500ms : '-'}</td>
            <td>${rf.vpin !== undefined ? rf.vpin : '-'}</td>
            <td>${rf.cancel_to_fill !== undefined ? rf.cancel_to_fill : '-'}</td>
        `;

        tr.onclick = () => inspectTick(tick);
        tbody.appendChild(tr);
    });
}

// Filter Event Handler
document.getElementById("regime-filter").addEventListener("change", (e) => {
    activeFilter = e.target.value;
    renderAlerts();
});

// Modal Handlers
document.getElementById("btn-guide").onclick = () => {
    document.getElementById("modal-guide").classList.remove("hidden");
};
document.getElementById("btn-close-modal").onclick = () => {
    document.getElementById("modal-guide").classList.add("hidden");
};

// Fetch Accuracy & Backtest Outcomes from REST API
async function fetchAccuracyBacktest() {
    try {
        const resp = await fetch(`${API_BASE}/accuracy/backtest`);
        const data = await resp.json();

        const accStr = `${data.accuracy_pct}%`;
        document.getElementById("acc-score").textContent = accStr;
        document.getElementById("hdr-acc-val").textContent = accStr;

        document.getElementById("acc-precision").textContent = `${data.precision_pct}%`;
        document.getElementById("acc-recall").textContent = `${data.recall_pct}%`;
        document.getElementById("acc-f1").textContent = data.f1_score;

        document.getElementById("ver-count").textContent = data.total_verified;
        document.getElementById("mat-tp").textContent = data.tp_count;
        document.getElementById("mat-fp").textContent = data.fp_count;
        document.getElementById("mat-tn").textContent = data.tn_count;
        document.getElementById("mat-fn").textContent = data.fn_count;

        const tbody = document.getElementById("backtest-tbody");
        tbody.innerHTML = "";

        const outcomes = data.outcomes || [];
        outcomes.slice().reverse().forEach(o => {
            const tr = document.createElement("tr");

            let badgeTag = "tag-tn";
            let badgeTxt = "CORRECT (TRUE NEGATIVE)";
            let badgeHint = "Model predicted normal action & market stayed stable after 10s";

            if (o.status === "TRUE_POSITIVE") {
                badgeTag = "tag-tp";
                badgeTxt = "CORRECT (TRUE POSITIVE)";
                badgeHint = "Model predicted crash (>65%) & price actually dropped >1.5% after 10s";
            } else if (o.status === "FALSE_POSITIVE") {
                badgeTag = "tag-fp";
                badgeTxt = "FALSE ALARM (FALSE POSITIVE)";
                badgeHint = "Model predicted crash (>65%), but market stayed stable";
            } else if (o.status === "FALSE_NEGATIVE") {
                badgeTag = "tag-fn";
                badgeTxt = "MISSED CRASH (FALSE NEGATIVE)";
                badgeHint = "Model predicted normal action, but price suffered a drop";
            }

            const dropCol = o.realized_drop_pct <= -1.5 ? "#ff6666" : "#33ff99";

            tr.innerHTML = `
                <td>${o.timestamp.substring(11, 19)}</td>
                <td style="font-weight:700">${(o.predicted_risk * 100).toFixed(1)}%</td>
                <td>${o.predicted_regime}</td>
                <td style="font-weight:700; color:${dropCol}">${o.realized_drop_pct}%</td>
                <td>${o.actual_outcome}</td>
                <td><span class="tag ${badgeTag}" title="${badgeHint}">${badgeTxt}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error fetching backtest outcomes:", err);
    }
}

// Update Telemetry Panel
function updateTelemetry(tick) {
    if (streamTicks.length > 0) {
        const latencies = streamTicks.map(t => t.latency_ms);
        latencies.sort((a, b) => a - b);

        const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
        const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

        document.getElementById("lat-p50").textContent = `${p50.toFixed(2)} ms`;
        document.getElementById("lat-p99").textContent = `${p99.toFixed(2)} ms`;
        document.getElementById("metric-total").textContent = streamTicks.length;
    }
}

// Fetch Rolling 5m Regime Statistics from REST API
async function updateRegimeCounts() {
    try {
        const resp = await fetch(`${API_BASE}/regimes/history?window=5m`);
        const data = await resp.json();

        const counts = data.counts || {};
        const total = data.total_ticks || 1;

        const organic = counts["Organic Market"] || 0;
        const churn = counts["Algorithmic Churn"] || 0;
        const spoof = counts["Toxic Spoofing Surge"] || 0;
        const ghost = counts["Ghost Liquidity Drain"] || 0;

        document.getElementById("cnt-organic").textContent = organic;
        document.getElementById("pct-organic").textContent = `${((organic / total) * 100).toFixed(1)}%`;

        document.getElementById("cnt-churn").textContent = churn;
        document.getElementById("pct-churn").textContent = `${((churn / total) * 100).toFixed(1)}%`;

        document.getElementById("cnt-spoof").textContent = spoof;
        document.getElementById("pct-spoof").textContent = `${((spoof / total) * 100).toFixed(1)}%`;

        document.getElementById("cnt-ghost").textContent = ghost;
        document.getElementById("pct-ghost").textContent = `${((ghost / total) * 100).toFixed(1)}%`;
    } catch (err) {
        // Silently handle offline state
    }
}

// Initialize
connectWebSocket();
fetchAccuracyBacktest();
setInterval(updateRegimeCounts, 4000);
setInterval(fetchAccuracyBacktest, 3000);
