const KEY = "dialdeck-sounds";

export type SoundKind = "join" | "chat" | "share";

type Pack = Partial<Record<SoundKind, string>>;

function load(): Pack {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getCustomSounds(): Pack {
  return load();
}

export function setCustomSound(kind: SoundKind, dataUrl: string) {
  const next = { ...load(), [kind]: dataUrl };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearCustomSound(kind: SoundKind) {
  const next = load();
  delete next[kind];
  localStorage.setItem(KEY, JSON.stringify(next));
}

function beep(freq: number, dur: number, type: OscillatorType = "sine") {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.stop(ctx.currentTime + dur);
  osc.onended = () => void ctx.close();
}

const defaults: Record<SoundKind, () => void> = {
  join: () => {
    beep(520, 0.12);
    setTimeout(() => beep(780, 0.14), 90);
  },
  chat: () => beep(880, 0.08, "triangle"),
  share: () => {
    beep(360, 0.1, "square");
    setTimeout(() => beep(540, 0.16, "square"), 100);
  }
};

export function playSound(kind: SoundKind) {
  const custom = load()[kind];
  if (custom) {
    const a = new Audio(custom);
    a.volume = 0.5;
    void a.play();
    return;
  }
  defaults[kind]();
}

export function notify(title: string, body: string, kind: SoundKind) {
  playSound(kind);
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
}
