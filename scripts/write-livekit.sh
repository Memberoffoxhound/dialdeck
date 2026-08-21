#!/usr/bin/env bash
# LiveKit config for LAN + port-forwarded WAN.
set -euo pipefail
ROOT="${INSTALL_DIR:-$HOME/.local/share/dialdeck}"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
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
    - stun.l.google.com:19302
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
echo "Wrote LiveKit config (use_external_ip + STUN)"
