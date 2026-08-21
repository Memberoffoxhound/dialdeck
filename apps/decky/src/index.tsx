import { useEffect, useState } from "react";
import {
  ButtonItem,
  DropdownItem,
  Navigation,
  PanelSection,
  PanelSectionRow,
  SliderField,
  TextField,
  ToggleField,
  staticClasses
} from "@decky/ui";
import { callable, definePlugin, routerHook, toaster } from "@decky/api";
import { FaPhoneAlt } from "react-icons/fa";

type Settings = {
  url: string;
  device: string;
  role: "talker" | "watcher";
  room: string;
  input_gain: number;
  output_gain: number;
  muted: boolean;
};

type Stats = {
  ok: boolean;
  quality: string;
  rtt_ms: number | null;
  host?: string;
  bandwidth?: { iface?: string | null; rx_mbps: number; tx_mbps: number };
  api?: {
    users?: number;
    sessions?: number;
    video?: { min: string; max: string; fps: number; mode: string };
    memoryMB?: number;
    error?: string;
  };
};

const getSettings = callable<[], Settings>("get_settings");
const setSettings = callable<[Record<string, unknown>], Settings>("set_settings");
const serverStats = callable<[], Stats>("server_stats");

function joinUrl(base: string) {
  const u = new URL(base);
  u.searchParams.set("device", "deck");
  u.searchParams.set("role", "talker");
  return u.toString();
}

function Fullscreen() {
  const [src, setSrc] = useState("http://127.0.0.1:8080");
  useEffect(() => {
    void getSettings().then((s) => setSrc(joinUrl(s.url)));
  }, []);
  return (
    <div style={{ width: "100%", height: "100%", background: "#07080c" }}>
      <iframe
        title="Dialdeck"
        src={src}
        allow="microphone; autoplay; clipboard-read; clipboard-write"
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}

function qualityColor(q: string) {
  if (q === "excellent") return "#7cffb2";
  if (q === "good") return "#e8ff6a";
  if (q === "fair") return "#ffb347";
  return "#ff5d7a";
}

function Panel() {
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  async function refresh() {
    const s = await getSettings();
    setCfg(s);
    try {
      setStats(await serverStats());
    } catch {
      setStats({ ok: false, quality: "down", rtt_ms: null });
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, []);

  async function patch(partial: Partial<Settings>) {
    if (!cfg) return;
    setCfg(await setSettings(partial));
  }

  if (!cfg) {
    return (
      <PanelSection title="Party line">
        <PanelSectionRow>Loading…</PanelSectionRow>
      </PanelSection>
    );
  }

  const q = stats?.quality ?? "down";
  const bw = stats?.bandwidth;

  return (
    <>
      <PanelSection title="Server">
        <PanelSectionRow>
          <div style={{ color: qualityColor(q), fontWeight: 700 }}>
            {q.toUpperCase()}
            {stats?.rtt_ms != null ? ` · ${stats.rtt_ms} ms` : ""}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div>
            {bw
              ? `${bw.iface ?? "nic"}  ↓ ${bw.rx_mbps} Mb/s  ↑ ${bw.tx_mbps} Mb/s`
              : "bandwidth …"}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div>
            {stats?.api?.users ?? "—"} users · {stats?.api?.sessions ?? "—"} sessions
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div>video {stats?.api?.video?.mode ?? "vbr-auto"} 480p–1080p60</div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => void refresh()}>
            Refresh stats
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title="Party line">
        <PanelSectionRow>
          <TextField
            label="Dialdeck URL"
            value={cfg.url}
            onChange={(e) => void patch({ url: e.target.value })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="This Deck"
            selectedOption={cfg.role}
            rgOptions={[
              { data: "talker", label: "Talker (mic)" },
              { data: "watcher", label: "Watcher (no mic)" }
            ]}
            onChange={(v) => void patch({ role: v.data })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Mute"
            checked={cfg.muted}
            onChange={(muted) => void patch({ muted })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            label="Input"
            value={cfg.input_gain}
            min={0}
            max={100}
            step={1}
            onChange={(input_gain) => void patch({ input_gain })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            label="Output"
            value={cfg.output_gain}
            min={0}
            max={100}
            step={1}
            onChange={(output_gain) => void patch({ output_gain })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              Navigation.Navigate("/dialdeck");
              Navigation.CloseSideMenus();
            }}
          >
            Open Dialdeck
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  routerHook.addRoute("/dialdeck", Fullscreen, { exact: true });
  toaster.toast({ title: "Dialdeck", body: "Party line plugin loaded" });
  return {
    name: "Dialdeck",
    titleView: <div className={staticClasses.Title}>Dialdeck</div>,
    content: <Panel />,
    icon: <FaPhoneAlt />,
    onDismount() {
      routerHook.removeRoute("/dialdeck");
    }
  };
});
