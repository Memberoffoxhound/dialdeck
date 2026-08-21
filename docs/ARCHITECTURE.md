# Dialdeck architecture

```
                    ┌─ phone PWA ─── mic + earphones
                    │
Browser PWA ─── Caddy ─── API (Fastify) ── Postgres
   │              │              │              Redis
   │              │              ├─ LiveKit tokens
   │              ├─ /rtc ─── LiveKit SFU ─ TURN
   │                              │
Decky webview ──────────────────┈
                                             MinIO (uploads)
```

## Domain model

- **User** — account, avatar, presence.
- **Session** — one login on one device. Same user may have many live sessions.
- **Space** — Discord “server”. Owner + roles.
- **Room** — text, voice, or stage. Unlimited per space.
- **Message** — markdown, attachments, custom emoji, GIF refs.
- **Participant binding** — LiveKit identity `userId:sessionId` with metadata `{ userId, role: mic|screen|camera|mixed }`.

## Multi-session (the PC + phone case)

1. Desktop session joins the voice room and publishes **screen** (and optional system audio).
2. Phone session joins the *same* room as the same `userId` and publishes **microphone** only.
3. Other clients render one user card. Tracks are labeled by session (`Bruce · Deck`, `Bruce · Pixel`).
4. Local volume sliders attach to the *audio* track, not the user row.
5. Kick/mute operate on the user (all sessions) or a single session.

LiveKit already allows multiple participants with related identities. We do not force one peer connection per human.

## Chat vs media

Chat history must survive SFU restarts. Messages go through the API and Postgres. LiveKit data packets are for ephemeral things: typing, speaker activity, quick reactions.

## Permissions

Roles are space-scoped: `owner`, `admin`, `mod`, `member`.

| Action | member | mod | admin | owner |
| --- | --- | --- | --- | --- |
| Send messages, join voice | ✓ | ✓ | ✓ | ✓ |
| Mute locally (client only) | ✓ | ✓ | ✓ | ✓ |
| Server-mute / deafen | | ✓ | ✓ | ✓ |
| Kick | | ✓ | ✓ | ✓ |
| Ban, manage rooms | | | ✓ | ✓ |
| Reachability, invites, destroy space | | | | ✓ |

## Auth

Local email/username + password (Argon2id). Invite codes for family servers. Sessions are refresh cookies + device name. Multiple refresh tokens are first-class so a phone logout does not kill the PC stream.

No mandatory phone number. SSO can be added later (Authelia / Keycloak) without changing the user table.
