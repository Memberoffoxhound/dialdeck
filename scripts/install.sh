#!/usr/bin/env bash
# Dialdeck one-stop installer for Bazzite / SteamOS / Linux.
# Prompts on /dev/tty so `curl | bash` can still ask for permission.
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
  if need_cmd docker && docker compose version >/dev/null 2>&1; then
    ENGINE=(docker compose)
    return 0
  fi
  if need_cmd docker && need_cmd docker-compose; then
    ENGINE=(docker-compose)
    return 0
  fi
  if need_cmd podman && podman compose version >/dev/null 2>&1; then
    ENGINE=(podman compose)
    return 0
  fi
  if need_cmd podman-compose; then
    ENGINE=(podman-compose)
    return 0
  fi
  return 1
}

install_compose_plugin() {
  mkdir -p "$HOME/.local/bin"
  local bin="$HOME/.local/bin/docker-compose"
  if [[ ! -x "$bin" ]]; then
    log "Downloading Docker Compose v2 plugin to ~/.local/bin (no root)"
    curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o "$bin"
    chmod +x "$bin"
  fi
  export PATH="$HOME/.local/bin:$PATH"
}

ensure_engine() {
  if pick_engine; then
    return 0
  fi

  if need_cmd podman; then
    log "Podman is installed. Adding a user-space compose binary so we do not have to rebase the OS."
    if confirm "Download docker-compose into ~/.local/bin and use Podman?"; then
      install_compose_plugin
      if podman compose version >/dev/null 2>&1; then
        ENGINE=(podman compose)
        return 0
      fi
      systemctl --user enable --now podman.socket 2>/dev/null || true
      ENGINE=(podman compose)
      podman compose version >/dev/null 2>&1 && return 0
    fi
  fi

  if need_cmd ujust; then
    local recipe=""
    if ujust --dump 2>/dev/null | grep -qE '^setup-docker'; then
      recipe="setup-docker"
    elif ujust --dump 2>/dev/null | grep -qE '^install-docker'; then
      recipe="install-docker"
    fi
    if [[ -n "$recipe" ]]; then
      if confirm "Run 'ujust $recipe'? This may layer packages and can ask for your password / a reboot."; then
        ujust "$recipe" || warn "ujust $recipe failed"
        pick_engine && return 0
      fi
    fi
  fi

  if need_cmd rpm-ostree; then
    if confirm "Layer moby-engine + docker-compose with rpm-ostree? Needs sudo and a reboot."; then
      sudo rpm-ostree install -y moby-engine docker-compose || sudo rpm-ostree install -y docker docker-compose || true
      warn "Reboot, then run this installer again."
      exit 0
    fi
  elif need_cmd apt-get || need_cmd dnf; then
    if confirm "Install Docker Engine with your package manager (sudo)?"; then
      curl -fsSL https://get.docker.com | sudo sh
      sudo usermod -aG docker "$USER" || true
      sudo systemctl enable --now docker
      pick_engine && return 0
    fi
  fi

  die "No container engine. Install Docker or Podman, then re-run."
}

log "Dialdeck one-stop installer"
need_cmd curl || die "curl is required"
need_cmd git || die "git is required"
need_cmd openssl || die "openssl is required"

ensure_engine
log "Using: ${ENGINE[*]}"

if need_cmd docker && ! id -nG 2>/dev/null | grep -qw docker && [[ "${EUID:-1}" -ne 0 ]]; then
  if confirm "Add $USER to the docker group (sudo)?"; then
    sudo usermod -aG docker "$USER"
    warn "Group change applies to new logins."
  fi
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch origin main && git -C "$INSTALL_DIR" reset --hard origin/main || git -C "$INSTALL_DIR" pull --ff-only || warn "using existing tree"
else
  log "Cloning into $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
chmod +x scripts/*.sh

if [[ ! -f .env ]]; then
  log "Generating secrets, invite code, and 1080p60 VBR media policy"
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

VIDEO_MIN=480p
VIDEO_MAX=1080p
VIDEO_FPS=60
VIDEO_MODE=vbr-auto
EOF
else
  log "Keeping existing .env"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a
INVITE_CODE="${INVITE_CODE:-$(openssl rand -hex 3)}"

# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/pick-ports.sh"
choose_ports
set -a
# shellcheck disable=SC1091
source .env
set +a

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

started=0
for attempt in 1 2 3 4; do
  log "Starting stack on :${HTTP_PORT} (attempt ${attempt})"
  if "${ENGINE[@]}" -f docker-compose.yml up -d --build; then
    started=1
    break
  fi
  warn "Bind failed on :${HTTP_PORT} — moving to the next port"
  force_next_http
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
done
[[ "$started" -eq 1 ]] || die "Could not publish Caddy on a free port"

log "Waiting for API"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 60 ]]; then
    warn "API did not become healthy in 120s — ${ENGINE[*]} -f docker-compose.yml logs"
  fi
done

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/dialdeck.service" <<EOF
[Unit]
Description=Dialdeck party line (survives Game Mode via linger)
After=network-online.target
Wants=network-online.target

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
  systemctl --user enable --now dialdeck.service || warn "could not enable user service"
  if confirm "Enable lingering so Dialdeck starts at boot and stays up in Game Mode (loginctl)?"; then
    if ! loginctl enable-linger "$USER"; then
      sudo loginctl enable-linger "$USER" || warn "could not enable linger"
    fi
  else
    warn "Without linger, Game Mode / reboot may stop the stack until you open Desktop Mode."
  fi
fi

# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/configure-tailscale.sh" || warn "Tailscale step skipped or failed"
set -a
# shellcheck disable=SC1091
source "$INSTALL_DIR/.env"
set +a

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
URL="http://localhost:${HTTP_PORT}"
LAN_URL="http://${LAN_IP:-<lan-ip>}:${HTTP_PORT}"
SHARE_URL="${PUBLIC_URL:-$LAN_URL}"

cat > "$INSTALL_DIR/INSTALL.txt" <<EOF
Dialdeck is up.

This machine:  ${URL}
On your LAN:   ${LAN_URL}
Share URL:     ${SHARE_URL}
Invite code:   ${INVITE_CODE}
Video:         VBR auto 480p–1080p60
Reachability:  ${REACHABILITY_MODE:-local}

You: open the Share URL, Create account, enter the invite. First account is owner.
Family on LAN: same LAN URL.
Family off-LAN: install Tailscale, join this tailnet, open the Share URL.

Game Mode: systemctl --user status dialdeck
Uninstall:  ${INSTALL_DIR}/scripts/uninstall.sh
EOF

log "Done"
cat "$INSTALL_DIR/INSTALL.txt"

if [[ -d "$HOME/homebrew/plugins" ]]; then
  log "Decky Loader detected — installing plugin files"
  mkdir -p "$HOME/homebrew/plugins/dialdeck"
  cp -a "$INSTALL_DIR/apps/decky/." "$HOME/homebrew/plugins/dialdeck/"
  if need_cmd pnpm; then
    (cd "$HOME/homebrew/plugins/dialdeck" && pnpm i && pnpm build) || warn "plugin build failed"
  else
    warn "pnpm not found — QAM stats need: cd ~/homebrew/plugins/dialdeck && pnpm i && pnpm build"
  fi
fi
