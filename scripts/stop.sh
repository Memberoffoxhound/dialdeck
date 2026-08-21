#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if docker compose version >/dev/null 2>&1; then
  docker compose -f docker-compose.yml down
elif command -v docker-compose >/dev/null; then
  docker-compose -f docker-compose.yml down
elif podman compose version >/dev/null 2>&1; then
  podman compose -f docker-compose.yml down
else
  podman-compose -f docker-compose.yml down
fi
