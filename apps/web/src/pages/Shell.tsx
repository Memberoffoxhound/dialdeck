import { useEffect, useState } from "react";
import type { Session } from "../App";
import { usePartyLine } from "../usePartyLine";

const EMOJI = ["🐺", "😄", "🔥", "✅", "👍", "🎮", "💚", "🚀"];

type Msg = { id?: string; who: string; text: string; at: string };

export default function Shell({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [room, setRoom] = useState("lounge");
  const [draft, setDraft] = useState("");
  const [gif, setGif] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputGain, setInputGain] = useState(80);
  const [outputGain, setOutputGain] = useState(80);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const line = usePartyLine(session.device);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch(`/api/rooms/${room}/messages`, { credentials: "include" });
      if (!res.ok || stop) return;
      const body = await res.json();
      setMessages(body.messages ?? []);
    }
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [room]);

  useEffect(() => {
    line.setMasterOut(outputGain);
  }, [outputGain, line]);

  async function send(text = draft) {
    if (!text.trim()) return;
    const res = await fetch(`/api/rooms/${room}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) return;
    const msg = await res.json();
    setMessages((m) => [...m, msg]);
    setDraft("");
  }

  async function toggleCall() {
    if (line.live) {
      await line.leave();
      return;
    }
    setRoom("party-line");
    try {
      await line.join();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="space active" title="Party line">
          PL
        </div>
      </aside>
      <aside className="channels">
        <h2>Party line</h2>
        <small style={{ color: "var(--dim)" }}>TEXT</small>
        {["lounge", "ops"].map((r) => (
          <button key={r} className={`room ${room === r ? "active" : ""}`} onClick={() => setRoom(r)}>
            # {r}
          </button>
        ))}
        <small style={{ color: "var(--dim)" }}>VOICE</small>
        <button
          className={`room ${room === "party-line" || line.live ? "active" : ""}`}
          onClick={() => setRoom("party-line")}
        >
          ◉ party-line {line.live ? `· ${line.status}` : ""}
        </button>
        <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
          <div className="session-tag">
            {session.username} · {session.device} · {session.role}
          </div>
          <button
            onClick={() => {
              void line.leave();
              onLeave();
            }}
            style={{ marginTop: "0.4rem", width: "100%" }}
          >
            hang up
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <strong>{room === "party-line" || line.live ? "◉ party-line" : `# ${room}`}</strong>
          <button className="primary" onClick={() => void toggleCall()}>
            {line.live
              ? "leave voice"
              : session.device === "pc"
                ? "share screen + join"
                : "join with mic"}
          </button>
        </div>
        <div id="dialdeck-stage" className="stage" hidden={!line.live} />
        <div className="messages">
          {line.error ? (
            <div className="msg">
              <span className="who">line</span>
              <div style={{ color: "var(--danger)" }}>{line.error}</div>
            </div>
          ) : null}
          {messages.map((m) => (
            <div className="msg" key={m.id ?? `${m.who}-${m.at}-${m.text}`}>
              <span className="who">{m.who}</span>
              <span className="meta">{m.at}</span>
              <div>{m.text}</div>
            </div>
          ))}
        </div>
        <div className="picker">
          {EMOJI.map((e) => (
            <button key={e} onClick={() => setDraft((d) => d + e)} type="button">
              {e}
            </button>
          ))}
          <input
            placeholder="GIF search (coming — uploads next)"
            value={gif}
            onChange={(e) => setGif(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && gif.trim()) {
                void send(`GIF · ${gif.trim()}`);
                setGif("");
              }
            }}
          />
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            placeholder={`Message ${room}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="primary">send</button>
        </form>
      </main>
      <aside className="members">
        <h3>Line mix</h3>
        <label>
          input {inputGain}
          <input type="range" value={inputGain} onChange={(e) => setInputGain(Number(e.target.value))} />
        </label>
        <label>
          output {outputGain}
          <input type="range" value={outputGain} onChange={(e) => setOutputGain(Number(e.target.value))} />
        </label>
        <div className="person">
          <strong>You · {session.device}</strong>
          <div className="session-tag">
            {line.live ? `on the line · ${line.status}` : "VBR 480p–1080p60 when you join"}
          </div>
        </div>
        {line.peers.map((p) => (
          <div className="person" key={p.id}>
            <div>
              {p.name} {p.hasVideo ? "· video" : ""} {p.hasAudio ? "· audio" : ""}
            </div>
            <input
              type="range"
              value={volumes[p.id] ?? 100}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolumes((prev) => ({ ...prev, [p.id]: v }));
                line.setPeerVolume(p.id, v);
              }}
            />
          </div>
        ))}
      </aside>
    </div>
  );
}
