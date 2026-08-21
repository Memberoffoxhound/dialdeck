# Media path

## Audience video (current ship target)

VBR with **auto resolution**. Publisher sends three layers; LiveKit forwards the best layer each viewer can take.

| Layer | Size | Max fps | VBR ceiling |
| --- | --- | --- | --- |
| q | 854×480 | 30 | 1.0 Mbps |
| h | 1280×720 | 60 | 2.5 Mbps |
| f | 1920×1080 | 60 | 4.5 Mbps |

`maxBitrate` in WebRTC is a ceiling, not CBR. Dynacast / adaptiveStream drop or pick layers from RTT and loss. Phones get `q` or `h`. A LAN Chrome viewer can take `f`.

Presets live in `apps/web/src/media.ts`. Do not request 4K/120 until this ladder is solid.

## Audio

- Opus 48 kHz.
- RNNoise WASM before publish (next slice).
- Per-listener GainNode.

## Why an SFU

Mesh dies with HD. An MCU transcodes and ruins 60 fps. LiveKit forwards layers.
