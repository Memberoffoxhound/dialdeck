import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { AccessToken } from "livekit-server-sdk";

const DATA_DIR = process.env.DATA_DIR ?? "./data";
const STATE_FILE = path.join(DATA_DIR, "state.json");
const INVITE = process.env.INVITE_CODE ?? "family";
const OPEN = (process.env.REGISTRATION_OPEN ?? "true") === "true";
const STARTED = Date.now();

const VIDEO = {
  min: process.env.VIDEO_MIN ?? "480p",
  max: process.env.VIDEO_MAX ?? "1080p",
  fps: Number(process.env.VIDEO_FPS ?? 60),
  mode: process.env.VIDEO_MODE ?? "vbr-auto"
};

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });
await app.register(cookie);

function hashPassword(password, salt) {
  const used = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, used, 32).toString("hex");
  return { salt: used, hash };
}

function checkPassword(password, salt, hash) {
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

function seedState() {
  return {
    users: [],
    spaces: [
      {
        id: "home",
        name: "Party line",
        rooms: [
          { id: "lounge", name: "lounge", kind: "text" },
          { id: "ops", name: "ops", kind: "text" },
          { id: "party-line", name: "party-line", kind: "voice" }
        ]
      }
    ],
    messages: {},
    bans: [],
    mutes: [],
    sessions: {}
  };
}

let state = seedState();

async function load() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    state = { ...seedState(), ...JSON.parse(await readFile(STATE_FILE, "utf8")) };
  } catch {
    await save();
  }
}

async function save() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, avatar: u.avatar ?? null };
}

function currentUser(req) {
  const id = req.cookies.dd_user;
  return state.users.find((u) => u.id === id) ?? null;
}

await load();

app.get("/api/health", async () => ({ ok: true, name: "dialdeck" }));

app.get("/api/stats", async () => {
  const mem = process.memoryUsage();
  return {
    ok: true,
    name: "dialdeck",
    uptimeSec: Math.round((Date.now() - STARTED) / 1000),
    users: state.users.length,
    sessions: Object.keys(state.sessions).length,
    rooms: state.spaces.reduce((n, s) => n + s.rooms.length, 0),
    video: VIDEO,
    memoryMB: Math.round(mem.rss / 1024 / 1024)
  };
});

app.get("/api/meta", async () => ({
  name: "dialdeck",
  registrationOpen: OPEN,
  inviteRequired: true,
  spaceName: state.spaces[0]?.name ?? "Party line",
  video: VIDEO
}));

app.post("/api/auth/register", async (req, reply) => {
  if (!OPEN) return reply.code(403).send({ error: "registration closed" });
  const { username, password, invite, avatar, device } = req.body ?? {};
  if (!username || !password) {
    return reply.code(400).send({ error: "username and password required" });
  }
  if (!invite || invite.trim() !== INVITE) {
    return reply.code(403).send({ error: "bad invite code" });
  }
  if (state.users.some((u) => u.username.toLowerCase() === String(username).toLowerCase())) {
    return reply.code(409).send({ error: "username taken" });
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    salt,
    hash,
    avatar: avatar ?? null,
    role: state.users.length === 0 ? "owner" : "member"
  };
  state.users.push(user);
  const session = { id: crypto.randomUUID(), device: device ?? "unknown", createdAt: Date.now() };
  state.sessions[session.id] = { userId: user.id, ...session };
  await save();
  reply.setCookie("dd_user", user.id, { path: "/", httpOnly: true, sameSite: "lax" });
  reply.setCookie("dd_session", session.id, { path: "/", httpOnly: true, sameSite: "lax" });
  return { ...publicUser(user), session };
});

app.post("/api/auth/login", async (req, reply) => {
  const { username, password, device } = req.body ?? {};
  const user = state.users.find((u) => u.username === username);
  if (!user || !checkPassword(password ?? "", user.salt, user.hash)) {
    return reply.code(401).send({ error: "invalid credentials" });
  }
  if (state.bans.includes(user.id)) return reply.code(403).send({ error: "banned" });
  const session = { id: crypto.randomUUID(), device: device ?? "unknown", createdAt: Date.now() };
  state.sessions[session.id] = { userId: user.id, ...session };
  await save();
  reply.setCookie("dd_user", user.id, { path: "/", httpOnly: true, sameSite: "lax" });
  reply.setCookie("dd_session", session.id, { path: "/", httpOnly: true, sameSite: "lax" });
  return { ...publicUser(user), session };
});

