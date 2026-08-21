#!/usr/bin/env python3
"""System tray: health, users, throughput, link to the PWA."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HOME = Path.home()
ROOT = Path(os.environ.get("DIALDECK_HOME", HOME / ".local/share/dialdeck"))
ICON = ROOT / "apps/desktop/dialdeck.svg"


def http_port() -> str:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("HTTP_PORT="):
                return line.split("=", 1)[1].strip() or "8090"
    return os.environ.get("HTTP_PORT", "8090")


def base_url() -> str:
    return f"http://127.0.0.1:{http_port()}"


def fetch_stats() -> dict:
    url = base_url() + "/api/stats"
    try:
        with urllib.request.urlopen(url, timeout=1.5) as r:
            data = json.loads(r.read().decode())
            data["ok"] = True
            return data
    except Exception:
        return {"ok": False, "users": 0, "sessions": 0}


_last_net = None
_last_t = None


def throughput() -> tuple[float, float]:
    global _last_net, _last_t
    rx = tx = 0
    try:
        for line in Path("/proc/net/dev").read_text().splitlines()[2:]:
            if ":" not in line:
                continue
            name, rest = line.split(":", 1)
            if name.strip() == "lo":
                continue
            parts = rest.split()
            rx += int(parts[0])
            tx += int(parts[8])
    except Exception:
        return 0.0, 0.0
    now = time.time()
    if _last_net is None or now <= _last_t:
        _last_net, _last_t = (rx, tx), now
        return 0.0, 0.0
    dt = now - _last_t
    down = (rx - _last_net[0]) * 8 / dt / 1_000_000
    up = (tx - _last_net[1]) * 8 / dt / 1_000_000
    _last_net, _last_t = (rx, tx), now
    return max(down, 0), max(up, 0)


def open_pwa() -> None:
    subprocess.Popen(["xdg-open", base_url()], start_new_session=True)


def start_server() -> None:
    subprocess.Popen(
        ["systemctl", "--user", "start", "dialdeck"], start_new_session=True
    )


def stop_server() -> None:
    subprocess.Popen(
        ["systemctl", "--user", "stop", "dialdeck"], start_new_session=True
    )


def label(stats: dict) -> str:
    down, up = throughput()
    if not stats.get("ok"):
        return "Dialdeck · DOWN"
    return (
        f"Dialdeck · OK · {stats.get('users', 0)} users · "
        f"{stats.get('sessions', 0)} sess · ↓{down:.1f} ↑{up:.1f} Mb/s"
    )


def run_qt() -> bool:
    QtWidgets = QtGui = QtCore = None
    for mod in ("PyQt6", "PyQt5"):
        try:
            QtWidgets = __import__(f"{mod}.QtWidgets", fromlist=["QtWidgets"])
            QtGui = __import__(f"{mod}.QtGui", fromlist=["QtGui"])
            QtCore = __import__(f"{mod}.QtCore", fromlist=["QtCore"])
            break
        except ImportError:
            continue
    if not QtWidgets:
        return False

    app = QtWidgets.QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    tray = QtWidgets.QSystemTrayIcon()
    icon = QtGui.QIcon(str(ICON) if ICON.exists() else "network-server")
    tray.setIcon(icon)

    menu = QtWidgets.QMenu()
    status_action = menu.addAction("Checking…")
    status_action.setEnabled(False)
    menu.addSeparator()
    menu.addAction("Open Dialdeck", open_pwa)
    menu.addAction("Start server", start_server)
    menu.addAction("Stop server", stop_server)
    menu.addSeparator()
    menu.addAction("Quit tray", app.quit)
    tray.setContextMenu(menu)
    tray.activated.connect(
        lambda reason: open_pwa()
        if int(reason) in (2, 3)
        else None
    )

    def tick():
        s = fetch_stats()
        text = label(s)
        status_action.setText(text)
        tray.setToolTip(text)
        if not s.get("ok"):
            tray.setIcon(app.style().standardIcon(QtWidgets.QStyle.StandardPixmap.SP_MessageBoxCritical)
                         if hasattr(QtWidgets.QStyle, "StandardPixmap")
                         else icon)
        else:
            tray.setIcon(icon)

    timer = QtCore.QTimer()
    timer.timeout.connect(tick)
    timer.start(4000)
    tick()
    tray.show()
    app.exec() if hasattr(app, "exec") else app.exec_()
    return True


def main() -> None:
    if run_qt():
        return
    print("Install PyQt for the tray:  python3 -m pip install --user PyQt6", file=sys.stderr)
    print(label(fetch_stats()))
    print("PWA:", base_url())
    sys.exit(1)


if __name__ == "__main__":
    main()
