#!/usr/bin/env bash
# Fix a half-up Dialdeck: recreate Caddy, find a live port, print the URL.
set +e
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
cd "$INSTALL_DIR" || exit 1
export PATH="$HOME/.local/bin:$PATH"

log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }

git fetch origin main >/dev/null 2>&1
git reset --hard origin/main >/dev/null 2>&1
chmod +x scripts/*.sh

if docker compose version >/dev/null 2>&1; then ENGINE=(docker compose)
elif podman compose version >/dev/null 2>&1; then ENGINE=(podman compose)
elif command -v docker-compose >/dev/null; then ENGINE=(docker-compose)
else ENGINE=(podman-compose)
fi

set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
HTTP_PORT="${HTTP_PORT:-8090}"

log "Recreating Caddy on :${HTTP_PORT}"
"${ENGINE[@]}" -f docker-compose.yml up -d --force-recreate caddy
sleep 2
"${ENGINE[@]}" -f docker-compose.yml logs --tail 30 caddy

live=""
for p in "$HTTP_PORT" 8090 8088 8080 8180; do
  if curl -sf --connect-timeout 1 --max-time 2 "http://127.0.0.1:${p}/api/health" >/dev/null; then
    live="$p"
    break
  fi
done

if [[ -z "$live" ]]; then
  warn "Still no HTTP. Last Caddy log is above."
  warn "Try: ${ENGINE[*]} -f docker-compose.yml logs caddy"
  exit 1
fi

HTTP_PORT="$live"
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
log "Working. Open http://127.0.0.1:${HTTP_PORT} or http://${LAN_IP}:${HTTP_PORT}"
log "Invite: ${INVITE_CODE:-see .env}"

# shellcheck disable=SC1091
source "$INSTALL_DIR/scripts/install-decky.sh"
install_decky_plugin
