import { useEffect, useState } from "react";
import type { Session } from "../App";

type Day = { day: string; hi: number; lo: number; icon?: string };
type Fun = {
  place: string;
  temp: number | null;
  wind: number | null;
  sky: string;
  icon?: string;
  days?: Day[];
  news: { title: string; url: string }[];
};

function weekday(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

async function locate() {
  const gps = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 2500, maximumAge: 600000 }
    );
  });
  if (gps) return { ...gps, city: "" };
  try {
    const ip = await fetch("https://ipwho.is/").then((r) => r.json());
    if (ip?.success && ip.latitude) {
      return {
        lat: ip.latitude,
        lon: ip.longitude,
        city: [ip.city, ip.region_code || ip.region, ip.country_code].filter(Boolean).join(", ")
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

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
    void (async () => {
      const loc = await locate();
      const hour = new Date().getHours();
      const q = new URLSearchParams();
      if (loc) {
        q.set("lat", String(loc.lat));
        q.set("lon", String(loc.lon));
        if (loc.city) q.set("city", loc.city);
      }
      q.set("isDay", hour >= 6 && hour < 20 ? "1" : "0");
      q.set("_", String(Date.now()));
      const res = await fetch(`/api/fun?${q}`, { cache: "no-store" });
      setFun(await res.json());
    })().catch(() => {});
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
          <h2>{fun?.place ?? "Finding you…"}</h2>
          <div className="now">
            <span className="wx-icon" aria-hidden>
              {fun?.icon ?? "…"}
            </span>
            <div className="temp">{fun?.temp != null ? `${Math.round(fun.temp)}\u00b0` : "\u2014"}</div>
          </div>
          <p className="roast">{fun?.sky ?? "Interrogating the sky…"}</p>
          {fun?.wind != null ? <small>Wind {Math.round(fun.wind)} mph</small> : null}
          <ul className="forecast">
            {(fun?.days ?? []).map((d) => (
              <li key={d.day}>
                <span className="wx-icon day">{d.icon ?? "☁\ufe0f"}</span>
                <em>{weekday(d.day)}</em>
                <strong>
                  {Math.round(d.hi)}/{Math.round(d.lo)}
                </strong>
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
