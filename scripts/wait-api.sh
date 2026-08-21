#!/usr/bin/env bash
# Probe the published Caddy port without hanging on a foreign listener.

probe() {
  local p="$1"
  curl -sf --connect-timeout 1 --max-time 2 "http://127.0.0.1:${p}/api/health" >/dev/null 2>&1
}

wait_for_api() {
  local i p
  local ports=("${HTTP_PORT:-8080}" 8080 8088 8090 8180 9080 18080)
  log "Waiting for API (2s timeout per probe)"
  for i in $(seq 1 20); do
    for p in "${ports[@]}"; do
      if probe "$p"; then
        HTTP_PORT="$p"
        export HTTP_PORT
        if declare -f rewrite_env_port >/dev/null; then
          rewrite_env_port "$HTTP_PORT" "${HTTPS_PORT:-8443}"
        fi
        log "API healthy on :${HTTP_PORT}"
        return 0
      fi
    done
    if (( i == 5 || i == 10 || i == 15 )); then
      warn "Still waiting (${i}/20). Last api/caddy logs:"
      "${ENGINE[@]}" -f docker-compose.yml logs --tail 15 api caddy 2>/dev/null || true
    fi
    sleep 2
  done
  warn "API health did not answer. Stack may still be usable — check logs."
  "${ENGINE[@]}" -f docker-compose.yml logs --tail 40 api caddy 2>/dev/null || true
  return 1
}
