import { useEffect, useRef, useState } from "react";
import type { Session } from "../App";
import { usePartyLine } from "../usePartyLine";
import { clearCustomSound, notify, playSound, setCustomSound, type SoundKind } from "../sounds";

const EMOJI = ["🐺", "😄", "🔥", "✅", "👍", "🎮", "💚", "🚀"];

type Msg = { id?: string; who: string; text: string; at: string };
type Room = { id: string; name: string; kind: string };
type Space = { id: string; name: string; rooms: Room[] };
type Admin = {
  users: { id: string; username: string; role: string }[];
  bans: string[];
  mutes: string[];
};

export default function Shell({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState("home");
  const [room, setRoom] = useState("lounge");
  const [draft, setDraft] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [outputGain, setOutputGain] = useState(80);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [pop, setPop] = useState<"" | "voice" | "share" | "gear" | "admin">("");
  const [admin, setAdmin] = useState<Admin | null>(null);
  const seen = useRef(new Set<string>());
  const line = usePartyLine(session.device);
  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0];
  const staff = ["owner", "admin", "mod"].includes(session.role);

  useEffect(() => {
    void Notification.requestPermission?.();
  }, []);

  useEffect(() => {
    void fetch("/api/spaces", { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setSpaces(b.spaces ?? []));
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch(`/api/rooms/${room}/messages`, { credentials: "include" });
      if (!res.ok || stop) return;
      const next: Msg[] = (await res.json()).messages ?? [];
      next.forEach((m) => {
        if (m.id && !seen.current.has(m.id) && m.who !== session.username && seen.current.size) {
          notify(`${m.who}`, m.text, "chat");
        }
        if (m.id) seen.current.add(m.id);
      });
      setMessages(next);
    }
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [room, session.username]);

  useEffect(() => {
    line.setMasterOut(outputGain);
  }, [outputGain, line]);

  async function send() {
    if (!draft.trim()) return;
    const res = await fetch(`/api/rooms/${room}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: draft })
    });
    if (!res.ok) return;
    const msg = await res.json();
    setMessages((m) => [...m, msg]);
    setDraft("");
  }

  async function addRoom() {
    if (!space || !newRoom.trim()) return;
    const res = await fetch(`/api/spaces/${space.id}/rooms`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newRoom, kind: "text" })
    });
    if (!res.ok) return;
    const created = await res.json();
    setSpaces((ss) => ss.map((s) => (s.id === space.id ? { ...s, rooms: [...s.rooms, created] } : s)));
    setRoom(created.id);
    setNewRoom("");
  }

  async function openAdmin() {
    const res = await fetch("/api/admin", { credentials: "include" });
    if (res.ok) setAdmin(await res.json());
    setPop("admin");
  }

  async function mod(id: string, action: string) {
    await fetch(`/api/moderation/${id}/${action}`, { method: "POST", credentials: "include" });
    await openAdmin();
  }

  function onSoundFile(kind: SoundKind, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCustomSound(kind, String(reader.result));
    reader.readAsDataURL(file);
  }

  const videoPeers = line.peers.filter((p) => p.hasVideo || p.local);

  return (
    <div className="shell">
      <aside className="rail">
        {spaces.map((s) => (
          <button
            key={s.id}
            className={`space ${s.id === space?.id ? "active" : ""}`}
            title={s.name}
            onClick={() => setSpaceId(s.id)}
          >
            {s.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </aside>

      <aside className="channels">
        <div className="space-title">{space?.name ?? "Party line"}</div>
        <div className="cat">Rooms</div>
        {(space?.rooms ?? []).map((r) => (
          <button key={r.id} className={`room ${room === r.id || room === r.name ? "active" : ""}`} onClick={() => setRoom(r.id)}>
            <span className="hash">{r.kind === "voice" ? "◉" : "#"}</span> {r.name}
          </button>
        ))}
        <form
          className="add-room"
          onSubmit={(e) => {
            e.preventDefault();
            void addRoom();
          }}
        >
          <input placeholder="new topic" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
        </form>
        <div className="user-panel">
          <div className="avatar">{session.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{session.username}</strong>
            <div className="session-tag">
              {session.device} · {session.role}
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <strong># {space?.rooms.find((r) => r.id === room)?.name ?? room}</strong>
          <span className="dim">{line.status === "live" ? "on the line" : "idle"}</span>
        </header>

        <section className={`stage ${videoPeers.length ? "on" : ""}`}>
          {videoPeers.length === 0 ? (
            <div className="stage-empty">
              <h2>Stage is dark</h2>
              <p>Use the bar below to join voice, share a window, or put a camera up.</p>
            </div>
          ) : (
            <div className={`grid n${Math.min(videoPeers.length, 6)}`}>
              {videoPeers.map((p) => (
                <figure key={p.id} className={`tile ${p.local ? "you" : ""}`}>
                  <video autoPlay playsInline muted ref={(el) => line.bindVideo(p.id, el)} />
                  <figcaption>
                    {p.name} {p.hasAudio ? "· live" : ""}
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
          <input placeholder={`Message #${room}`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="primary">Send</button>
        </form>

        <div className="dock">
          <button className={line.live ? "live" : ""} onClick={() => setPop(pop === "voice" ? "" : "voice")}>
            Voice
          </button>
          <button onClick={() => setPop(pop === "share" ? "" : "share")}>Share</button>
          <button onClick={() => setPop(pop === "gear" ? "" : "gear")}>Gear</button>
          {staff ? (
            <button onClick={() => void openAdmin()}>Admin</button>
          ) : null}
          <button
            className="danger"
            onClick={() => {
              void line.leave();
              onLeave();
            }}
          >
            Leave
          </button>
        </div>

        {pop === "voice" ? (
          <div className="pop">
            <button className="primary" onClick={() => void line.joinMic()}>
              {line.live ? "Mic is live" : "Join voice"}
            </button>
            <button onClick={() => void line.leave()}>Disconnect</button>
          </div>
        ) : null}
        {pop === "share" ? (
          <div className="pop">
            <button onClick={() => void line.shareCamera()}>Camera</button>
            <button onClick={() => void line.shareWindow()}>Window / app</button>
            <button className="primary" onClick={() => void line.shareScreen()}>
              Full screen
            </button>
          </div>
        ) : null}
        {pop === "gear" ? (
          <div className="pop wide">
            <label>
              Microphone
              <select value={line.micId} onChange={(e) => line.setMicId(e.target.value)}>
                <option value="">Default</option>
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
                <option value="">Default</option>
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
                <option value="">Default</option>
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
            {line.peers
              .filter((p) => !p.local)
              .map((p) => (
                <label key={p.id}>
                  {p.name}
                  <input
                    type="range"
                    value={volumes[p.id] ?? 100}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolumes((prev) => ({ ...prev, [p.id]: v }));
                      line.setPeerVolume(p.id, v);
                    }}
                  />
                </label>
              ))}
            <div className="sound-row">
              {(["join", "chat", "share"] as SoundKind[]).map((k) => (
                <label key={k}>
                  {k} sound
                  <input type="file" accept="audio/*" onChange={(e) => onSoundFile(k, e.target.files?.[0])} />
                  <button type="button" onClick={() => playSound(k)}>
                    test
                  </button>
                  <button type="button" onClick={() => clearCustomSound(k)}>
                    default
                  </button>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {pop === "admin" && admin ? (
          <div className="pop wide admin">
            <h3>House keys</h3>
            {admin.users.map((u) => (
              <div className="admin-row" key={u.id}>
                <span>
                  {u.username} <em>{u.role}</em>
                  {admin.bans.includes(u.id) ? " · banned" : ""}
                  {admin.mutes.includes(u.id) ? " · muted" : ""}
                </span>
                <span className="admin-actions">
                  <button onClick={() => void mod(u.id, "kick")}>kick</button>
                  <button onClick={() => void mod(u.id, admin.bans.includes(u.id) ? "unban" : "ban")}>
                    {admin.bans.includes(u.id) ? "unban" : "ban"}
                  </button>
                  <button onClick={() => void mod(u.id, admin.mutes.includes(u.id) ? "unmute" : "mute")}>
                    {admin.mutes.includes(u.id) ? "unmute" : "mute"}
                  </button>
                  <button onClick={() => void mod(u.id, "reset")}>reset</button>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
