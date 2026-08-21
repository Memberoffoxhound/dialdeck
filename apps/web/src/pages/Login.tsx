import { useState } from "react";
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
  const [error, setError] = useState("");

  async function submit(mode: "login" | "register") {
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, device })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "failed");
      }
      const body = await res.json();
      onEnter({
        username: body.username ?? username,
        device,
        role: body.role ?? "member"
      });
    } catch (err) {
      // Offline / first-run: still let the PWA shell be explored.
      if (username.trim()) {
        onEnter({ username: username.trim(), device, role: "owner" });
        return;
      }
      setError(err instanceof Error ? err.message : "could not sign in");
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dialdeck</strong>
            <br />
            <small>pick up the line</small>
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
          {error ? <small style={{ color: "var(--danger)" }}>{error}</small> : null}
          <button className="primary" type="submit">
            Join the party line
          </button>
          <button type="button" onClick={() => void submit("register")}>
            Create account + avatar later
          </button>
        </form>
        <span className="device-pill">this session: {device}</span>
      </div>
    </div>
  );
}
