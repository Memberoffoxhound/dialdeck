#!/usr/bin/env bash
# Keep Dialdeck reachable from the internet while the stack is running.
set -euo pipefail
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
cd "$INSTALL_DIR"
export PATH="$HOME/.local/bin:$PATH"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
HTTP_PORT="${HTTP_PORT:-8090}"

WAN_IP=$(curl -4 -fsS --max-time 8 https://api.ipify.org || curl -4 -fsS --max-time 8 https://ifconfig.me || true)
WAN_IP="${DIALDECK_WAN_IP:-$WAN_IP}"
if [[ -z "$WAN_IP" ]]; then
  echo "Could not detect public IP. DIALDECK_WAN_IP=x.x.x.x bash scripts/open-wan.sh"
  exit 1
fi
export WAN_IP
PUBLIC_URL="http://${WAN_IP}:${HTTP_PORT}"

tmp=$(mktemp)
grep -vE '^(PUBLIC_URL|REACHABILITY_MODE|LIVEKIT_WS_URL)=' .env >"$tmp" || true
{
  echo "PUBLIC_URL=${PUBLIC_URL}"
  echo "REACHABILITY_MODE=public"
  echo "LIVEKIT_WS_URL=ws://${WAN_IP}:7880"
} >>"$tmp"
mv "$tmp" .env

bash scripts/write-livekit.sh

open_port() {
  local spec="$1"
  if command -v firewall-cmd >/dev/null; then
    sudo firewall-cmd --permanent --add-port="$spec" || true
  elif command -v ufw >/dev/null; then
    sudo ufw allow "$spec" || true
  fi
}
open_port "${HTTP_PORT}/tcp"
open_port 7880/tcp
open_port 7881/tcp
open_port 7882/udp
open_port 3478/udp
open_port 3478/tcp
open_port 30000-30020/udp
if command -v firewall-cmd >/dev/null; then
  sudo firewall-cmd --reload || true
fi

loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" || true
systemctl --user enable --now dialdeck.service 2>/dev/null || true

if command -v docker-compose >/dev/null || docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
  docker compose version >/dev/null 2>&1 && COMPOSE=(docker compose)
  "${COMPOSE[@]}" -f docker-compose.yml up -d --force-recreate livekit || true
fi

cat > INSTALL.txt <<EOF
Dialdeck stays on the public internet while this machine is running.

Share:  ${PUBLIC_URL}

Router forwards to this box:
  ${HTTP_PORT}/tcp   PWA
  7880/tcp          signaling
  7881/tcp          ICE TCP
  7882/udp          media
  3478/udp+tcp      TURN
  30000-30020/udp   TURN relay

Linger is on so Game Mode / reboot keep the user service.
EOF
cat INSTALL.txt
