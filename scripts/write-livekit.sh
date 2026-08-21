#!/usr/bin/env bash
# Rewrite deploy/livekit.yaml using .env keys and this machine's LAN IP.
set -euo pipefail
ROOT="${INSTALL_DIR:-$HOME/.local/share/dialdeck}"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
LAN_IP="${LAN_IP:-127.0.0.1}"
cat > deploy/livekit.yaml <<EOF
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: false
  node_ip: ${LAN_IP}
  enable_loopback_candidate: true
keys:
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
echo "Wrote LiveKit config node_ip=${LAN_IP}"
