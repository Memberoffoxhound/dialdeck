import { useEffect, useState } from "react";
import type { Session } from "../App";
import { usePartyLine } from "../usePartyLine";

const EMOJI = ["🐺", "😄", "🔥", "✅", "👍", "🎮", "💚", "🚀", "👏", "❤️"];

type Msg = { id?: string; who: string; text: string; at: string };

export default function Shell({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [room, setRoom] = useState("lounge");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [outputGain, setOutputGain] = useState(80);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const line = usePartyLine(session.device);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch(`/api/rooms/${room}/messages`, { credentials: "include" });
      if (!res.ok || stop) return;
      setMessages((await res.json()).messages ?? []);
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

  const videoPeers = line.peers.filter((p) => p.hasVideo || p.local);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="space active" title="Party line">
          PL
        </div>
        <div className="space ghost" title="more spaces later">
          +
        </div>
      </aside>

      <aside className="channels">
        <div className="space-title">Party line</div>
        <div className="cat">Text</div>
        {["lounge", "ops"].map((r) => (
          <button key={r} className={`room ${room === r ? "active" : ""}`} onClick={() => setRoom(r)}>
            <span className="hash">#</span> {r}
          </button>
        ))}
        <div className="cat">Voice</div>
        <button className={`room ${line.live ? "active live" : ""}`} onClick={() => setRoom("party-line")}>
          <span className="hash">◉</span> party-line
        </button>
        <div className="user-panel">
          <div className="avatar">{session.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{session.username}</strong>
            <div className="session-tag">
              {session.device} · {session.role}
            </div>
          </div>
          <button className="icon-btn" onClick={() => { void line.leave(); onLeave(); }} title="hang up">
            ⌁
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <strong>{room === "party-line" || line.live ? "party-line" : `# ${room}`}</strong>
            <span className="dim"> VBR 480p–1080p60</span>
          </div>
          <div className="actions">
            <button onClick={() => void line.joinMic()}>{line.live ? "mic on" : "join voice"}</button>
            <button onClick={() => void line.shareCamera()}>camera</button>
            <button onClick={() => void line.shareWindow()}>window</button>
            <button className="primary" onClick={() => void line.shareScreen()}>
              share screen
            </button>
            {line.live ? (
              <button className="danger" onClick={() => void line.leave()}>
                leave
              </button>
            ) : null}
          </div>
        </header>

        <section className={`stage ${videoPeers.length ? "on" : ""}`}>
          {videoPeers.length === 0 ? (
            <div className="stage-empty">
              <h2>Nobody is on camera yet</h2>
              <p>Share a window, a display, or your camera. Everyone on the line sees the same stage.</p>
            </div>
          ) : (
            <div className={`grid n${Math.min(videoPeers.length, 6)}`}>
              {videoPeers.map((p) => (
                <figure key={p.id} className={`tile ${p.local ? "you" : ""}`}>
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => line.bindVideo(p.id, el)}
                  />
                  <figcaption>
                    {p.name} {p.hasAudio ? "· audio" : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        <div className="messages">
          {line.error ? <div className="banner err">{line.error}</div> : null}
          {messages.map((m) => (
            <div className="msg" key={m.id ?? `${m.who}-${m.at}-${m.text}`}>
              <div className="avatar sm">{m.who.slice(0, 1).toUpperCase()}</div>
              <div>
                <span className="who">{m.who}</span>
                <span className="meta">{new Date(m.at).toLocaleTimeString()}</span>
                <div>{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="picker">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => setDraft((d) => d + e)}>
              {e}
            </button>
          ))}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input placeholder={`Message ${room}`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="primary">Send</button>
        </form>
      </main>

      <aside className="members">
        <h3>Voice &amp; video</h3>
        <label>
          Microphone
          <select value={line.micId} onChange={(e) => line.setMicId(e.target.value)}>
            <option value="">System default</option>
            {line.devices.mics.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "mic"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Camera
          <select value={line.camId} onChange={(e) => line.setCamId(e.target.value)}>
            <option value="">System default</option>
            {line.devices.cams.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "camera"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Output
          <select value={line.outId} onChange={(e) => void line.setOutput(e.target.value)}>
            <option value="">System default</option>
            {line.devices.outs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "speakers"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Master {outputGain}%
          <input type="range" value={outputGain} onChange={(e) => setOutputGain(Number(e.target.value))} />
        </label>
        <p className="hint">Share window or screen: Dialdeck speakers are kept out of the capture so you don’t get echo.</p>
        <h3>On the line</h3>
        {line.peers.map((p) => (
          <div className="person" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <div className="session-tag">
                {p.hasVideo ? "video" : ""} {p.hasAudio ? "audio" : "idle"}
              </div>
            </div>
            {!p.local ? (
              <input
                type="range"
                value={volumes[p.id] ?? 100}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolumes((prev) => ({ ...prev, [p.id]: v }));
                  line.setPeerVolume(p.id, v);
                }}
              />
            ) : null}
          </div>
        ))}
      </aside>
    </div>
  );
}
