#!/usr/bin/env bash
# Self-signed cert for the public IP + LAN + localhost so browsers unlock mediaDevices.
set -euo pipefail
ROOT="${INSTALL_DIR:-$HOME/.local/share/dialdeck}"
cd "$ROOT"
mkdir -p deploy/tls
WAN_IP="${DIALDECK_WAN_IP:-}"
WAN_IP="${WAN_IP:-$(curl -4 -fsS --max-time 8 https://api.ipify.org || true)}"
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
SAN="DNS:localhost,IP:127.0.0.1"
[[ -n "$LAN_IP" ]] && SAN="${SAN},IP:${LAN_IP}"
[[ -n "$WAN_IP" ]] && SAN="${SAN},IP:${WAN_IP}"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
  -keyout deploy/tls/key.pem -out deploy/tls/cert.pem \
  -subj "/CN=dialdeck" \
  -addext "subjectAltName=${SAN}"
chmod 600 deploy/tls/key.pem
echo "TLS cert SANs: ${SAN}"
