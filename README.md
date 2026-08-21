# Dialdeck

**Self-hosted Discord for friends and family.** Phone pun: *dial* + Steam *Deck*.

One command on the Bazzite box. Everyone else opens the PWA, creates an account with the invite code, and talks.

Repository: https://github.com/Memberoffoxhound/dialdeck

## One-stop install

Prefer this so prompts still work (`curl | bash` reads answers from the terminal):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Memberoffoxhound/dialdeck/main/scripts/install.sh)
```

The installer **asks before it changes the system**. In order it will:

1. Use Docker Compose or Podman Compose if already present
2. If not: offer a user-space compose binary + existing **Podman** (no OS rebase)
3. If you want Docker: offer `ujust setup-docker` / `install-docker` when those recipes exist
4. Last resort: ask to `rpm-ostree install moby-engine docker-compose` (sudo + reboot, then run the installer again)
5. Ask to add you to the `docker` group if needed
6. Clone to `~/.local/share/dialdeck`, generate secrets + invite code
7. Build and start the stack (Caddy, PWA, API, LiveKit, Postgres, Redis, MinIO)
8. Install `dialdeck.service` and ask to **enable linger** so Game Mode / reboot keeps the line up
9. Copy the Decky plugin if Decky Loader is present, and build it when `pnpm` exists

Friends only open `http://<lan-ip>:8080`, tap **Create account**, enter the invite from `~/.local/share/dialdeck/INSTALL.txt`.

Uninstall: `~/.local/share/dialdeck/scripts/uninstall.sh`

### Game Mode

Linger + `scripts/watch.sh` (Restart=always) is what keeps the stack alive when you boot or switch into Game Mode. Check:

```bash
loginctl show-user "$USER" | grep Linger
systemctl --user status dialdeck
```

Without linger, Desktop Mode must have logged in once or the user service never starts.

## Video (audience)

VBR, auto layer. Not 4K yet.

| Layer | Size | fps | VBR ceiling |
| --- | --- | --- | --- |
| q | 480p | 30 | 1.0 Mbps |
| h | 720p | 60 | 2.5 Mbps |
| f | 1080p | 60 | 4.5 Mbps |

LiveKit forwards the best layer each viewer can take. See `apps/web/src/media.ts`.

## Decky QAM

The plugin polls `/api/stats` plus host NIC counters:

- quality: excellent / good / fair / poor / down (from RTT)
- RTT in ms
- ↓/↑ Mb/s on the default route iface
- user + session counts
- video policy line

Default URL is `http://127.0.0.1:8080` (same box).

## Status

- [x] One-stop installer with permission prompts
- [x] Game Mode linger + health watchdog
- [x] Persistent accounts, invite, chat
- [x] Decky stats panel
- [x] 480p–1080p60 VBR policy + token path
- [ ] LiveKit JS client in the PWA (actual send/receive)
- [ ] RNNoise
- [ ] Uploads / GIF search

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Media](docs/MEDIA.md)
- [Hosting](docs/HOSTING.md)
- [Decky](docs/DECKY.md)

## License

AGPL-3.0-or-later.
