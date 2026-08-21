# Tailscale for Dialdeck

Bazzite already ships Tailscale. The installer asks whether family needs off-LAN access, then:

1. `ujust enable-tailscale` (or the official install script if the CLI is missing)
2. `sudo tailscale up --operator=$USER` — you open the login URL and approve the box
3. Optional `tailscale serve --bg 8080` — HTTPS on `https://<machine>.<tailnet>.ts.net`

No router ports. LiveKit signaling goes through that HTTPS URL; media uses the tailnet 100.x addresses.

## Family devices

1. Install [Tailscale](https://tailscale.com/download) on each phone/PC
2. Log into the **same** tailnet as the Bazzite box
3. Open the Share URL from `~/.local/share/dialdeck/INSTALL.txt`
4. Create account + invite code

## Re-run just the VPN step

```bash
~/.local/share/dialdeck/scripts/configure-tailscale.sh
```
