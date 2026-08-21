#!/usr/bin/env bash
# Let rootless Podman/Docker bind 443. Needs sudo once.
set -euo pipefail
echo "Lowering unprivileged port start to 443 (sudo)"
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=443
echo net.ipv4.ip_unprivileged_port_start=443 | sudo tee /etc/sysctl.d/99-dialdeck-unprivileged-ports.conf
sudo sysctl --system >/dev/null 2>&1 || true
echo "443 is now bindable without root."
