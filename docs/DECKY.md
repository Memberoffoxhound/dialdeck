# Decky plugin

SteamOS / Bazzite Game Mode has no normal browser chrome. Decky Loader injects a React panel into the Quick Access menu.

`apps/decky` is a plugin that:

1. Stores the Dialdeck base URL (localhost, tailnet, or public).
2. Opens an embedded view of the PWA.
3. Requests microphone access through CEF.
4. Uses gamepad-first focus (QA button → rooms → mute).

Install (after Decky Loader):

```bash
# from Desktop Mode
cp -r apps/decky $HOME/homebrew/plugins/dialdeck
```

Or zip the folder and install from URL in Decky settings.

CEF is Chromium-based, so WebRTC behavior matches desktop Chrome more than Safari. That is good for the Deck as a viewer / talker. It is still a bad 4K120 *publisher* — keep publishing on the desktop session.
