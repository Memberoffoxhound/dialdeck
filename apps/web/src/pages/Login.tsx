import { useEffect, useState } from "react";
import type { Session } from "../App";

type Fun = {
  place: string;
  temp: number | null;
  wind: number | null;
  sky: string;
  days?: { day: string; hi: number; lo: number; take: string }[];
  news: { title: string; url: string }[];
};

export default function Login({
  device,
  onEnter
}: {
  device: string;
  onEnter: (s: Session) => void;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [fun, setFun] = useState<Fun | null>(null);

  useEffect(() => {
    void fetch("/api/fun")
      .then((r) => r.json())
      .then(setFun)
      .catch(() => {});
  }, []);

  async function enter() {
    setError("");
    const res = await fetch("/api/auth/guest", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, device })
    });
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      setError(body.error ?? "could not join");
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
      <section className="login-fun">
        <div className="weather-card">
          <span className="eyebrow">Mf&apos;n weather</span>
          <h2>{fun?.place ?? "Roxana, IL"}</h2>
          <div className="temp">{fun?.temp != null ? `${Math.round(fun.temp)}\u00b0` : "\u2014"}</div>
          <p>{fun?.sky ?? "Interrogating the sky..."}</p>
          {fun?.wind != null ? <small>Wind {Math.round(fun.wind)} mph, being extra</small> : null}
          <ul className="forecast">
            {(fun?.days ?? []).map((d) => (
              <li key={d.day}>
                <strong>
                  {Math.round(d.hi)}/{Math.round(d.lo)}
                </strong>
                <span>{d.take}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="news-card">
          <span className="eyebrow">Gaming wire</span>
          <ul>
            {(fun?.news ?? [{ title: "Loading headlines\u2026", url: "#" }]).map((n) => (
              <li key={n.title}>
                <a href={n.url} target="_blank" rel="noreferrer">
                  {n.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="login-card">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dialdeck</strong>
            <br />
            <small>Pick up the line</small>
          </div>
        </div>
        <h1>What should we call you?</h1>
        <p className="lede">No password for now. First name in owns the house.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enter();
          }}
        >
          <label>
            Display name
            <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          {error ? <div className="banner err">{error}</div> : null}
          <button className="primary" type="submit">
            Enter
          </button>
        </form>
        <div className="device-pill">this session \u00b7 {device}</div>
      </section>
    </div>
  );
}
