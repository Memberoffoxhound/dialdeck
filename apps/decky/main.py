import json
import os
import socket
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

import decky
from settings import SettingsManager

settings = SettingsManager(
    name="settings",
    settings_directory=decky.DECKY_PLUGIN_SETTINGS_DIR,
)
settings.read()

DEFAULTS = {
    "url": "http://127.0.0.1:8080",
    "device": "deck",
    "role": "talker",
    "room": "party-line",
    "input_gain": 80,
    "output_gain": 80,
    "muted": False,
}

_last_net = None
_last_net_ts = 0.0


def _cfg():
    out = dict(DEFAULTS)
    stored = settings.settings if isinstance(settings.settings, dict) else {}
    out.update(stored)
    return out


def _default_iface():
    try:
        with open("/proc/net/route", encoding="utf-8") as fh:
            for line in fh:
                parts = line.split()
                if len(parts) > 1 and parts[1] == "00000000":
                    return parts[0]
    except OSError:
        return None
    return None


def _iface_bytes(name):
    try:
        with open("/proc/net/dev", encoding="utf-8") as fh:
            for line in fh:
                if ":" not in line:
                    continue
                iface, rest = line.split(":", 1)
                if iface.strip() != name:
                    continue
                cols = rest.split()
                rx, tx = int(cols[0]), int(cols[8])
                return rx, tx
    except OSError:
        return None
    return None


def _bandwidth():
    global _last_net, _last_net_ts
    name = _default_iface()
    if not name:
        return {"iface": None, "rx_mbps": 0, "tx_mbps": 0}
    now = time.time()
    pair = _iface_bytes(name)
    if not pair:
        return {"iface": name, "rx_mbps": 0, "tx_mbps": 0}
    rx, tx = pair
    rx_mbps = tx_mbps = 0.0
    if _last_net and now > _last_net_ts:
        dt = max(now - _last_net_ts, 0.001)
        rx_mbps = max(0.0, (rx - _last_net[0]) * 8 / dt / 1_000_000)
        tx_mbps = max(0.0, (tx - _last_net[1]) * 8 / dt / 1_000_000)
    _last_net = (rx, tx)
    _last_net_ts = now
    return {
        "iface": name,
        "rx_mbps": round(rx_mbps, 2),
        "tx_mbps": round(tx_mbps, 2),
    }


def _ping_ms(url):
    started = time.perf_counter()
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=2) as resp:
            body = resp.read()
        ms = (time.perf_counter() - started) * 1000
        return ms, json.loads(body.decode() or "{}")
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as err:
        return None, {"error": str(err)}


def _quality(ms):
    if ms is None:
        return "down"
    if ms < 40:
        return "excellent"
    if ms < 80:
        return "good"
    if ms < 150:
        return "fair"
    return "poor"


def _containers():
    for cmd in (
        "docker compose -f docker-compose.yml ps --format json",
        "podman compose -f docker-compose.yml ps --format json",
        "docker ps --format '{{.Names}} {{.Status}}'",
        "podman ps --format '{{.Names}} {{.Status}}'",
    ):
        try:
            import subprocess

            home = os.path.join(decky.DECKY_USER_HOME, ".local/share/dialdeck")
            proc = subprocess.run(
                cmd,
                shell=True,
                cwd=home if os.path.isdir(home) else None,
                capture_output=True,
                text=True,
                timeout=4,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout.strip()[:2000]
        except Exception:
            continue
    return ""


class Plugin:
    async def get_settings(self):
        return _cfg()

    async def set_settings(self, patch: dict):
        current = _cfg()
        current.update(patch or {})
        settings.settings = current
        settings.commit()
        return current

    async def health(self):
        url = _cfg()["url"].rstrip("/") + "/api/health"
        ms, body = _ping_ms(url)
        return {"ok": ms is not None, "ms": ms, "body": body}

    async def server_stats(self):
        base = _cfg()["url"].rstrip("/")
        ms, body = _ping_ms(base + "/api/stats")
        if ms is None:
            ms, body = _ping_ms(base + "/api/health")
        bw = _bandwidth()
        quality = _quality(ms)
        return {
            "ok": ms is not None,
            "quality": quality,
            "rtt_ms": round(ms, 1) if ms is not None else None,
            "api": body,
            "bandwidth": bw,
            "host": socket.gethostname(),
            "containers": _containers(),
        }

    async def _main(self):
        decky.logger.info("Dialdeck plugin up")

    async def _unload(self):
        decky.logger.info("Dialdeck plugin down")

    async def _uninstall(self):
        pass

    async def _migration(self):
        decky.migrate_settings(
            os.path.join(decky.DECKY_USER_HOME, ".config", "dialdeck")
        )
