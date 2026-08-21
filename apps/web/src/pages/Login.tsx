import { useEffect, useState } from "react";
import type { Session } from "../App";

export default function Login({
  device,
  onEnter
}: {
  device: string;
  onEnter: (s: Session) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [spaceName, setSpaceName] = useState("Dialdeck");

  useEffect(() => {
    void fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => setSpaceName(m.spaceName ?? "Dialdeck"))
      .catch(() => {});
  }, []);

  async function submit(mode: "login" | "register") {
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, invite, device })
    });
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      setError(body.error ?? "could not sign in");
      return;
    }
    onEnter({
      username: body.username ?? username,
      device,
      role: body.role ?? "member"
    });
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dialdeck</strong>
            <br />
            <small>{spaceName} · pick up the line</small>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("login");
          }}
        >
          <input
            autoComplete="username"
            placeholder="handle"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="passphrase"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            placeholder="invite code (new accounts)"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
          />
          {error ? <small style={{ color: "var(--danger)" }}>{error}</small> : null}
          <button className="primary" type="submit">
            Join the party line
          </button>
          <button type="button" onClick={() => void submit("register")}>
            Create account
          </button>
        </form>
        <span className="device-pill">this session: {device}</span>
      </div>
    </div>
  );
}
