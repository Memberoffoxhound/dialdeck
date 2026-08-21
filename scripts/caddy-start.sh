#!/bin/sh
set -e
mkdir -p /certs
if [ ! -s /certs/cert.pem ] || [ ! -s /certs/key.pem ]; then
  echo "==> generating self-signed TLS certs"
  apk add --no-cache openssl >/dev/null
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
    -keyout /certs/key.pem -out /certs/cert.pem \
    -subj "/CN=dialdeck" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  chmod 600 /certs/key.pem
fi
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
