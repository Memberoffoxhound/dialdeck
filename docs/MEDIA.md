# Media path

## Audio

- Codec: **Opus**, 48 kHz, stereo optional, FEC on.
- Target: 64–160 kbps music / 24–48 kbps speech.
- Capture: `getUserMedia` with `echoCancellation`, `autoGainControl` off when we drive our own gain, `noiseSuppression` off when RNNoise is active (avoid double processing).
- RNNoise WASM runs in an AudioWorklet *before* the track is published.
- Each listener has a per-participant `GainNode` (and a master output gain).

RNNoise is not Krisp. It is small, fast, and good at keyboard / fan / HVAC. It will not match Discord Nitro’s AI model. That is the open-source trade.

## Video ladder

Publish simulcast (and VP9/AV1 SVC where the browser allows):

| Layer | Resolution | FPS | Notes |
| --- | --- | --- | --- |
| q | 480p | 15–30 | phones, poor WAN |
| h | 720p | 30–60 | default WAN |
| f | 1080p–1440p | 60 | default desktop |
| x | 2160p | 60–120 | LAN only, hardware encode |

Constraints for a high-refresh share:

```js
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: {
    width: { ideal: 3840 },
    height: { ideal: 2160 },
    frameRate: { ideal: 120, max: 120 }
  },
  audio: true,
  preferCurrentTab: false
});
```

Expect Chrome on a powerful GPU to be the only client that *sends* 4K120. Safari should subscribe to `h` or `f`.

## Why an SFU

Mesh (everyone sends to everyone) dies at 4+ people with HD. An MCU transcodes and ruins 120 Hz. LiveKit is an SFU: one upload, selective forward. That is the only design that can approach 4K for a living room of friends.

## Game-mode path (Bazzite)

Browser capture of a fullscreen game is the weak path (DRM, cursor, compositor).

Preferred later milestone:

1. GPU encode on the host (VAAPI / NVENC).
2. WHIP publish into LiveKit Ingress.
3. PWA / Decky only handles chat, mic, and viewing.

Sunshine already speaks this language; we should ingest, not rewrite a game streamer.

## NAT

- Same LAN: host candidates, no TURN.
- Friends on the internet: UDP 50000–60000 to the SFU, or LiveKit TURN on 443.
- Symmetric NAT / hotel Wi-Fi: TURN/TCP or TLS.
