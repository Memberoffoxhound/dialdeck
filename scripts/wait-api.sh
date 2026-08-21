#!/usr/bin/env bash
# Fast health probe. Never hang more than ~20s.

probe() {
  curl -sf --connect-timeout 1 --max-time 2 "$1" >/dev/null 2>&1
}

published_http() {
  local line
  line=$("${ENGINE[@]:-docker-compose}" -f docker-compose.yml port caddy 8080 2>/dev/null | head -1 || true)
  if [[ "$line" =~ :([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

listening_http() {
  ss -ltn 2>/dev/null | awk '$4 ~ /:(8080|8088|8090|8443)$/ { print $4 }' | sed 's/.*://' | sort -u
}

wait_for_api() {
  local i p mapped
  mapped=$(published_http || true)
  local ports=("${mapped}" "${HTTP_PORT:-}" 8088 8090 8080 8443)
  log "Waiting for API (max ~20s)"
  for i in $(seq 1 10); do
    for p in "${ports[@]}"; do
      [[ -z "$p" ]] && continue
      if probe "http://127.0.0.1:${p}/api/health" || probe "https://127.0.0.1:${p}/api/health"; then
        HTTP_PORT="$p"
        export HTTP_PORT
        declare -f rewrite_env_port >/dev/null && rewrite_env_port "$HTTP_PORT" "${HTTPS_PORT:-8443}"
        log "API healthy on :${HTTP_PORT}"
        return 0
      fi
    done
    sleep 1
  done
  if "${ENGINE[@]:-docker-compose}" -f docker-compose.yml ps --status running 2>/dev/null | grep -q caddy; then
    warn "Caddy is running but /api/health did not answer in time. Using published ports anyway."
    p=$(published_http || true)
    [[ -n "$p" ]] && HTTP_PORT="$p" && export HTTP_PORT
    return 0
  fi
  warn "Health probe timed out — continuing. Check: curl -sf http://127.0.0.1:${HTTP_PORT:-8090}/api/health"
  return 1
}
