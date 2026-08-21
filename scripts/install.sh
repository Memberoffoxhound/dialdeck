#!/usr/bin/env bash
# Dialdeck host installer — Bazzite / SteamOS / any Linux with Docker or Podman.
set -euo pipefail

REPO_URL="${DIALDECK_REPO:-https://github.com/Memberoffoxhound/dialdeck.git}"
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
HTTP_PORT="${DIALDECK_HTTP_PORT:-8080}"
HTTPS_PORT="${DIALDECK_HTTPS_PORT:-8443}"

log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }
die() { printf "\033[1;31mxx\033[0m %s\n" "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

pick_engine() {
  if need_cmd docker && docker compose version >/dev/null 2>&1; then
    ENGINE=(docker compose)
  elif need_cmd docker && need_cmd docker-compose; then
    ENGINE=(docker-compose)
  elif need_cmd podman && podman compose version >/dev/null 2>&1; then
    ENGINE=(podman compose)
  elif need_cmd podman-compose; then
    ENGINE=(podman-compose)
  else
    return 1
  fi
}

log "Dialdeck installer"

if ! pick_engine; then
  if need_cmd ujust; then
    warn "No Docker/Podman compose on PATH."
    warn "On Bazzite: open Bazzite Portal and enable Docker, or rebase to bazzite-dx,"
    warn "or install Podman compose:  rpm-ostree install podman-compose  (then reboot)."
    warn "Podman itself is usually already present — try:  podman compose version"
  else
    warn "Install Docker Engine + compose plugin, or Podman + podman compose."
  fi
  die "container engine not ready"
fi
log "Using: ${ENGINE[*]}"

need_cmd git || die "git is required (Bazzite has it)"
need_cmd openssl || die "openssl is required"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only || warn "could not fast-forward; using existing tree"
else
  log "Cloning into $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

if [[ ! -f .env ]]; then
  log "Generating secrets and invite code"
  INVITE=$(openssl rand -hex 3)
  cat > .env <<EOF
DOMAIN=localhost
PUBLIC_URL=http://localhost:${HTTP_PORT}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}

POSTGRES_USER=dialdeck
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=dialdeck

REDIS_PASSWORD=$(openssl rand -hex 16)

MINIO_ROOT_USER=dialdeck
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)

LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=$(openssl rand -hex 24)
LIVEKIT_WS_URL=ws://localhost:${HTTP_PORT}/rtc

JWT_SECRET=$(openssl rand -hex 32)
INVITE_CODE=${INVITE}
REGISTRATION_OPEN=true
REACHABILITY_MODE=local
EOF
else
  log "Keeping existing .env"
fi

# shellcheck disable=SC1091
set -a; source .env; set +a
INVITE_CODE="${INVITE_CODE:-$(openssl rand -hex 3)}"

log "Writing LiveKit keys"
cat > deploy/livekit.yaml <<EOF
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: false
  enable_loopback_candidate: true
keys:
  ${LIVEKIT_API_KEY:-devkey}: ${LIVEKIT_API_SECRET}
logging:
  level: info
room:
  enabled_codecs:
    - mime: audio/opus
    - mime: video/vp8
    - mime: video/vp9
    - mime: video/h264
    - mime: video/av1
EOF

log "Starting stack"
"${ENGINE[@]}" -f docker-compose.yml up -d --build

log "Waiting for API"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null; then
    break
  fi
  sleep 2
  [[ "$i" -eq 60 ]] && warn "API did not become healthy in 120s — check: ${ENGINE[*]} -f docker-compose.yml logs"
done

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/dialdeck.service" <<EOF
[Unit]
Description=Dialdeck party line
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/scripts/start.sh
ExecStop=${INSTALL_DIR}/scripts/stop.sh

[Install]
WantedBy=default.target
EOF

if need_cmd systemctl; then
  systemctl --user daemon-reload || true
  systemctl --user enable --now dialdeck.service || warn "could not enable user service (ok if no systemd --user)"
  loginctl enable-linger "$USER" >/dev/null 2>&1 || true
fi

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
URL="http://localhost:${HTTP_PORT}"
LAN_URL="http://${LAN_IP:-<lan-ip>}:${HTTP_PORT}"

cat > "$INSTALL_DIR/INSTALL.txt" <<EOF
Dialdeck is up.

This machine:  ${URL}
On your LAN:   ${LAN_URL}
Invite code:   ${INVITE_CODE}

Friends open that URL, tap Create account, enter the invite code, pick a handle.
First account on this server is the owner (ban / kick / mute / rooms).

Keep this box running (Desktop Mode / linger). Game Mode must not kill the containers.
Reachability for off-LAN: Tailscale, then set PUBLIC_URL to the MagicDNS name.
Uninstall:  ${INSTALL_DIR}/scripts/uninstall.sh
EOF

log "Done"
cat "$INSTALL_DIR/INSTALL.txt"

if [[ -d "$HOME/homebrew/plugins" ]]; then
  log "Decky Loader detected — copying plugin sources"
  mkdir -p "$HOME/homebrew/plugins/dialdeck"
  cp -a "$INSTALL_DIR/apps/decky/." "$HOME/homebrew/plugins/dialdeck/"
  warn "Build the plugin on a machine with pnpm (cd apps/decky && pnpm i && pnpm build)"
  warn "or reload after copying a release zip that includes dist/index.js"
fi
