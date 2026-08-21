#!/usr/bin/env bash
# Point Dialdeck at your public IP and open the host firewall.
# Router must already forward 8090/tcp, 7880/tcp, 7881/tcp, 7882/udp here.
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
WAN_IP="${WAN_IP:-}"
if [[ -z "$WAN_IP" ]]; then
  echo "Could not detect public IP. Set it:  DIALDECK_WAN_IP=x.x.x.x bash scripts/open-wan.sh"
  exit 1
fi
WAN_IP="${DIALDECK_WAN_IP:-$WAN_IP}"
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

if command -v firewall-cmd >/dev/null; then
  sudo firewall-cmd --permanent --add-port="${HTTP_PORT}/tcp" || true
  sudo firewall-cmd --permanent --add-port=7880/tcp || true
  sudo firewall-cmd --permanent --add-port=7881/tcp || true
  sudo firewall-cmd --permanent --add-port=7882/udp || true
  sudo firewall-cmd --reload || true
elif command -v ufw >/dev/null; then
  sudo ufw allow "${HTTP_PORT}/tcp" || true
  sudo ufw allow 7880/tcp || true
  sudo ufw allow 7881/tcp || true
  sudo ufw allow 7882/udp || true
fi

if command -v docker-compose >/dev/null || docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
  docker compose version >/dev/null 2>&1 && COMPOSE=(docker compose)
  "${COMPOSE[@]}" -f docker-compose.yml up -d --force-recreate livekit || true
fi

cat > INSTALL.txt <<EOF
Dialdeck is on the public internet via port forwarding.

Share this URL:  ${PUBLIC_URL}

Router must forward to this machine:
  ${HTTP_PORT}/tcp  PWA
  7880/tcp         voice signaling
  7881/tcp         WebRTC ICE TCP
  7882/udp         WebRTC media

Friends open ${PUBLIC_URL} and type a name.
You on the LAN can keep using http://127.0.0.1:${HTTP_PORT}
EOF
cat INSTALL.txt
