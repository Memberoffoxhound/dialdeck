#!/usr/bin/env bash
# Fast health probe. Never hang more than ~15s.

probe() {
  curl -sf --connect-timeout 1 --max-time 1 "$1" >/dev/null 2>&1
}

published_http() {
  local line
  line=$("${ENGINE[@]}" -f docker-compose.yml port caddy 8080 2>/dev/null | head -1 || true)
  if [[ "$line" =~ :([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

wait_for_api() {
  local i p mapped
  mapped=$(published_http || true)
  local ports=("${mapped}" "${HTTP_PORT:-}" 8088 8080 8090)
  log "Waiting for API (max ~15s)"
  for i in 1 2 3 4 5 6 7 8; do
    for p in "${ports[@]}"; do
      [[ -z "$p" ]] && continue
      if probe "http://127.0.0.1:${p}/api/health"; then
        HTTP_PORT="$p"
        export HTTP_PORT
        declare -f rewrite_env_port >/dev/null && rewrite_env_port "$HTTP_PORT" "${HTTPS_PORT:-8443}"
        log "API healthy on :${HTTP_PORT}"
        return 0
      fi
    done
    sleep 1
  done
  warn "Health probe timed out — continuing. Containers are up; finish with scripts/finish-install.sh if needed."
  return 1
}
