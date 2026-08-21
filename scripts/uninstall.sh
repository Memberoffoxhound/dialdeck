#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
"$INSTALL_DIR/scripts/stop.sh" || true
systemctl --user disable --now dialdeck.service 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/dialdeck.service"
rm -rf "$HOME/homebrew/plugins/dialdeck"
read -r -p "Delete $INSTALL_DIR including chat history? [y/N] " ans
if [[ "${ans:-}" =~ ^[yY]$ ]]; then
  rm -rf "$INSTALL_DIR"
fi
echo "Dialdeck removed from this user account."
