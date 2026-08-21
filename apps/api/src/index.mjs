import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { AccessToken } from "livekit-server-sdk";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });
await app.register(cookie);
await app.register(websocket);

const users = new Map();
const spaces = new Map();
const bans = new Set();
const mutes = new Set();

function seed() {
  if (spaces.size) return;
  spaces.set("home", {
    id: "home",
    name: "Foxhound House",
    rooms: [
      { id: "lounge", name: "lounge", kind: "text" },
      { id: "ops", name: "ops", kind: "text" },
      { id: "party-line", name: "party-line", kind: "voice" }
    ]
  });
}
seed();

app.get("/api/health", async () => ({ ok: true, name: "dialdeck" }));

app.post("/api/auth/register", async (req, reply) => {
  const { username, password, avatar } = req.body ?? {};
  if (!username || !password) {
    return reply.code(400).send({ error: "username and password required" });
  }
  if ([...users.values()].some((u) => u.username === username)) {
    return reply.code(409).send({ error: "username taken" });
  }
  const user = {
    id: crypto.randomUUID(),
    username,
    password,
    avatar: avatar ?? null,
    role: users.size === 0 ? "owner" : "member",
    sessions: []
  };
  users.set(user.id, user);
  reply.setCookie("dd_user", user.id, { path: "/", httpOnly: true, sameSite: "lax" });
  return { id: user.id, username: user.username, role: user.role };
});

app.post("/api/auth/login", async (req, reply) => {
  const { username, password, device } = req.body ?? {};
  const user = [...users.values()].find((u) => u.username === username && u.password === password);
  if (!user) return reply.code(401).send({ error: "invalid credentials" });
  if (bans.has(user.id)) return reply.code(403).send({ error: "banned" });
  const session = {
    id: crypto.randomUUID(),
    device: device ?? "unknown",
    createdAt: Date.now()
  };
  user.sessions.push(session);
  reply.setCookie("dd_user", user.id, { path: "/", httpOnly: true, sameSite: "lax" });
  reply.setCookie("dd_session", session.id, { path: "/", httpOnly: true, sameSite: "lax" });
  return { id: user.id, username: user.username, role: user.role, session };
});

app.get("/api/spaces", async () => ({ spaces: [...spaces.values()] }));

app.post("/api/spaces/:spaceId/rooms", async (req, reply) => {
  const space = spaces.get(req.params.spaceId);
  if (!space) return reply.code(404).send({ error: "space not found" });
  const { name, kind } = req.body ?? {};
  const room = { id: crypto.randomUUID(), name: name ?? "room", kind: kind ?? "text" };
  space.rooms.push(room);
  return room;
});

app.post("/api/moderation/:userId/:action", async (req, reply) => {
  const { userId, action } = req.params;
  if (!users.has(userId)) return reply.code(404).send({ error: "no such user" });
  if (action === "ban") bans.add(userId);
  if (action === "unban") bans.delete(userId);
  if (action === "mute") mutes.add(userId);
  if (action === "unmute") mutes.delete(userId);
  if (action === "kick") {
    const user = users.get(userId);
    user.sessions = [];
  }
  return { userId, action, bans: [...bans], mutes: [...mutes] };
});

app.post("/api/livekit/token", async (req, reply) => {
  const { room, identity, publish } = req.body ?? {};
  if (!room || !identity) return reply.code(400).send({ error: "room and identity required" });
  const apiKey = process.env.LIVEKIT_API_KEY ?? "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? "secretsecretsecretsecretsecretsecre";
  const at = new AccessToken(apiKey, apiSecret, { identity, ttl: "12h" });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: publish !== false,
    canSubscribe: true,
    canPublishData: true
  });
  return { token: await at.toJwt() };
});

app.get("/api/reachability", async () => ({
  mode: process.env.REACHABILITY_MODE ?? "local",
  publicUrl: process.env.PUBLIC_URL ?? "https://localhost",
  livekit: process.env.LIVEKIT_WS_URL ?? "wss://localhost/rtc",
  hints: [
    "local: Caddy on this machine, friends must be on the LAN",
    "tailscale: share the MagicDNS name, best for family",
    "tunnel: Cloudflare Tunnel + TURN on 443",
    "public: forward 443/tcp and 50000-50100/udp"
  ]
}));

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
