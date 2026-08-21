import { useState } from "react";
import type { Session } from "../App";

const EMOJI = ["🐺", "😄", "🔥", "✅", "👍", "🎮", "💚", "🚀"];

type Msg = { who: string; text: string; at: string };

export default function Shell({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [room, setRoom] = useState("lounge");
  const [draft, setDraft] = useState("");
  const [gif, setGif] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      who: "dialdeck",
      text: "Spaces on the left. Unlimited rooms. This session is tagged so a PC stream and a phone mic can both be you.",
      at: "now"
    }
  ]);
  const [inCall, setInCall] = useState(false);
  const [inputGain, setInputGain] = useState(80);
  const [outputGain, setOutputGain] = useState(80);
  const [volumes, setVolumes] = useState({
    bruce_pc: 100,
    bruce_phone: 100,
    kit: 80
  });

  function send(text = draft) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { who: session.username, text, at: "now" }]);
    setDraft("");
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="space active" title="Foxhound House">
          FH
        </div>
        <div className="space" title="New space">
          +
        </div>
      </aside>
      <aside className="channels">
        <h2>Foxhound House</h2>
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
          {messages.map((m, i) => (
            <div className="msg" key={i}>
              <span className="who">{m.who}</span>
              <span className="meta">{m.at}</span>
              <div>{m.text}</div>
            </div>
          ))}
          {inCall ? (
            <div className="msg">
              <span className="who">media</span>
              <div>
                {session.device === "pc"
                  ? "This session would publish the 4K/120 ladder (simulcast). Phone sessions of the same user keep the mic."
                  : "This session would publish Opus + RNNoise and subscribe to everyone else’s tracks."}
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
            placeholder="GIF search (local + optional Klipy)"
            value={gif}
            onChange={(e) => setGif(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && gif.trim()) {
                send(`GIF · ${gif.trim()}`);
                setGif("");
              }
            }}
          />
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
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
          <div className="session-tag">RNNoise on · multi-session ready</div>
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
