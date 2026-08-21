# Dialdeck

**Self-hosted Discord for friends and family.** Phone pun: *dial* + Steam *Deck*.

You run one command on the Bazzite (or Linux) box. Everyone else opens the PWA, creates an account with the invite code, and talks.

Repository: https://github.com/Memberoffoxhound/dialdeck

## Install on the host (Bazzite / SteamOS / Linux)

On the machine that will stay on (your Bazzite box, Desktop Mode):

```bash
curl -fsSL https://raw.githubusercontent.com/Memberoffoxhound/dialdeck/main/scripts/install.sh | bash
```

That script will:

1. Use Docker Compose or Podman Compose (whichever is already on the box)
2. Clone this repo to `~/.local/share/dialdeck`
3. Generate passwords, LiveKit keys, and a family **invite code**
4. Build and start Caddy, the PWA, the API, LiveKit, Postgres, Redis, MinIO
5. Enable a systemd user service so it comes back after reboot (`loginctl enable-linger`)
6. Print `INSTALL.txt` with the LAN URL and invite code
7. Copy the Decky plugin sources if Decky Loader is installed

Then:

- You: open the printed URL, **Create account** (you become owner)
- Family: same URL + invite code → create their own handle
- Same person on PC + phone: log in twice; sessions are tagged `pc` / `phone` / `deck`

Uninstall:

```bash
~/.local/share/dialdeck/scripts/uninstall.sh
```

### What the installer cannot magic into existence

Bazzite is immutable. It usually already has **Podman**. It does **not** always have Docker. If compose is missing, the script stops and tells you to enable Docker in Bazzite Portal / `bazzite-dx`, or install `podman-compose`. It will not rebase your OS for you.

Off-LAN access is still your choice: Tailscale is the easy one. The installer binds **8080** (http) and **8443** (https with a local CA) so it works rootless.

## After install — user flow

1. Open `http://<lan-ip>:8080` (Chrome / Safari / Deck browser)
2. Create account + invite code from `INSTALL.txt`
3. Optional: Add to Home Screen (PWA)
4. Chat in `#lounge`. Voice button on `party-line` is wired to LiveKit tokens; the in-browser SFU client is the next slice

## Status

What the package does today:

- [x] One-command host install + secrets + linger service
- [x] Persistent accounts (scrypt), invite gate, first user = owner
- [x] Persistent rooms + messages
- [x] Ban / kick / mute API
- [x] Multi-session cookies (PC + phone + Deck)
- [x] PWA shell (gamer UI, emoji, volume mix)
- [x] LiveKit server in the stack + token mint
- [x] Decky plugin (QAM panel + route)

Not done — do not tell family this is Discord-complete:

- [ ] LiveKit client in the PWA (actual mic/screen)
- [ ] RNNoise worklet
- [ ] Uploads / GIF search
- [ ] Reachability wizard in the owner UI
- [ ] 4K120 publisher + WHIP ingest

## Stack

LiveKit, Caddy, Postgres, Redis, MinIO, Fastify, React PWA. All open source. See [NOTICE](NOTICE).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Media / 4K120](docs/MEDIA.md)
- [Hosting](docs/HOSTING.md)
- [Decky](docs/DECKY.md)

## License

AGPL-3.0-or-later.
