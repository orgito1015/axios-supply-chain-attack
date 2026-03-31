/**
 * fake-axios/index.js
 *
 * This is a clean, functional stub that mimics the real Axios API.
 * In the actual attack, the real Axios source was untouched — this
 * is exactly what made the attack so hard to detect via code review.
 *
 * The malicious behavior lives entirely in the transitive dependency
 * (plain-crypto-js), not here.
 */

const http = require("http");
const https = require("https");
const url = require("url");

function request(method, urlString, data, config = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(urlString);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        ...(config.headers || {}),
      },
    };

    const req = transport.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ data: JSON.parse(body), status: res.statusCode, headers: res.headers });
        } catch {
          resolve({ data: body, status: res.statusCode, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

const axios = {
  get: (url, config) => request("GET", url, null, config),
  post: (url, data, config) => request("POST", url, data, config),
  put: (url, data, config) => request("PUT", url, data, config),
  delete: (url, config) => request("DELETE", url, null, config),
  patch: (url, data, config) => request("PATCH", url, data, config),
};

module.exports = axios;
module.exports.default = axios;
