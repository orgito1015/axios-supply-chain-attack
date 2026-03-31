/**
 * victim-app/index.js
 *
 * A completely normal-looking application.
 * It just uses axios to make HTTP requests — nothing suspicious here.
 *
 * The compromise already happened silently during `npm install`
 * via the postinstall hook in plain-crypto-js.
 */

const axios = require("fake-axios");

async function main() {
  console.log("[victim-app] Starting up...");
  console.log("[victim-app] Note: by the time you see this, the postinstall");
  console.log("[victim-app] hook already ran during `npm install`. Check your");
  console.log("[victim-app] C2 dashboard at http://localhost:3000/dashboard");

  try {
    const res = await axios.get("http://localhost:3000/dashboard");
    console.log("[victim-app] Got response from server, status:", res.status);
  } catch (e) {
    console.log("[victim-app] Could not reach server:", e.message);
  }
}

main();
