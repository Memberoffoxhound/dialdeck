#!/usr/bin/env bash
# Complete linger / Tailscale / INSTALL.txt after a hung or interrupted install.
set -euo pipefail
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
TTY="/dev/tty"
cd "$INSTALL_DIR"

log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }
confirm() {
  local a=
  printf "%s [y/N] " "$1" >"$TTY"
  read -r a <"$TTY" || return 1
  [[ "$a" =~ ^[yY]$ ]]
}
need_cmd() { command -v "$1" >/dev/null 2>&1; }

set -a
# shellcheck disable=SC1091
source .env
set +a

# shellcheck disable=SC1091
source scripts/pick-ports.sh
# shellcheck disable=SC1091
source scripts/wait-api.sh

if need_cmd docker && docker compose version >/dev/null 2>&1; then ENGINE=(docker compose)
elif need_cmd podman && podman compose version >/dev/null 2>&1; then ENGINE=(podman compose)
elif need_cmd docker-compose; then ENGINE=(docker-compose)
else ENGINE=(docker-compose)
fi
export PATH="$HOME/.local/bin:$PATH"

wait_for_api || true

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
  systemctl --user enable --now dialdeck.service || true
  if confirm "Enable lingering so Dialdeck stays up in Game Mode?"; then
    loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" || true
  fi
fi

# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/configure-tailscale.sh" || true
set -a; source .env; set +a

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
URL="http://127.0.0.1:${HTTP_PORT}"
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

Create account at the Share URL. First account is owner.
Uninstall:  ${INSTALL_DIR}/scripts/uninstall.sh
EOF

log "Done"
cat "$INSTALL_DIR/INSTALL.txt"
