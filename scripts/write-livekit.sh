#!/usr/bin/env bash
# LiveKit STUN + WAN ICE. Override with STUN_SERVERS in .env (comma-separated host:port).
set -euo pipefail
ROOT="${INSTALL_DIR:-$HOME/.local/share/dialdeck}"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a

STUN_SERVERS="${STUN_SERVERS:-stun.l.google.com:19302,stun1.l.google.com:19302,stun2.l.google.com:19302,stun.cloudflare.com:3478}"
STUN_YAML=""
IFS=',' read -ra _stuns <<<"$STUN_SERVERS"
for s in "${_stuns[@]}"; do
  s=$(echo "$s" | xargs)
  [[ -n "$s" ]] && STUN_YAML+="    - ${s}"$'\n'
done

if ! grep -qE '^STUN_SERVERS=' .env 2>/dev/null; then
  echo "STUN_SERVERS=${STUN_SERVERS}" >> .env
fi

cat > deploy/livekit.yaml <<EOF
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
  enable_loopback_candidate: true
  stun_servers:
${STUN_YAML}keys:
  ${LIVEKIT_API_KEY:-devkey}: ${LIVEKIT_API_SECRET:-secretsecretsecretsecretsecretsecre}
logging:
  level: info
room:
  enabled_codecs:
    - mime: audio/opus
    - mime: video/vp8
    - mime: video/vp9
    - mime: video/h264
    - mime: video/av1
EOF
echo "Wrote LiveKit STUN: ${STUN_SERVERS}"
