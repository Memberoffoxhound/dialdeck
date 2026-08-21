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
import { callable, definePlugin, toaster } from "@decky/api";
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

const getSettings = callable<[], Settings>("get_settings");
const setSettings = callable<[Record<string, unknown>], Settings>("set_settings");
const health = callable<[], { ok: boolean; error?: string }>("health");

function joinUrl(base: string) {
  const u = new URL(base);
  u.searchParams.set("device", "deck");
  u.searchParams.set("role", "talker");
  return u.toString();
}

function Fullscreen() {
  const [src, setSrc] = useState("https://localhost");
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

function Panel() {
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [status, setStatus] = useState("checking…");

  async function refresh() {
    const s = await getSettings();
    setCfg(s);
    const h = await health();
    setStatus(h.ok ? "line is up" : `down · ${h.error ?? "unreachable"}`);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function patch(partial: Partial<Settings>) {
    if (!cfg) return;
    const next = await setSettings(partial);
    setCfg(next);
  }

  if (!cfg) {
    return (
      <PanelSection title="Party line">
        <PanelSectionRow>Loading…</PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <>
      <PanelSection title="Party line">
        <PanelSectionRow>
          <div>{status}</div>
        </PanelSectionRow>
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
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => void refresh()}>
            Recheck line
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title="Sessions">
        <PanelSectionRow>
          Deck = {cfg.role}. Publish 4K from the PC session. Phone can own the mic if CEF blocks capture.
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  toaster.toast({ title: "Dialdeck", body: "Party line plugin loaded" });

  return {
    name: "Dialdeck",
    titleView: <div className={staticClasses.Title}>Dialdeck</div>,
    content: <Panel />,
    icon: <FaPhoneAlt />,
    onDismount() {
      // routerHook.removeRoute("/dialdeck") if you registered it here
    }
  };
});
