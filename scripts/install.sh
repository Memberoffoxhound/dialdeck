#!/usr/bin/env bash
# Dialdeck one-stop installer for Bazzite / SteamOS / Linux.
set -euo pipefail

REPO_URL="${DIALDECK_REPO:-https://github.com/Memberoffoxhound/dialdeck.git}"
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
HTTP_PORT="${DIALDECK_HTTP_PORT:-8080}"
HTTPS_PORT="${DIALDECK_HTTPS_PORT:-8443}"
TTY="/dev/tty"

log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }
die() { printf "\033[1;31mxx\033[0m %s\n" "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

confirm() {
  local a=
  if [[ ! -e "$TTY" ]]; then
    [[ "${DIALDECK_YES:-}" == "1" ]] && return 0
    return 1
  fi
  printf "%s [y/N] " "$1" >"$TTY"
  read -r a <"$TTY" || return 1
  [[ "$a" =~ ^[yY]$ ]]
}

pick_engine() {
  if need_cmd docker && docker compose version >/dev/null 2>&1; then ENGINE=(docker compose); return 0; fi
  if need_cmd docker && need_cmd docker-compose; then ENGINE=(docker-compose); return 0; fi
  if need_cmd podman && podman compose version >/dev/null 2>&1; then ENGINE=(podman compose); return 0; fi
  if need_cmd podman-compose; then ENGINE=(podman-compose); return 0; fi
  return 1
}

install_compose_plugin() {
  mkdir -p "$HOME/.local/bin"
  local bin="$HOME/.local/bin/docker-compose"
  if [[ ! -x "$bin" ]]; then
    log "Downloading Docker Compose v2 plugin to ~/.local/bin"
    curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o "$bin"
    chmod +x "$bin"
  fi
  export PATH="$HOME/.local/bin:$PATH"
}

ensure_engine() {
  pick_engine && return 0
  if need_cmd podman; then
    if confirm "Download docker-compose into ~/.local/bin and use Podman?"; then
      install_compose_plugin
      ENGINE=(podman compose)
      return 0
    fi
  fi
  die "No container engine."
}

open_fw() {
  local spec="$1"
  if need_cmd firewall-cmd; then sudo firewall-cmd --permanent --add-port="$spec" || true
  elif need_cmd ufw; then sudo ufw allow "$spec" || true
  fi
}

log "Dialdeck one-stop installer"
need_cmd curl || die "curl is required"
need_cmd git || die "git is required"
need_cmd openssl || die "openssl is required"
ensure_engine
log "Using: ${ENGINE[*]}"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch origin main && git -C "$INSTALL_DIR" reset --hard origin/main || true
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
chmod +x scripts/*.sh

if confirm "Clear all user data (handles, chat, bans, uploads) and start over?"; then
  "${ENGINE[@]}" -f docker-compose.yml down -v || true
  rm -rf "$INSTALL_DIR/data"
fi

if [[ ! -f .env ]]; then
  log "Generating secrets"
  cat > .env <<EOF
DOMAIN=localhost
PUBLIC_URL=https://localhost:${HTTPS_PORT}
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
LIVEKIT_WS_URL=wss://localhost:${HTTPS_PORT}
JWT_SECRET=$(openssl rand -hex 32)
INVITE_CODE=$(openssl rand -hex 3)
REGISTRATION_OPEN=true
REACHABILITY_MODE=public
VIDEO_MIN=480p
VIDEO_MAX=1080p
VIDEO_FPS=60
VIDEO_MODE=vbr-auto
EOF
else
  grep -qE '^HTTPS_PORT=' .env || echo "HTTPS_PORT=${HTTPS_PORT}" >> .env
fi

set -a; source .env; set +a
HTTPS_PORT="${HTTPS_PORT:-8443}"

# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/pick-ports.sh"
choose_ports
set -a; source .env; set +a

log "TLS certificates"
bash scripts/make-tls.sh

log "LiveKit WAN config"
bash scripts/write-livekit.sh || true

log "Host firewall (sudo) for HTTP/HTTPS/WebRTC"
open_fw "${HTTP_PORT}/tcp"
open_fw "${HTTPS_PORT}/tcp"
open_fw 443/tcp
open_fw 7880/tcp
open_fw 7881/tcp
open_fw 7882/udp
open_fw 3478/udp
open_fw 3478/tcp
need_cmd firewall-cmd && sudo firewall-cmd --reload || true

started=0
for attempt in 1 2 3 4; do
  log "Starting stack HTTP :${HTTP_PORT}  HTTPS :${HTTPS_PORT} (attempt ${attempt})"
  if "${ENGINE[@]}" -f docker-compose.yml up -d --build; then
    started=1
    break
  fi
  warn "Bind failed on :${HTTP_PORT} — next port"
  force_next_http
  set -a; source .env; set +a
done
[[ "$started" -eq 1 ]] || die "Could not publish Caddy"

# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/wait-api.sh"
wait_for_api || true

log "Waiting for HTTPS :${HTTPS_PORT}"
https_ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -skf --connect-timeout 1 --max-time 2 "https://127.0.0.1:${HTTPS_PORT}/api/health" >/dev/null; then
    https_ok=1
    break
  fi
  sleep 1
done
if [[ "$https_ok" -eq 1 ]]; then
  log "HTTPS listening on :${HTTPS_PORT}"
else
  warn "HTTPS not answering yet — recreating Caddy"
  "${ENGINE[@]}" -f docker-compose.yml up -d --force-recreate --no-deps caddy || true
  sleep 3
  if curl -skf --connect-timeout 1 --max-time 2 "https://127.0.0.1:${HTTPS_PORT}/api/health" >/dev/null; then
    https_ok=1
    log "HTTPS listening on :${HTTPS_PORT}"
  else
    warn "HTTPS still down. ss / caddy logs:"
    ss -ltn | grep -E ":${HTTPS_PORT}|:443|:8088|:8090" || true
    "${ENGINE[@]}" -f docker-compose.yml logs --tail=25 caddy || true
  fi
fi

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/dialdeck.service" <<EOF
[Unit]
Description=Dialdeck party line
After=network-online.target
[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=HOME=%h
ExecStart=${INSTALL_DIR}/scripts/watch.sh
Restart=always
RestartSec=8
[Install]
WantedBy=default.target
EOF

if need_cmd systemctl; then
  systemctl --user daemon-reload || true
  systemctl --user enable --now dialdeck.service || true
  if confirm "Enable lingering so Dialdeck stays up in Game Mode?"; then
    loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" || true
  fi
fi

WAN_IP=$(curl -4 -fsS --max-time 8 https://api.ipify.org || true)
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
HTTPS_LOCAL="https://127.0.0.1:${HTTPS_PORT}"
HTTPS_LAN="https://${LAN_IP:-<lan>}:${HTTPS_PORT}"
HTTPS_WAN="https://${WAN_IP:-<wan>}:${HTTPS_PORT}"
HTTP_LOCAL="http://127.0.0.1:${HTTP_PORT}"

cat > "$INSTALL_DIR/INSTALL.txt" <<EOF
Dialdeck is up.

HTTP  (chat / localhost media):  ${HTTP_LOCAL}
HTTPS (voice + video + internet): ${HTTPS_LOCAL}
      LAN:  ${HTTPS_LAN}
      WAN:  ${HTTPS_WAN}

HTTPS listening: $([[ "$https_ok" -eq 1 ]] && echo YES || echo NO)
Video: VBR auto 480p-1080p60

Friends: open the WAN HTTPS URL, accept the Firefox cert warning, type a name.
Router forwards: ${HTTP_PORT}/tcp, ${HTTPS_PORT}/tcp, 443/tcp, 7880/tcp, 7881/tcp, 7882/udp, 3478/tcp+udp, 30000-30020/udp

Game Mode: systemctl --user status dialdeck
Uninstall: ${INSTALL_DIR}/scripts/uninstall.sh
EOF

log "Listeners"
ss -ltn | grep -E ":${HTTP_PORT}|:${HTTPS_PORT}|:443|:7880" || true
log "Done"
cat "$INSTALL_DIR/INSTALL.txt"

set +e
# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/install-decky.sh"
install_decky_plugin
