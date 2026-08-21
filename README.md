# Dialdeck

**Self-hosted Discord for friends and family.** Phone pun: *dial* + Steam *Deck*.

One package on the Bazzite box. Everyone else opens the PWA, creates an account, and talks.

Repository: https://github.com/Memberoffoxhound/dialdeck

## Download for Bazzite

1. Get [Install-Dialdeck.desktop](https://raw.githubusercontent.com/Memberoffoxhound/dialdeck/main/packaging/bazzite/Install-Dialdeck.desktop) (or the whole [packaging/bazzite](https://github.com/Memberoffoxhound/dialdeck/tree/main/packaging/bazzite) folder).
2. Mark it executable (Dolphin → Properties → executable).
3. Double-click. A terminal asks before it changes anything.

Same thing from Konsole:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Memberoffoxhound/dialdeck/main/scripts/install.sh)
```

The installer will:

- Use or install Podman/Docker compose (asks first)
- Generate invite + secrets, start the stack
- Enable a user service + **linger** so Game Mode / reboot keep it up
- Ask to enable **Tailscale** (already on Bazzite), log this machine in, and `serve` HTTPS on your tailnet
- Install the Decky plugin if Decky is present

Friends on the LAN use `http://<lan-ip>:8080`. Friends off-LAN install Tailscale, join the same tailnet, and use the printed `https://....ts.net` URL.

Uninstall: `~/.local/share/dialdeck/scripts/uninstall.sh`

## Video

VBR auto layer: 480p30 → 720p60 → 1080p60.

## Status

- [x] One-stop Bazzite installer + desktop launcher
- [x] Game Mode linger + watchdog
- [x] Guided Tailscale + Serve
- [x] Accounts, chat, party-line mic/screen
- [x] Decky stats
- [ ] RNNoise, uploads/GIF, owner reachability UI

## Docs

- [Tailscale](docs/TAILSCALE.md)
- [Media](docs/MEDIA.md)
- [Hosting](docs/HOSTING.md)
- [Decky](docs/DECKY.md)

## License

AGPL-3.0-or-later.
