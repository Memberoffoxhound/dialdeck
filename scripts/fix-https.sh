#!/usr/bin/env bash
set -euo pipefail
cd "${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
export PATH="$HOME/.local/bin:$PATH"
COMPOSE=(docker-compose)
command -v docker >/dev/null && docker compose version >/dev/null 2>&1 && COMPOSE=(docker compose)

chmod +x scripts/make-tls.sh scripts/caddy-start.sh
bash scripts/make-tls.sh
ls -l deploy/tls

if command -v firewall-cmd >/dev/null; then
  sudo firewall-cmd --permanent --add-port=8443/tcp || true
  sudo firewall-cmd --permanent --add-port=443/tcp || true
  sudo firewall-cmd --reload || true
fi

# Ensure .env publishes 8443
grep -qE '^HTTPS_PORT=' .env 2>/dev/null || echo HTTPS_PORT=8443 >> .env

"${COMPOSE[@]}" -f docker-compose.yml up -d --force-recreate --no-deps caddy
sleep 3
echo
echo "==> compose ports"
"${COMPOSE[@]}" -f docker-compose.yml port caddy 8443 || true
"${COMPOSE[@]}" -f docker-compose.yml port caddy 8080 || true
echo
echo "==> host listeners"
ss -ltn | grep -E ':8443|:443|:8090|:8088' || true
echo
echo "==> caddy logs"
"${COMPOSE[@]}" -f docker-compose.yml logs --tail=30 caddy || true
echo
echo "==> local probes"
curl -sf --max-time 3 http://127.0.0.1:8090/api/health && echo " HTTP 8090 ok" || echo " HTTP 8090 fail"
curl -sf --max-time 3 http://127.0.0.1:8088/api/health && echo " HTTP 8088 ok" || echo " HTTP 8088 fail"
curl -skf --max-time 3 https://127.0.0.1:8443/api/health && echo " HTTPS 8443 ok" || echo " HTTPS 8443 fail"
