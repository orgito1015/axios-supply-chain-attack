# Detection & Indicators of Compromise (IOCs)

## Affected Versions

| Package | Malicious Version | Safe Version |
|---|---|---|
| axios | 1.14.1 | 1.14.0 |
| axios | 0.30.4 | 0.30.3 |
| plain-crypto-js | 4.2.1 | Do not use |
| @shadanai/openclaw | 2026.3.28-2, 2026.3.28-3, 2026.3.31-1, 2026.3.31-2 | Avoid entirely |
| @qqbrowser/openclaw-qbot | 0.0.130 | Avoid entirely |

## File System IOCs

### macOS
- `/Library/Caches/com.apple.act.mond` — RAT binary disguised as Apple cache file
- `/tmp/com.apple.setup.scpt` — AppleScript dropper (may be deleted already)

### Windows
- `%PROGRAMDATA%\wt.exe` — PowerShell binary disguised as Windows Terminal
- `%TEMP%\update_*.vbs` — VBScript dropper (transient, may be deleted)

### Linux
- `/tmp/ld.py` — Python RAT

## Network IOCs

| Indicator | Type | Description |
|---|---|---|
| `sfrclak.com` | Domain | Primary C2 domain |
| `sfrclak[.]com:8000` | Host:Port | macOS binary delivery |
| `packages.npm.org/product0` | URL path | macOS C2 endpoint |
| `packages.npm.org/product1` | URL path | Windows C2 endpoint |
| `packages.npm.org/product2` | URL path | Linux C2 endpoint |

**Note:** `packages.npm.org` is the attacker's domain disguised to look like a legitimate npm URL. It is **not** affiliated with npm.

## npm Account IOCs

| Indicator | Detail |
|---|---|
| Compromised account | `jasonsaayman` |
| Attacker email | `ifstap@proton.me` |
| Malicious publisher | `nrwise` (npm user) |
| Attacker email 2 | `nrwise@proton.me` |

## Detection Steps

### 1 — Check installed Axios version

```bash
npm list axios
# or
cat node_modules/axios/package.json | grep '"version"'
```

If you see `1.14.1` or `0.30.4`, you are affected.

### 2 — Check for plain-crypto-js

```bash
ls node_modules/plain-crypto-js 2>/dev/null && echo "FOUND — investigate"
```

### 3 — Check for RAT artifacts

**macOS:**
```bash
ls -la /Library/Caches/com.apple.act.mond 2>/dev/null && echo "RAT FOUND"
```

**Windows (PowerShell):**
```powershell
Test-Path "$env:PROGRAMDATA\wt.exe" && Write-Host "RAT FOUND"
```

**Linux:**
```bash
ls -la /tmp/ld.py 2>/dev/null && echo "RAT FOUND"
```

### 4 — Check for C2 network connections

```bash
# macOS / Linux
lsof -i | grep sfrclak
netstat -an | grep sfrclak

# Check DNS cache for C2 domain
# macOS
dscacheutil -cachedump -entries Host | grep sfrclak
```

### 5 — Audit CI/CD pipeline

Review your GitHub Actions / CI logs for any runs that executed `npm install` during the window:
- **March 31, 2026 00:21 UTC** to when the packages were unpublished

If any CI run installed the affected versions, treat the CI runner's secrets as compromised.

### 6 — Block C2 domain

**Firewall / hosts file:**
```
# /etc/hosts
0.0.0.0 sfrclak.com
```

**Corporate DNS block:** Add `sfrclak.com` to your DNS blocklist immediately.

## Remediation Steps

1. Downgrade Axios: `npm install axios@1.14.0`
2. Remove plain-crypto-js: `rm -rf node_modules/plain-crypto-js`
3. Regenerate your lockfile: `npm install`
4. If RAT artifacts found: **assume full compromise**
   - Rotate ALL secrets, tokens, API keys on the affected machine
   - Rotate CI/CD secrets (GitHub Actions, npm tokens, cloud provider credentials)
   - Revoke and regenerate SSH keys
   - Check `~/.aws`, `~/.npmrc`, `~/.ssh` for unauthorized access
   - Review cloud provider audit logs for unauthorized API calls
5. Report to your security team and begin incident response

## Preventive Controls

| Control | How It Helps |
|---|---|
| `npm audit` + lockfile pinning | Catches known malicious packages |
| Socket / StepSecurity / Snyk | Flags postinstall scripts in transitive deps |
| `--ignore-scripts` flag | Prevents postinstall hooks from running at all |
| npm provenance attestation | Verifies packages were built by expected CI |
| Scoped npm tokens | Limits blast radius of credential compromise |
| TOTP / passkey on npm accounts | Prevents account takeover via stolen token |
| Egress firewall rules | Blocks unexpected outbound connections during install |
| Renovate / Dependabot PRs | Shows dependency diffs in PRs before merging |

### Recommended: disable postinstall scripts in CI

Add to your `.npmrc`:
```
ignore-scripts=true
```

Or per-install:
```bash
npm install --ignore-scripts
```

This breaks some packages that legitimately use postinstall (e.g. esbuild, node-sass) but eliminates an entire class of supply chain attack vector.
