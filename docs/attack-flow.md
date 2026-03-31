# Attack Flow — Technical Deep Dive

## Overview

The Axios supply chain attack is a textbook example of **dependency confusion / transitive dependency poisoning**. The attacker never modified a single line of Axios source code. Instead, they injected a malicious package one level deeper in the dependency tree, relying on npm's automatic postinstall lifecycle to execute the dropper invisibly.

## Why This Attack Is Hard to Catch

Traditional security reviews focus on the code you wrote and the packages you directly depend on. This attack lived in a **transitive dependency** — a dependency of a dependency — which most developers never inspect. The real Axios has three legitimate dependencies (`follow-redirects`, `form-data`, `proxy-from-env`). The addition of `plain-crypto-js` was the only anomaly, and without automated tooling it would require a manual diff of `package-lock.json` to notice.

Furthermore, the malicious package was **never imported** anywhere in the Axios source. It was a pure postinstall side-effect. No `require('plain-crypto-js')` anywhere in the codebase — making grep-based auditing blind to it.

## Step-by-Step Attack Reconstruction

### Phase 0 — Staging (18 hours before)

The attacker published `plain-crypto-js@4.2.0` — a completely clean version — to establish legitimacy on the npm registry. This is a common technique to avoid triggering new-package alerts on security scanners.

### Phase 1 — Account Compromise

The attacker obtained a **long-lived classic npm access token** for the `jasonsaayman` account (the primary Axios maintainer). Classic tokens don't expire and aren't scoped — once obtained, they grant full publish access to every package owned by that account.

The registered email on the account was changed to `ifstap@proton.me`, a Proton Mail address controlled by the attacker, effectively locking out the real maintainer.

### Phase 2 — Payload Publication

At 23:59 UTC March 30, `plain-crypto-js@4.2.1` was published. This version added a `postinstall` script pointing to `setup.js` — the cross-platform dropper. The `package.md` clean manifest was also bundled inside.

### Phase 3 — Axios Poisoning (39-minute window)

Using the compromised token, the attacker published:
- `axios@1.14.1` at 00:21 UTC
- `axios@0.30.4` at 01:00 UTC

Both versions added `plain-crypto-js@4.2.1` as a runtime dependency. The rest of the Axios source was identical to the legitimate prior versions.

### Phase 4 — Victim Installation

When any developer runs `npm install axios` (or any tool that depends on axios), npm's dependency resolver pulls in `plain-crypto-js` as a transitive dep and **automatically executes** the postinstall hook. This happens before the developer's own code runs.

### Phase 5 — OS Detection and Payload Delivery

`setup.js` detects the operating system and POSTs the system fingerprint to the C2:

| Platform | Endpoint | Delivery |
|---|---|---|
| macOS | `/product0` | AppleScript → C++ RAT binary |
| Windows | `/product1` | VBScript → PowerShell RAT |
| Linux | `/product2` | Python RAT (`/tmp/ld.py`) |

The C2 responds with the platform-appropriate second-stage payload.

### Phase 6 — RAT Execution

The second-stage RATs share a common command interface:

- `run_payload` — fetch and execute additional binaries from C2
- `shell` — execute arbitrary shell commands on the victim
- `ls` — enumerate the filesystem
- `kill` — terminate the RAT process

The macOS and Linux RATs beacon every **60 seconds**. No persistence mechanism is installed, meaning the RAT dies on reboot. This points to a campaign designed for rapid credential theft rather than long-term persistence.

### Phase 7 — Forensic Cleanup

After the RAT is launched, `setup.js` performs a three-step cleanup:

1. Reads `package.md` (the pre-staged clean manifest)
2. Overwrites `package.json` with the clean manifest (removing the `postinstall` hook)
3. Deletes `setup.js` from disk

Any post-infection inspection of `node_modules/plain-crypto-js` reveals a perfectly normal package. The postinstall hook is gone. The dropper is gone. Only the clean manifest remains.

## Attacker OPSEC Analysis

The attack demonstrates careful operational security:

- **Staging**: clean package published first to avoid "new package" alerts
- **Token reuse**: classic npm tokens don't leave a trail the way OAuth flows do
- **Email swap**: locking the real maintainer out of account recovery
- **No source modification**: bypasses diff-based and grep-based code auditing
- **Transitive dep**: bypasses direct dependency auditing
- **Self-deletion**: defeats post-infection forensic analysis
- **Silent failure**: dropper exits with code 0 on any error to avoid CI/CD failures alerting the team

## What Made It Detectable

Despite the sophistication, several signals could have caught this:

- The `package-lock.json` would show `plain-crypto-js` as a new dependency not present in prior versions
- The npm account's registered email changed shortly before the malicious publish
- `plain-crypto-js` was never imported in any Axios source file
- The `plain-crypto-js` publisher (`nrwise`) had no prior history on npm
- Provenance attestation (if enabled) would have shown the packages were not built by GitHub Actions CI/CD
- Socket, StepSecurity, and SafeDep all flag postinstall scripts in new or modified transitive deps as high-risk
