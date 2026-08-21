#!/usr/bin/env bash
# Optional off-LAN setup. LAN testing does not need this.
# Run only when DIALDECK_TAILSCALE=1 or this file is executed directly.
set -euo pipefail

TTY="${TTY:-/dev/tty}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/dialdeck}"
HTTP_PORT="${HTTP_PORT:-8080}"

if ! declare -f confirm >/dev/null; then
  confirm() {
    local a=
    printf "%s [y/N] " "$1" >"$TTY"
    read -r a <"$TTY" || return 1
    [[ "$a" =~ ^[yY]$ ]]
  }
fi
if ! declare -f log >/dev/null; then log() { echo "==> $*"; }; fi
if ! declare -f warn >/dev/null; then warn() { echo "!! $*"; }; fi
need_cmd() { command -v "$1" >/dev/null 2>&1; }

# Sourced from install: skip unless they opted in.
if [[ "${BASH_SOURCE[0]}" != "$0" && "${DIALDECK_TAILSCALE:-}" != "1" ]]; then
  log "LAN only — skipping Tailscale. Later: DIALDECK_TAILSCALE=1 $INSTALL_DIR/scripts/configure-tailscale.sh"
  return 0
fi

if [[ "${DIALDECK_TAILSCALE:-}" != "1" ]]; then
  if ! confirm "Set up Tailscale for access outside the house? (not needed on LAN)"; then
    log "Skipping Tailscale."
    return 0 2>/dev/null || exit 0
  fi
fi

tailscale_dns() {
  if need_cmd python3 && tailscale status --json >/dev/null 2>&1; then
    tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("Self",{}).get("DNSName","").rstrip("."))'
    return
  fi
  tailscale status --json 2>/dev/null | tr ',' '\n' | sed -n 's/.*"DNSName":"\([^"]*\).*/\1/p' | head -1 | tr -d '.'
}

if need_cmd ujust; then
  ujust enable-tailscale || true
fi

if ! need_cmd tailscale; then
  curl -fsSL https://tailscale.com/install.sh | sudo sh
fi

sudo systemctl enable --now tailscaled 2>/dev/null || true
log "Open the login URL, sign in, approve this machine."
sudo tailscale up --operator="$USER" --accept-dns=true || tailscale up --accept-dns=true

for i in $(seq 1 24); do
  if tailscale ip -4 >/dev/null 2>&1; then break; fi
  sleep 5
done

TS_IP=$(tailscale ip -4 | head -1)
TS_DNS=$(tailscale_dns)
PUBLIC="http://${TS_IP}:${HTTP_PORT}"
if [[ -n "$TS_DNS" ]]; then
  tailscale serve --bg "${HTTP_PORT}" 2>/dev/null || sudo tailscale serve --bg "${HTTP_PORT}" || true
  PUBLIC="https://${TS_DNS}"
fi

if [[ -f "$INSTALL_DIR/.env" ]]; then
  tmp=$(mktemp)
  grep -vE '^(PUBLIC_URL|REACHABILITY_MODE|LIVEKIT_WS_URL)=' "$INSTALL_DIR/.env" >"$tmp" || true
  {
    echo "PUBLIC_URL=${PUBLIC}"
    echo "REACHABILITY_MODE=tailscale"
    if [[ "$PUBLIC" == https://* ]]; then echo "LIVEKIT_WS_URL=wss://${PUBLIC#https://}/rtc"
    else echo "LIVEKIT_WS_URL=ws://${PUBLIC#http://}/rtc"; fi
  } >>"$tmp"
  mv "$tmp" "$INSTALL_DIR/.env"
fi

export PUBLIC_URL="$PUBLIC" REACHABILITY_MODE=tailscale
log "Share URL: $PUBLIC"
