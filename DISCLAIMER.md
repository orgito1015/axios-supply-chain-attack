# DISCLAIMER - READ BEFORE USING

This repository is a **fully sandboxed, educational reconstruction** of the Axios npm supply chain attack that occurred on March 31, 2026.

## Purpose

This project exists solely for:
- Security research and education
- Helping developers understand how supply chain attacks work
- Enabling defenders to build better detection tools
- CTF and lab environments

## What This Is NOT

- This is **not** a ready-to-deploy attack tool
- It does **not** connect to any real C2 server
- It does **not** exfiltrate any real data
- It does **not** establish real persistence on any system

## Rules of Use

- **Only run this in an isolated VM or sandboxed environment**
- **Never deploy any component of this repo against real systems or users**
- **Never publish the fake packages to a real npm registry**
- Using this against real targets is illegal under the Computer Fraud and Abuse Act (CFAA), the UK Computer Misuse Act, and equivalent laws in most jurisdictions

## How Safety is Enforced in This Demo

- All C2 communication goes to `localhost:3000` only
- Payloads log actions instead of executing destructive commands
- No real credentials, secrets, or files are touched
- Every destructive action is wrapped in a `DRY_RUN` guard

## Credits

Based on public analysis by:
- [StepSecurity](https://www.stepsecurity.io)
- [SafeDep](https://safedep.io)
- [Socket](https://socket.dev)

**The authors of this repo condemn malicious use of these techniques.**
