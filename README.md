# Dialdeck

**Self-hosted Discord for friends and family** — a gamer-feel PWA with spaces, unlimited rooms, multi-device sessions, and a LiveKit media path aimed at LAN-grade video (up to 4K / 120 Hz when the hardware and network can take it).

> Phone pun: *dial* + Steam *Deck*. You pick up the line from the machine you game on.

**This is a foundation, not a finished Discord.** Building the full product is months of work. What lives here is the architecture, the open-source stack, a hostable compose file for Bazzite, a PWA shell, and a Decky Loader plugin stub.

Repository: https://github.com/Memberoffoxhound/dialdeck

## Why not fork Stoat / Spacebar?

| Option | Why we did not start there |
| --- | --- |
| **Stoat** (ex-Revolt) | Closest Discord UX, but voice/video is not a 4K/120 path and multi-device “PC streams, phone talks” is not a first-class model. |
| **Spacebar** | Discord API clone. Voice is still the weak point; you inherit Discord’s constraints instead of designing media first. |
| **Matrix + Element** | Excellent federation. Heavy, and MatrixRTC is not built for high-refresh game streaming. |
| **Dialdeck** | Chat + identity + moderation we own. Media is LiveKit (Apache-2.0 SFU) so screen, mic, and camera are separate tracks that can come from different devices of the same user. |

## What you asked for → how we cover it

| Requirement | Approach |
| --- | --- |
| Spaces + unlimited rooms | Postgres model: `spaces` → `categories` → `rooms` (text / voice / stage). No artificial room cap. |
| Pictures, video, GIF + emoji search | Object storage (MinIO). Unicode + custom emoji. GIF search via pluggable providers (Klipy / Giphy optional keys) plus local uploads — Tenor’s public API is gone. |
| Users + avatars | Local accounts, invite links, avatar upload. |
| Admin: ban / kick / mute + reachability | Role permissions, audit log, admin **Reachability** panel (Tailscale / Cloudflare Tunnel / port-forward + Caddy TLS). |
| Multi-session (PC stream + phone mic) | One user, many **sessions**. Each session publishes only the tracks it owns. The UI groups them as one person. |
| Per-user local volume + I/O gain | Web Audio `GainNode` per remote participant. Input/output device + gain in settings. |
| Mic noise suppression | `@livekit/krisp-noise-filter` is proprietary cloud. We use **RNNoise WASM** (BSD, same family Jitsi uses) and optionally **dtln-rs**. |
| 4K 120 Hz video | Adaptive ladder. Full 4K120 is a **LAN + hardware-encode** target, not a phone-on-LTE promise. See [docs/MEDIA.md](docs/MEDIA.md). |
| Rich PWA | Installable, offline shell, Chrome + Safari desktop/mobile. |
| Bazzite + Steam Game Mode | `docker compose` on Bazzite desktop; **Decky** plugin embeds the PWA in Game Mode. |
| All deps open source | See [NOTICE](NOTICE). No proprietary SDKs required. |

## Honest note on 4K 120 Hz

Discord does not do 4K120. Browsers barely do.

- **4K 120** uncompressed is hundreds of Mbps. Encoded AV1/HEVC is still often **25–80+ Mbps** for game content.
- Chrome can *request* 120 fps from `getDisplayMedia`; encode + WebRTC + Safari clients will drop to what they can decode.
- Practical targets we design for:
  1. **WAN chat**: 720p30 / 1080p30 camera, Opus 48 kHz fullband.
  2. **WAN stream**: 1080p60 or 1440p60 with simulcast.
  3. **LAN / same house**: 4K60 default, **4K120** when the publisher has NVENC / AMD VCN / Intel Arc and viewers are on Chrome with a gigabit path.
- For actual game streaming, the high-res path should be **WHIP ingest** from a hardware encoder (Sunshine-style) into LiveKit Ingress — not only the browser capture path.

If someone on the call is on iPhone Safari, they get a lower simulcast layer. That is the correct product behavior.

## Stack (all open source)

| Layer | Choice | License |
| --- | --- | --- |
| PWA | Vite, React 19, TypeScript | MIT |
| API | Fastify, Postgres, Redis | MIT / PostgreSQL |
| Realtime chat | WebSocket (API) + optional LiveKit data channel for presence | — |
| Media SFU | [LiveKit](https://github.com/livekit/livekit) | Apache-2.0 |
| TURN | LiveKit embedded TURN or coturn | BSD |
| Noise cancel | [rnnoise-wasm](https://github.com/jitsi/rnnoise-wasm) | BSD |
| Files | MinIO | AGPL |
| Edge / TLS | Caddy | Apache-2.0 |
| Tunnel options | Tailscale, Cloudflare Tunnel (optional) | various OSS |
| Decky plugin | React + Python (Decky Loader) | LGPL-style loader; plugin AGPL |

## Repo layout

```
apps/web          PWA
apps/api          Auth, spaces, rooms, moderation, LiveKit tokens
apps/decky        Decky Loader plugin (Game Mode)
deploy/           Compose, Caddy, LiveKit config
docs/             Architecture, media, hosting, Decky
```

## Quick start (Bazzite / any Linux)

```bash
cp .env.example .env
# edit DOMAIN, secrets, and LIVEKIT keys
docker compose -f deploy/docker-compose.yml up -d
```

Then open `https://localhost` (or your domain). First account becomes the owner admin.

### Reachability for friends outside the house

1. **Easiest:** Tailscale / Headscale. Everyone on the tailnet, no ports opened.
2. **Public HTTPS:** Cloudflare Tunnel pointed at Caddy. No inbound ports.
3. **Classic:** forward 443/TCP + LiveKit RTC UDP range, Caddy issues Let’s Encrypt.

The admin UI is meant to walk through these instead of editing YAML by hand.

## Status

- [x] Name, charter, architecture
- [x] Compose stack + configs
- [x] PWA shell (login, spaces, rooms, session + volume UI)
- [x] API skeleton (auth, tokens, moderation hooks)
- [x] Decky plugin stub
- [ ] Persistence + real signup
- [ ] LiveKit room bind + RNNoise worklet
- [ ] Uploads, emoji, GIF picker
- [ ] Reachability wizard
- [ ] 4K120 publisher presets + WHIP ingest

## License

AGPL-3.0-or-later. If you run a modified Dialdeck as a network service, you share the source.
