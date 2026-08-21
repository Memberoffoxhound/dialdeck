#!/usr/bin/env bash
# Desktop icon + autostart tray next to the clock.
set -euo pipefail
INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
APPDIR="$HOME/.local/share/applications"
AUTO="$HOME/.config/autostart"
DESK="$HOME/Desktop"
ICON="$INSTALL_DIR/apps/desktop/dialdeck.svg"
TRAY="$INSTALL_DIR/apps/desktop/dialdeck-tray.py"
HTTP_PORT=8090
[[ -f "$INSTALL_DIR/.env" ]] && HTTP_PORT=$(grep -E '^HTTP_PORT=' "$INSTALL_DIR/.env" | cut -d= -f2 | tail -1)
HTTP_PORT="${HTTP_PORT:-8090}"
URL="http://127.0.0.1:${HTTP_PORT}"

mkdir -p "$APPDIR" "$AUTO"
chmod +x "$TRAY" 2>/dev/null || true

cat > "$APPDIR/dialdeck.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Dialdeck
Comment=Open the party line PWA
Exec=xdg-open ${URL}
Icon=${ICON}
Terminal=false
Categories=Network;AudioVideo;
StartupNotify=true
EOF

cat > "$APPDIR/dialdeck-tray.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Dialdeck Tray
Comment=Clock-tray stats for Dialdeck
Exec=python3 ${TRAY}
Icon=${ICON}
Terminal=false
Categories=Network;System;
X-GNOME-Autostart-enabled=true
EOF

cp "$APPDIR/dialdeck.desktop" "$AUTO/dialdeck-tray.desktop"
# autostart should launch the tray, not the browser
cat > "$AUTO/dialdeck-tray.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Dialdeck Tray
Exec=python3 ${TRAY}
Icon=${ICON}
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

if [[ -d "$DESK" ]]; then
  cp "$APPDIR/dialdeck.desktop" "$DESK/dialdeck.desktop"
  chmod +x "$DESK/dialdeck.desktop" || true
fi
chmod +x "$APPDIR/dialdeck.desktop" "$APPDIR/dialdeck-tray.desktop" || true

# Prefer Qt tray; install PyQt6 into user site if missing
if ! python3 -c "import PyQt6" 2>/dev/null && ! python3 -c "import PyQt5" 2>/dev/null; then
  python3 -m pip install --user PyQt6 >/dev/null 2>&1 || true
fi

if ! pgrep -f "dialdeck-tray.py" >/dev/null 2>&1; then
  nohup python3 "$TRAY" >/tmp/dialdeck-tray.log 2>&1 &
fi

echo "Desktop icon: $DESK/dialdeck.desktop"
echo "Tray: python3 $TRAY"
echo "PWA: $URL"
