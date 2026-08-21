#!/usr/bin/env bash
# Pick free HTTP/HTTPS ports. Expects confirm/log/warn, INSTALL_DIR, HTTP_PORT, HTTPS_PORT.

port_in_use() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${p}$"
    return $?
  fi
  python3 -c "import socket,sys; s=socket.socket(); s.settimeout(0.2); r=s.connect_ex(('127.0.0.1',int(sys.argv[1]))); s.close(); raise SystemExit(0 if r==0 else 1)" "$p" 2>/dev/null
}

show_holder() {
  local p="$1"
  ss -ltnp 2>/dev/null | grep -E "[:.]${p} " || true
  podman ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep "$p" || true
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep "$p" || true
}

rewrite_env_port() {
  local file="$INSTALL_DIR/.env"
  local http="$1" https="$2"
  [[ -f "$file" ]] || return 0
  local tmp
  tmp=$(mktemp)
  grep -vE '^(HTTP_PORT|HTTPS_PORT|PUBLIC_URL|LIVEKIT_WS_URL)=' "$file" >"$tmp" || true
  cat >>"$tmp" <<EOF
HTTP_PORT=${http}
HTTPS_PORT=${https}
PUBLIC_URL=http://localhost:${http}
LIVEKIT_WS_URL=ws://localhost:${http}/rtc
EOF
  mv "$tmp" "$file"
}

choose_ports() {
  local http="${HTTP_PORT:-8080}"
  local https="${HTTPS_PORT:-8443}"
  if port_in_use "$http"; then
    warn "Port ${http} is already in use:"
    show_holder "$http"
    local picked=""
    for cand in 8088 8090 8180 9080 18080; do
      if ! port_in_use "$cand"; then
        if confirm "Use port ${cand} instead of ${http}?"; then
          picked="$cand"
          break
        fi
      fi
    done
    if [[ -z "$picked" ]]; then
      warn "Leaving ${http} as-is. Stop the other service or set DIALDECK_HTTP_PORT and re-run."
    else
      http="$picked"
    fi
  fi
  if port_in_use "$https"; then
    for cand in 8444 8445 9443 18443; do
      if ! port_in_use "$cand"; then
        https="$cand"
        break
      fi
    done
    log "HTTPS host port set to ${https}"
  fi
  HTTP_PORT="$http"
  HTTPS_PORT="$https"
  export HTTP_PORT HTTPS_PORT
  rewrite_env_port "$http" "$https"
  log "Caddy will bind HTTP ${http} and HTTPS ${https}"
}
