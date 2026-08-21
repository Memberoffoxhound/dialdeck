import { useMemo, useState } from "react";
import Login from "./pages/Login";
import Shell from "./pages/Shell";

export type Session = {
  username: string;
  device: string;
  role: string;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const deviceHint = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("device")) return q.get("device") as string;
    const ua = navigator.userAgent;
    if (/Mobile|iPhone|Android/i.test(ua)) return "phone";
    if (/Steam|Deck/i.test(ua)) return "deck";
    return "pc";
  }, []);

  if (!session) {
    return <Login device={deviceHint} onEnter={setSession} />;
  }
  return <Shell session={session} onLeave={() => setSession(null)} />;
}
