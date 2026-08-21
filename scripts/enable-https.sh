#!/usr/bin/env bash
# Install self-signed TLS and publish https://*:8443 without breaking HTTP.
set -euo pipefail
cd "${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
export PATH="$HOME/.local/bin:$PATH"
chmod +x scripts/make-tls.sh
bash scripts/make-tls.sh

if [[ ! -s deploy/tls/cert.pem || ! -s deploy/tls/key.pem ]]; then
  echo "xx certs missing after make-tls" >&2
  exit 1
fi

COMPOSE=(docker-compose)
command -v docker >/dev/null && docker compose version >/dev/null 2>&1 && COMPOSE=(docker compose)

# HTTPS_PORT in .env (default 8443)
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
HTTPS_PORT="${HTTPS_PORT:-8443}"
if ! grep -qE '^HTTPS_PORT=' .env 2>/dev/null; then
  echo "HTTPS_PORT=${HTTPS_PORT}" >> .env
fi

if command -v firewall-cmd >/dev/null; then
  sudo firewall-cmd --permanent --add-port="${HTTPS_PORT}/tcp" || true
  sudo firewall-cmd --reload || true
elif command -v ufw >/dev/null; then
  sudo ufw allow "${HTTPS_PORT}/tcp" || true
fi

"${COMPOSE[@]}" -f docker-compose.yml up -d --force-recreate --no-deps caddy
sleep 2
"${COMPOSE[@]}" -f docker-compose.yml logs --tail=20 caddy || true

WAN_IP=$(curl -4 -fsS --max-time 8 https://api.ipify.org || true)
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if curl -skf --connect-timeout 2 --max-time 3 "https://127.0.0.1:${HTTPS_PORT}/api/health" >/dev/null; then
  echo
  echo "HTTPS is up."
  echo "This machine:  https://127.0.0.1:${HTTPS_PORT}"
  echo "LAN:           https://${LAN_IP:-<lan>}:${HTTPS_PORT}"
  echo "Internet:      https://${WAN_IP:-<wan>}:${HTTPS_PORT}"
  echo
  echo "Firefox: Advanced → Accept the risk. Then join voice."
  echo "Router: forward ${HTTPS_PORT}/tcp to this box."
else
  echo "xx HTTPS not answering yet. Logs above. HTTP should still work." >&2
  ss -ltn | grep -E ":${HTTPS_PORT}|:8088|:8090" || true
  exit 1
fi
