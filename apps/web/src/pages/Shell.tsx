import { useEffect, useState } from "react";
import type { Session } from "../App";

const EMOJI = ["🐺", "😄", "🔥", "✅", "👍", "🎮", "💚", "🚀"];

type Msg = { id?: string; who: string; text: string; at: string };

export default function Shell({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [room, setRoom] = useState("lounge");
  const [draft, setDraft] = useState("");
  const [gif, setGif] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inCall, setInCall] = useState(false);
  const [inputGain, setInputGain] = useState(80);
  const [outputGain, setOutputGain] = useState(80);
  const [volumes, setVolumes] = useState({
    bruce_pc: 100,
    bruce_phone: 100,
    kit: 80
  });

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
          className={`room ${room === "party-line" ? "active" : ""}`}
          onClick={() => setRoom("party-line")}
        >
          ◉ party-line
        </button>
        <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
          <div className="session-tag">
            {session.username} · {session.device} · {session.role}
          </div>
          <button onClick={onLeave} style={{ marginTop: "0.4rem", width: "100%" }}>
            hang up
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <strong>{room === "party-line" ? "◉ party-line" : `# ${room}`}</strong>
          {room === "party-line" ? (
            <button className="primary" onClick={() => setInCall((v) => !v)}>
              {inCall ? "leave voice" : session.device === "pc" ? "publish screen" : "publish mic"}
            </button>
          ) : null}
        </div>
        <div className="messages">
          {messages.map((m) => (
            <div className="msg" key={m.id ?? `${m.who}-${m.at}-${m.text}`}>
              <span className="who">{m.who}</span>
              <span className="meta">{m.at}</span>
              <div>{m.text}</div>
            </div>
          ))}
          {inCall ? (
            <div className="msg">
              <span className="who">media</span>
              <div>
                Token path is live. Wire the LiveKit JS client next so this session publishes for real.
              </div>
            </div>
          ) : null}
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
          <div className="session-tag">same login on phone + PC = two sessions</div>
        </div>
        {Object.entries(volumes).map(([id, vol]) => (
          <div className="person" key={id}>
            <div>{id.replace("_", " · ")}</div>
            <input
              type="range"
              value={vol}
              onChange={(e) => setVolumes((v) => ({ ...v, [id]: Number(e.target.value) }))}
            />
          </div>
        ))}
      </aside>
    </div>
  );
}
