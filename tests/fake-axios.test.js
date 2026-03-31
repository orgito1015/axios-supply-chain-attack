"use strict";

/**
 * tests/fake-axios.test.js
 *
 * Unit tests for fake-axios/index.js
 *
 * Verifies that the axios stub correctly:
 *   - Exposes get, post, put, delete, patch methods
 *   - Constructs HTTP requests with the correct method, path, and headers
 *   - Resolves with { data, status, headers }
 *   - Handles JSON and non-JSON response bodies
 *   - Handles request errors (network failures)
 *   - Sends a JSON-serialised request body for methods that accept one
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Spin up a minimal HTTP server on an ephemeral port.
 * `handler` receives (req, res, bodyString) and must close the response.
 */
function createTestServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => handler(req, res, body));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("fake-axios", () => {
  let server;
  let baseUrl;
  // Collected request metadata from the most-recent server interaction
  let lastRequest;

  before(async () => {
    server = await createTestServer((req, res, body) => {
      lastRequest = { method: req.method, url: req.url, headers: req.headers, body };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server.close();
  });

  // Require after the before hook so any module-level side-effects (none here)
  // happen at test time rather than import time.
  function axios() {
    return require("../fake-axios/index.js");
  }

  it("exports get, post, put, delete, patch methods", () => {
    const ax = axios();
    assert.equal(typeof ax.get, "function");
    assert.equal(typeof ax.post, "function");
    assert.equal(typeof ax.put, "function");
    assert.equal(typeof ax.delete, "function");
    assert.equal(typeof ax.patch, "function");
  });

  it("exports a default property equal to the module itself", () => {
    const ax = axios();
    assert.equal(ax.default, ax);
  });

  it("get() sends a GET request and resolves with { data, status, headers }", async () => {
    const ax = axios();
    const result = await ax.get(`${baseUrl}/test`);

    assert.equal(lastRequest.method, "GET");
    assert.equal(lastRequest.url, "/test");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { ok: true });
    assert.equal(typeof result.headers, "object");
  });

  it("post() sends a POST request with a JSON body", async () => {
    const ax = axios();
    const payload = { name: "demo", value: 42 };
    await ax.post(`${baseUrl}/resource`, payload);

    assert.equal(lastRequest.method, "POST");
    assert.deepEqual(JSON.parse(lastRequest.body), payload);
    assert.ok(lastRequest.headers["content-type"].includes("application/json"));
  });

  it("put() sends a PUT request with a JSON body", async () => {
    const ax = axios();
    const payload = { id: 1, name: "updated" };
    await ax.put(`${baseUrl}/resource/1`, payload);

    assert.equal(lastRequest.method, "PUT");
    assert.deepEqual(JSON.parse(lastRequest.body), payload);
  });

  it("delete() sends a DELETE request without a body", async () => {
    const ax = axios();
    await ax.delete(`${baseUrl}/resource/1`);

    assert.equal(lastRequest.method, "DELETE");
    assert.equal(lastRequest.body, "");
  });

  it("patch() sends a PATCH request with a JSON body", async () => {
    const ax = axios();
    const payload = { name: "patched" };
    await ax.patch(`${baseUrl}/resource/1`, payload);

    assert.equal(lastRequest.method, "PATCH");
    assert.deepEqual(JSON.parse(lastRequest.body), payload);
  });

  it("forwards custom headers from config", async () => {
    const ax = axios();
    await ax.get(`${baseUrl}/secure`, { headers: { Authorization: "Bearer token123" } });

    assert.equal(lastRequest.headers.authorization, "Bearer token123");
  });

  it("resolves with raw string data when the response body is not valid JSON", async () => {
    const plainServer = await createTestServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("hello world");
    });
    const { port } = plainServer.address();
    const ax = axios();

    try {
      const result = await ax.get(`http://127.0.0.1:${port}/text`);
      assert.equal(result.data, "hello world");
      assert.equal(result.status, 200);
    } finally {
      plainServer.close();
    }
  });

  it("preserves response status codes other than 200", async () => {
    const errorServer = await createTestServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
    const { port } = errorServer.address();
    const ax = axios();

    try {
      const result = await ax.get(`http://127.0.0.1:${port}/missing`);
      assert.equal(result.status, 404);
      assert.deepEqual(result.data, { error: "not found" });
    } finally {
      errorServer.close();
    }
  });

  it("rejects when the target host is unreachable", async () => {
    const ax = axios();
    await assert.rejects(
      () => ax.get("http://127.0.0.1:1/unreachable"),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });

  it("sends requests over a path including query parameters", async () => {
    const ax = axios();
    await ax.get(`${baseUrl}/search?q=test&page=1`);

    assert.equal(lastRequest.url, "/search?q=test&page=1");
  });
});
