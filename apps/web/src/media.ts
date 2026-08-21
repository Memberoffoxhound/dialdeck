/** Audience video: VBR, auto layer 480p–1080p60. WebRTC maxBitrate is the VBR ceiling. */
export const VIDEO_POLICY = {
  mode: "vbr-auto" as const,
  min: "480p",
  max: "1080p",
  fps: 60
};

export const SIMULCAST_LAYERS = {
  q: {
    width: 854,
    height: 480,
    encoding: { maxBitrate: 1_000_000, maxFramerate: 30 }
  },
  h: {
    width: 1280,
    height: 720,
    encoding: { maxBitrate: 2_500_000, maxFramerate: 60 }
  },
  f: {
    width: 1920,
    height: 1080,
    encoding: { maxBitrate: 4_500_000, maxFramerate: 60 }
  }
};

export function screenShareConstraints() {
  return {
    video: {
      width: { min: 854, ideal: 1920, max: 1920 },
      height: { min: 480, ideal: 1080, max: 1080 },
      frameRate: { min: 24, ideal: 60, max: 60 }
    },
    audio: true
  };
}

export function publishOptions() {
  return {
    simulcast: true,
    videoEncoding: SIMULCAST_LAYERS.f.encoding,
    screenShareEncoding: SIMULCAST_LAYERS.f.encoding
  };
}
