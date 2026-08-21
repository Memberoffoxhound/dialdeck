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
  const [spaceName, setSpaceName] = useState("Party line");

  useEffect(() => {
    void fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => setSpaceName(m.spaceName ?? "Party line"))
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
      <div className="login-art" aria-hidden="true" />
      <div className="login-card">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dialdeck</strong>
            <br />
            <small>{spaceName}</small>
          </div>
        </div>
        <h1>Pick up the line</h1>
        <p className="lede">Same handle on PC, phone, and Deck. First account owns the house.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("login");
          }}
        >
          <label>
            Handle
            <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Passphrase
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Invite <span>(new accounts)</span>
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="from INSTALL.txt" />
          </label>
          {error ? <div className="banner err">{error}</div> : null}
          <button className="primary" type="submit">
            Log in
          </button>
          <button type="button" className="ghost" onClick={() => void submit("register")}>
            Create account
          </button>
        </form>
        <div className="device-pill">this session · {device}</div>
      </div>
    </div>
  );
}
