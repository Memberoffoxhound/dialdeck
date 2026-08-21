# Hosting on Bazzite

Dialdeck is meant to sit on the same box you game on.

## Resources

| Friends | CPU / RAM | Notes |
| --- | --- | --- |
| 2–4 on LAN | 2 cores / 4 GB besides the game | chat + 1080p60 |
| 4K share | GPU encode + gigabit | do not software-encode 4K120 |
| 8+ WAN | dedicated mini PC is happier | keep the game box for capture only |

## Bazzite notes

- Install Docker (or podman-compose) from Bazzite’s ujust / layered packages.
- Run compose in **Desktop Mode** so the stack stays up. Game Mode can sleep displays; do not let the session kill Docker.
- Bind LiveKit RTC ports on the physical NIC, not only localhost.
- If you use a VPN (Tailscale), set LiveKit `use_external_ip` carefully or advertise the tailnet IP.

## Reachability modes

### local

Caddy on `:443` with a local CA or `tls internal`. Fine for the house.

### tailscale

Run Tailscale on Bazzite. Share `https://bazzite.tailnet.ts.net`. No port forward, no Cloudflare. Best default for family.

### tunnel

`cloudflared` sidecar. Public hostname, origin stays dark. UDP WebRTC through Cloudflare is the catch — you will likely need LiveKit TURN over 443.

### public

Forward:

- 443/TCP — Caddy
- 7881/TCP — LiveKit RTC fallback
- 50000-60000/UDP — RTP

Set `LIVEKIT` `use_external_ip: true` and a real DNS name.

## Steam Game Mode

Use the Decky plugin (`apps/decky`) which opens the PWA in Steam’s CEF with mic permission. Pair with a desktop session that publishes the game view.

## Security

- First registered user is owner. Disable open registration after invites exist.
- Keep `.env` off the repo.
- Ban/kick/mute are server-enforced (LiveKit `RemoveParticipant` / track mute), not CSS tricks.
