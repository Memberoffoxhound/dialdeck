#!/usr/bin/env bash
# Enable Tailscale and walk the operator through login + Serve.
# Sourced or executed from install.sh. Expects confirm/log/warn/need_cmd/TTY.
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

tailscale_dns() {
  if need_cmd python3 && tailscale status --json >/dev/null 2>&1; then
    tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("Self",{}).get("DNSName","").rstrip("."))'
    return
  fi
  tailscale status --json 2>/dev/null | tr ',' '\n' | sed -n 's/.*"DNSName":"\([^"]*\).*/\1/p' | head -1 | tr -d '.'
}

log "Off-LAN access uses Tailscale so you do not open router ports."
log "Everyone who should join (phones, PCs) installs the Tailscale app and logs into the SAME tailnet."

if ! confirm "Set up Tailscale now so family can reach Dialdeck from outside the house?"; then
  warn "Skipping Tailscale. LAN URL only. Re-run: $INSTALL_DIR/scripts/configure-tailscale.sh"
  return 0 2>/dev/null || exit 0
fi

if need_cmd ujust; then
  if confirm "Enable Tailscale with ujust (Bazzite already ships it; needs sudo)?"; then
    ujust enable-tailscale || ujust toggle-tailscale || true
  fi
fi

if ! need_cmd tailscale; then
  if confirm "Tailscale CLI not on PATH. Install with the official script (sudo)?"; then
    curl -fsSL https://tailscale.com/install.sh | sudo sh
  else
    warn "Install Tailscale from Bazzite Portal (Enable Tailscale), then re-run this script."
    return 1 2>/dev/null || exit 1
  fi
fi

sudo systemctl enable --now tailscaled 2>/dev/null || true

log "Next: a login URL. Open it in a browser, sign in, and approve this machine."
log "Use the same Tailscale account (or a family tailnet) that phones will join."
if confirm "Run 'sudo tailscale up --operator=$USER' now?"; then
  sudo tailscale up --operator="$USER" --accept-dns=true || tailscale up --accept-dns=true
fi

log "Waiting for this machine to appear on the tailnet (up to ~2 minutes)"
for i in $(seq 1 24); do
  if tailscale status >/dev/null 2>&1 && tailscale ip -4 >/dev/null 2>&1; then
    break
  fi
  sleep 5
  if [[ "$i" -eq 24 ]]; then
    warn "Not logged in yet. Finish the URL, then re-run this script."
    return 1 2>/dev/null || exit 1
  fi
done

TS_IP=$(tailscale ip -4 | head -1)
TS_DNS=$(tailscale_dns)
[[ -z "$TS_DNS" ]] && TS_DNS=""

PUBLIC="http://${TS_IP}:${HTTP_PORT}"
REACH="tailscale"

if confirm "Serve Dialdeck as HTTPS on your tailnet (tailscale serve --bg ${HTTP_PORT})? Recommended."; then
  tailscale serve --bg "${HTTP_PORT}" || sudo tailscale serve --bg "${HTTP_PORT}" || warn "serve failed — using tailnet IP:port"
  if [[ -n "$TS_DNS" ]]; then
    PUBLIC="https://${TS_DNS}"
  fi
fi

log "Tailnet IP:  $TS_IP"
[[ -n "$TS_DNS" ]] && log "MagicDNS:   $TS_DNS"
log "Share URL:  $PUBLIC"

if [[ -f "$INSTALL_DIR/.env" ]]; then
  tmp=$(mktemp)
  grep -vE '^(PUBLIC_URL|REACHABILITY_MODE|LIVEKIT_WS_URL)=' "$INSTALL_DIR/.env" >"$tmp" || true
  {
    echo "PUBLIC_URL=${PUBLIC}"
    echo "REACHABILITY_MODE=tailscale"
    echo "LIVEKIT_WS_URL=${PUBLIC/https:/wss:}"
    echo "LIVEKIT_WS_URL=${PUBLIC/http:/ws:}"
  } >>"$tmp"
  # last LIVEKIT wins if both rewritten — keep a single line
  awk '
    /^LIVEKIT_WS_URL=/ { v=$0; next }
    { print }
    END { if (v) print v }
  ' "$tmp" >"$INSTALL_DIR/.env"
  rm -f "$tmp"
  # Prefer wss when PUBLIC is https
  if [[ "$PUBLIC" == https://* ]]; then
    sed -i 's|^LIVEKIT_WS_URL=ws:|LIVEKIT_WS_URL=wss:|' "$INSTALL_DIR/.env" || true
  fi
fi

{
  echo ""
  echo "Tailscale"
  echo "Tailnet IP:    $TS_IP"
  echo "Share URL:     $PUBLIC"
  echo "Family: install Tailscale on each phone/PC, log into this tailnet, open the Share URL."
} >>"$INSTALL_DIR/INSTALL.txt"

export PUBLIC_URL="$PUBLIC"
export REACHABILITY_MODE=tailscale
