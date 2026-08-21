export const VIDEO_POLICY = {
  mode: "vbr-auto" as const,
  min: "480p",
  max: "1080p",
  fps: 60
};

export function publishOptions() {
  return {
    simulcast: true,
    videoEncoding: { maxBitrate: 4_500_000, maxFramerate: 60 },
    screenShareEncoding: { maxBitrate: 4_500_000, maxFramerate: 60 }
  };
}

/** Chrome/Edge: exclude this PWA from capture and do not record Dialdeck speakers. */
export function displayConstraints(surface: "monitor" | "window") {
  return {
    video: {
      displaySurface: surface,
      frameRate: { ideal: 60, max: 60 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      suppressLocalAudioPlayback: true
    },
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: "exclude",
    monitorTypeSurfaces: surface === "monitor" ? "include" : "exclude"
  } as DisplayMediaStreamOptions;
}
