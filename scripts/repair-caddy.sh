#!/usr/bin/env bash
# Bring HTTP back. Optional HTTPS only after certs exist.
set -euo pipefail
cd "${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
export PATH="$HOME/.local/bin:$PATH"
COMPOSE=(docker-compose)
command -v docker >/dev/null && docker compose version >/dev/null 2>&1 && COMPOSE=(docker compose)

echo "==> Caddy logs (last 40)"
"${COMPOSE[@]}" -f docker-compose.yml logs --tail=40 caddy || true

echo "==> Recreate Caddy (HTTP)"
"${COMPOSE[@]}" -f docker-compose.yml up -d --force-recreate --no-deps caddy
sleep 2
"${COMPOSE[@]}" -f docker-compose.yml ps
echo
echo "==> Host listeners"
ss -ltn | grep -E ':8088|:8090|:8080|:8443' || true
echo
for p in 8090 8088 8080; do
  if curl -sf --connect-timeout 1 --max-time 2 "http://127.0.0.1:${p}/api/health"; then
    echo "  OK http://127.0.0.1:${p}"
    exit 0
  fi
done
echo "Still no /api/health. Try: ${COMPOSE[*]} -f docker-compose.yml logs api"
exit 1
