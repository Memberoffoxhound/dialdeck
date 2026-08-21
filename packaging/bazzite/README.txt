Dialdeck for Bazzite
====================

1. Download this folder (or just Install-Dialdeck.desktop).
2. Right-click the desktop file → Properties → Allow executing as program.
   (Dolphin: checkbox "Executable" / KDE may ask on first open.)
3. Double-click it. A terminal walks you through:
     - Podman or Docker
     - Game Mode linger
     - Tailscale login + HTTPS serve (optional, for family off your Wi-Fi)
4. When it finishes, open INSTALL.txt in ~/.local/share/dialdeck
   Create your account at the printed URL. First account is owner.

Family off-LAN:
  Install the Tailscale app on each phone/PC, log into the SAME tailnet,
  then open the Share URL from INSTALL.txt.

From a terminal instead:

  bash <(curl -fsSL https://raw.githubusercontent.com/Memberoffoxhound/dialdeck/main/scripts/install.sh)

Uninstall:

  ~/.local/share/dialdeck/scripts/uninstall.sh
