#!/usr/bin/env bash
# Keep compose up across Game Mode / reboot. Started by systemd --user.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
HTTP_PORT=8080
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  HTTP_PORT=$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 || echo 8080)
fi

start_stack() {
  "$ROOT/scripts/start.sh" || true
}

start_stack

while true; do
  if ! curl -sf "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1; then
    start_stack
  fi
  sleep 15
done
