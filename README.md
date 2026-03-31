# axios-supply-chain-demo

> WARNING: Educational use only. Read [DISCLAIMER.md](./DISCLAIMER.md) before proceeding.

A fully sandboxed, end-to-end reconstruction of the Axios npm supply chain attack (March 31, 2026). This demo reproduces the complete attack chain — from poisoned package installation to cross-platform RAT deployment and forensic self-cleanup — entirely on localhost.

---

## What Happened (TL;DR)

An attacker compromised the npm credentials of the primary Axios maintainer and published two malicious versions (`1.14.1` and `0.30.4`). These versions injected a fake transitive dependency (`plain-crypto-js@4.2.1`) whose only purpose was to run a postinstall script that deployed a cross-platform Remote Access Trojan (RAT). The malware then self-destructed to evade forensic detection.

**83 million weekly downloads. Zero lines of Axios code modified.**

---

## Attack Flow

```
npm install fake-axios
        │
        ▼
npm resolves plain-crypto-js@4.2.1 (malicious transitive dep)
        │
        ▼
postinstall hook fires → setup.js runs
        │
        ├─── macOS  ──→ POST /product0 → AppleScript dropper → C++ RAT binary
        ├─── Windows ──→ POST /product1 → VBScript → PowerShell RAT
        └─── Linux  ──→ POST /product2 → Python RAT (/tmp/ld.py)
        │
        ▼
RAT beacons to C2 every 60s
        │
        ▼
Forensic cleanup:
  - postinstall hook removed from package.json
  - package.json replaced with clean package.md
  - dropper script deleted
```

---

## Repo Structure

```
axios-supply-chain-demo/
├── DISCLAIMER.md
├── README.md
│
├── fake-axios/              # Mimics poisoned axios@1.14.1
│   ├── package.json         # Injects plain-crypto-js as runtime dep
│   └── index.js             # Clean axios-like HTTP stub
│
├── plain-crypto-js/         # The malicious transitive dependency
│   ├── package.json         # postinstall: node setup.js
│   ├── setup.js             # Cross-platform RAT dropper (obfuscated)
│   └── package.md           # Clean manifest used in the swap trick
│
├── payloads/
│   ├── macos.sh             # Simulated AppleScript/binary dropper
│   ├── windows.ps1          # Simulated PowerShell RAT
│   └── linux.py             # Simulated Python RAT
│
├── c2-server/
│   ├── server.js            # Local Express C2 (serves payloads, logs beacons)
│   └── logs/                # Beacon logs written here
│
├── cleanup/
│   └── cleanup.js           # Demonstrates forensic self-deletion + manifest swap
│
├── victim-app/              # A sample app that installs fake-axios
│   └── package.json
│
└── docs/
    ├── attack-flow.md       # Deep technical breakdown
    └── detection.md         # IOCs and how to detect/remediate
```

---

## Running the Demo

### Prerequisites

- Node.js >= 18
- Python 3 (for Linux payload simulation)
- An isolated VM or container (strongly recommended)

### Step 1 — Start the C2 server

```bash
cd c2-server
npm install
node server.js
# Listening on http://localhost:3000
```

### Step 2 — Install the poisoned package

```bash
cd victim-app
npm install
# This triggers the postinstall chain automatically
```

Watch the C2 server terminal — you'll see the beacon check-in appear within seconds.

### Step 3 — Observe the RAT

The platform-appropriate payload will execute and begin logging simulated beacons every 60 seconds to `c2-server/logs/`.

### Step 4 — Run the forensic cleanup

```bash
node cleanup/cleanup.js
# Observe: postinstall hook gone, package.json swapped, setup.js deleted
```

---

## Key Technical Concepts Demonstrated

| Concept | Where |
|---|---|
| Transitive dependency injection | `fake-axios/package.json` |
| npm postinstall abuse | `plain-crypto-js/package.json` |
| Cross-platform OS detection | `plain-crypto-js/setup.js` |
| C2 beacon over HTTP POST | `c2-server/server.js` + payloads |
| Forensic manifest swap | `cleanup/cleanup.js` |
| Self-deletion after execution | `plain-crypto-js/setup.js` |

---

## Detection & IOCs

See [docs/detection.md](./docs/detection.md) for a full list of indicators of compromise and detection strategies.

---

## References

- StepSecurity analysis: https://www.stepsecurity.io
- SafeDep analysis: https://safedep.io
- Socket analysis: https://socket.dev
- Original The Hacker News writeup: https://thehackernews.com
