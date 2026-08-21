#!/usr/bin/env bash
# Pick free HTTP/HTTPS ports. No prompts — if the default is busy, take the next free one.

port_in_use() {
  local p="$1"
  if python3 - "$p" <<'PY' 2>/dev/null; then
    return 0
  fi
  return 1
}

# python exits 0 if bind fails (port busy)
port_in_use() {
  local p="$1"
  python3 -c "
import socket, sys
p = int(sys.argv[1])
for family, addr in ((socket.AF_INET, '0.0.0.0'), (socket.AF_INET6, '::')):
    s = socket.socket(family, socket.SOCK_STREAM)
    try:
        if family == socket.AF_INET6:
            s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
    except OSError:
        pass
    try:
        s.bind((addr, p))
        s.close()
    except OSError:
        s.close()
        raise SystemExit(0)
raise SystemExit(1)
" "$p"
}

show_holder() {
  local p="$1"
  ss -ltnp 2>/dev/null | grep -E ":${p}[[:space:]]" || true
  podman ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep "$p" || true
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep "$p" || true
}

rewrite_env_port() {
  local file="${INSTALL_DIR:-.}/.env"
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

next_free() {
  local start="$1"
  shift
  local cand
  for cand in "$start" "$@"; do
    if ! port_in_use "$cand"; then
      echo "$cand"
      return 0
    fi
  done
  echo "$start"
  return 1
}

choose_ports() {
  local http="${HTTP_PORT:-8080}"
  local https="${HTTPS_PORT:-8443}"
  if port_in_use "$http"; then
    warn "Port ${http} is in use:"
    show_holder "$http"
    http=$(next_free 8088 8090 8180 9080 18080 28080)
    log "Moving HTTP to ${http}"
  fi
  if port_in_use "$https"; then
    https=$(next_free 8444 8445 9443 18443)
    log "Moving HTTPS to ${https}"
  fi
  HTTP_PORT="$http"
  HTTPS_PORT="$https"
  export HTTP_PORT HTTPS_PORT
  rewrite_env_port "$http" "$https"
  log "Caddy will bind HTTP ${http} and HTTPS ${https}"
}
