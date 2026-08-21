import json
import os
from urllib.request import Request, urlopen
from urllib.error import URLError

import decky
from settings import SettingsManager

settings = SettingsManager(
    name="settings",
    settings_directory=decky.DECKY_PLUGIN_SETTINGS_DIR,
)
settings.read()

DEFAULTS = {
    "url": "https://localhost",
    "device": "deck",
    "role": "talker",
    "room": "party-line",
    "input_gain": 80,
    "output_gain": 80,
    "muted": False,
}


def _cfg():
    out = dict(DEFAULTS)
    stored = settings.settings if isinstance(settings.settings, dict) else {}
    out.update(stored)
    return out


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
        try:
            req = Request(url, headers={"Accept": "application/json"})
            with urlopen(req, timeout=3) as resp:
                body = json.loads(resp.read().decode())
                return {"ok": True, "body": body}
        except URLError as err:
            decky.logger.warning("health failed: %s", err)
            return {"ok": False, "error": str(err)}
        except Exception as err:
            return {"ok": False, "error": str(err)}

    async def _main(self):
        decky.logger.info(
            "Dialdeck plugin up. settings=%s user_home=%s",
            decky.DECKY_PLUGIN_SETTINGS_DIR,
            decky.DECKY_USER_HOME,
        )

    async def _unload(self):
        decky.logger.info("Dialdeck plugin down")

    async def _uninstall(self):
        pass

    async def _migration(self):
        decky.migrate_settings(
            os.path.join(decky.DECKY_USER_HOME, ".config", "dialdeck")
        )