app.get("/api/me", async (req, reply) => {
  const user = currentUser(req);
  if (!user) return reply.code(401).send({ error: "not signed in" });
  return publicUser(user);
});

app.get("/api/spaces", async (req, reply) => {
  if (!currentUser(req)) return reply.code(401).send({ error: "not signed in" });
  return { spaces: state.spaces };
});

app.get("/api/rooms/:roomId/messages", async (req, reply) => {
  if (!currentUser(req)) return reply.code(401).send({ error: "not signed in" });
  return { messages: state.messages[req.params.roomId] ?? [] };
});

app.post("/api/rooms/:roomId/messages", async (req, reply) => {
  const user = currentUser(req);
  if (!user) return reply.code(401).send({ error: "not signed in" });
  if (state.mutes.includes(user.id)) return reply.code(403).send({ error: "muted" });
  const text = String(req.body?.text ?? "").slice(0, 4000);
  if (!text.trim()) return reply.code(400).send({ error: "empty" });
  const msg = {
    id: crypto.randomUUID(),
    who: user.username,
    userId: user.id,
    text,
    at: new Date().toISOString()
  };
  state.messages[req.params.roomId] ??= [];
  state.messages[req.params.roomId].push(msg);
  await save();
  return msg;
});

app.post("/api/spaces/:spaceId/rooms", async (req, reply) => {
  const user = currentUser(req);
  if (!user || !['owner', 'admin'].includes(user.role)) {
    return reply.code(403).send({ error: "forbidden" });
  }
  const space = state.spaces.find((s) => s.id === req.params.spaceId);
  if (!space) return reply.code(404).send({ error: "space not found" });
  const room = {
    id: crypto.randomUUID(),
    name: req.body?.name ?? "room",
    kind: req.body?.kind ?? "text"
  };
  space.rooms.push(room);
  await save();
  return room;
});

app.post("/api/moderation/:userId/:action", async (req, reply) => {
  const actor = currentUser(req);
  if (!actor || !['owner', 'admin', 'mod'].includes(actor.role)) {
    return reply.code(403).send({ error: "forbidden" });
  }
  const { userId, action } = req.params;
  if (!state.users.some((u) => u.id === userId)) {
    return reply.code(404).send({ error: "no such user" });
  }
  if (action === "ban") state.bans = [...new Set([...state.bans, userId])];
  if (action === "unban") state.bans = state.bans.filter((id) => id !== userId);
  if (action === "mute") state.mutes = [...new Set([...state.mutes, userId])];
  if (action === "unmute") state.mutes = state.mutes.filter((id) => id !== userId);
  if (action === "kick") {
    for (const [sid, sess] of Object.entries(state.sessions)) {
      if (sess.userId === userId) delete state.sessions[sid];
    }
  }
  await save();
  return { userId, action, bans: state.bans, mutes: state.mutes };
});

app.post("/api/livekit/token", async (req, reply) => {
  const user = currentUser(req);
  if (!user) return reply.code(401).send({ error: "not signed in" });
  const { room, publish } = req.body ?? {};
  if (!room) return reply.code(400).send({ error: "room required" });
  const sessionId = req.cookies.dd_session ?? createHash("sha1").update(user.id).digest("hex").slice(0, 8);
  const identity = `${user.id}:${sessionId}`;
  const apiKey = process.env.LIVEKIT_API_KEY ?? "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? "secretsecretsecretsecretsecretsecre";
  const at = new AccessToken(apiKey, apiSecret, { identity, ttl: "12h", name: user.username });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: publish !== false && !state.mutes.includes(user.id),
    canSubscribe: true,
    canPublishData: true
  });
  return { token: await at.toJwt(), identity, video: VIDEO };
});

app.get("/api/reachability", async (req, reply) => {
  const user = currentUser(req);
  if (!user || user.role !== "owner") return reply.code(403).send({ error: "owner only" });
  return {
    mode: process.env.REACHABILITY_MODE ?? "local",
    publicUrl: process.env.PUBLIC_URL ?? "http://localhost:8080",
    inviteCode: INVITE,
    video: VIDEO,
    hints: [
      "local: friends on the same LAN use the printed LAN URL",
      "tailscale: install Tailscale on this box and on their phones",
      "public: put this host behind a domain and forward 8080 or 443"
    ]
  };
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
