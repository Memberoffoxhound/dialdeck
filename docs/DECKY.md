# Dialdeck Decky plugin — implementation

Steam Game Mode has no normal browser. Decky injects a React panel into the Quick Access Menu (QAM, the `...` button) and can register a full-screen SteamUI route. The plugin is two processes:

```
QAM / SteamUI (CEF, Chromium)
    React frontend  src/index.tsx   @decky/ui + @decky/api
            |
            | callable() / emit()
            v
Python backend      main.py         isolated plugin process
            |
            v
~/homebrew/settings/dialdeck/settings.json
localhost Dialdeck API + LiveKit
```

Do **not** use `import decky_plugin` (old). Current loaders inject `import decky`.

## What the plugin is for

| Job | Where |
| --- | --- |
| Instance URL, health, mute, gain, session role | QAM panel — usable *while a game has focus* |
| Full chat / room UI | SteamUI route `/dialdeck` embedding the PWA |
| Persist settings | Python `SettingsManager` under `DECKY_PLUGIN_SETTINGS_DIR` |
| 4K120 publish | **Not the Deck.** Desktop session publishes; Deck is talker/watcher. |

## Install on Bazzite / SteamOS

```bash
# Desktop Mode. Decky Loader must already be installed.
cd ~/homebrew/plugins
# after building apps/decky (pnpm i && pnpm build):
cp -r /path/to/dialdeck/apps/decky ./dialdeck
# or: Decky settings → Developer → Install from ZIP
```

Home is not always `/home/deck` on Bazzite. Use `decky.DECKY_USER_HOME`.

## Build

From `apps/decky`:

```bash
pnpm i
pnpm build   # writes dist/index.js — required in the install zip
```

Zip layout Decky expects:

```
dialdeck/
  dist/index.js
  package.json
  plugin.json
  main.py
  README.md
  LICENSE
```

## Mic / WebRTC in Game Mode

Steam CEF does not show Chrome's permission prompt. `getUserMedia` often fails in an iframe.

Order of reliability:

1. Phone session publishes the mic. Deck only subscribes. Always works.
2. Full-screen route hosts LiveKit *directly* (not a cross-origin iframe) so the plugin page is the capture document.
3. Steam's tab/browser surface (what DeckWebBrowser hacks). Fragile across SteamOS updates.

Treat Deck as a **talker/watcher**, never as the 4K publisher.
