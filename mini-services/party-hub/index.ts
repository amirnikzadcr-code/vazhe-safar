/* ------------------------------------------------------------------
 * واژه‌سفر — party-hub (دورهمی وای‌فای)
 * A tiny room hub for the WiFi party mode: players on DIFFERENT
 * phones join one room (4-char code) through the same network /
 * gateway and race on the SAME letter wheel in real time.
 *
 * Design notes (session AB, user: «کاربرا به‌ینفر وصل شن … ب هم
 * کانکت شن و بازی کنن و خودت این قسمت خوب بلدی بچین معماریش»):
 *   • The hub is the AUTHORITY for rooms, rosters, word claims and
 *     scores — clients never trust each other.
 *   • The wheel payload (letters + valid words) is chosen by the HOST
 *     client (it owns the level data) and deposited here at
 *     `round:load`; validity of each claimed word is checked by the
 *     claiming client against its identical bundled lexicon, the hub
 *     only arbitrates OWNERSHIP (first claim wins).
 *   • Host migration: if the host leaves, the next player becomes the
 *     host — the game never dies because one phone walked away.
 * ------------------------------------------------------------------ */
import { Server } from "socket.io";

const PORT = 3003;
const MAX_PLAYERS = 6;
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L look-alikes

interface P {
  id: string;
  name: string;
  avatar: string;
  score: number;
}
interface Wheel {
  ls: string[];        // ring letters (ordered seats)
  words: string[];     // informational payload (not used for scoring)
}
interface Room {
  code: string;
  hostId: string;
  players: Map<string, P>;
  /* v5 BB — member memory (name-keyed): keeps the score/avatar of
   * everyone who ever joined so a transient WiFi blip can REJOIN
   * mid-match with the score intact. Cleaned on room teardown. */
  members: Map<string, { avatar: string; score: number }>;
  phase: "lobby" | "round" | "review" | "over";
  rounds: number;
  seconds: number;
  round: number;
  wheel: Wheel | null;
  claimed: Map<string, string>; // word -> playerId
}

const rooms = new Map<string, Room>();
const roomOf = new Map<string, string>(); // socketId -> roomCode

const LOG = (...a: unknown[]) => console.log("[hub]", new Date().toISOString().slice(11,19), ...a);

const rid = () => Math.random().toString(36).slice(2, 10);
const newCode = () => {
  for (let t = 0; t < 60; t++) {
    let c = "";
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  return "W" + Date.now().toString(36).slice(-3).toUpperCase();
};

const roster = (r: Room) =>
  [...r.players.values()].map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score }));

/** the one state snapshot everyone renders from */
function state(r: Room) {
  return {
    code: r.code,
    phase: r.phase,
    hostId: r.hostId,
    rounds: r.rounds,
    seconds: r.seconds,
    round: r.round,
    players: roster(r),
    // the wheel letters are public during a round; the word list NEVER
    // leaves the hub (no spoilers on a cheating device's screen)
    wheel: r.phase === "round" && r.wheel ? { ls: r.wheel.ls } : null,
  };
}

function broadcast(r: Room, event: string, payload?: unknown) {
  const io = getIo();
  for (const p of r.players.keys()) io.to(p).emit(event, payload ?? null);
  io.to(r.code).emit("room:state", state(r));
}

/* socket.io binds lazily — broadcast needs the instance */
let _io: Server | null = null;
function getIo(): Server {
  if (!_io) throw new Error("io not ready");
  return _io;
}

/* v5 BB — bun --hot used to re-execute this module in the SAME process,
 * binding a second engine.io on :3003 (SO_REUSEPORT) → kernel split
 * create/join across two module states → «اتاقی با این کد پیدا نشد».
 * The singleton guard + plain `bun index.ts` (package.json) make the
 * boot single-instance by construction. */
const G = globalThis as typeof globalThis & { __vzPartyHub?: Server };
if (G.__vzPartyHub) {
  console.log("[party-hub] already listening — skipping re-init");
} else {
const io = new Server(PORT, {
  cors: { origin: "*" },
  pingInterval: 20000,
  pingTimeout: 25000,
});
_io = io;
G.__vzPartyHub = io;

io.on("connection", (s) => {
  LOG("connect", s.id);
  let name = "مسافر";
  let avatar = "cat";

  s.on("hello", (h: { name?: string; avatar?: string }) => {
    name = String(h?.name ?? "").trim().slice(0, 14) || "مسافر";
    avatar = String(h?.avatar ?? "cat").slice(0, 12);
  });

  /* ── room lifecycle ── */
  s.on("room:create", (...args: unknown[]) => {
    /* tolerant signature: works with (ack), (null, ack) and (arg, ack) */
    const ack = args.find((a) => typeof a === "function") as undefined | ((res: unknown) => void);
    leaveRoom(s);
    const code = newCode();
    const r: Room = {
      code, hostId: s.id,
      players: new Map(),
      members: new Map(),
      phase: "lobby",
      rounds: 3, seconds: 60,
      round: 0, wheel: null, claimed: new Map(),
    };
    r.players.set(s.id, { id: s.id, name, avatar, score: 0 });
    r.members.set(name, { avatar, score: 0 });
    rooms.set(code, r);
    roomOf.set(s.id, code);
    LOG("create", code, "by", s.id, "total:", rooms.size);
    s.join(code);
    ack?.({ ok: true, code });
    /* ONLY the creator learns their id — a room-wide broadcast would
     * overwrite every other member's yourId (host-control killer!) */
    getIo().to(s.id).emit("room:hello", { yourId: s.id });
    getIo().to(s.id).emit("room:state", state(r));
  });

  s.on("room:join", (arg: { code?: string }, ack?: (res: unknown) => void) => {
    const code = String(arg?.code ?? "").trim().toUpperCase();
    const r = rooms.get(code);
    LOG("join attempt", code, "found:", !!r, "total:", rooms.size, "codes:", [...rooms.keys()].join(","));
    if (!r) return ack?.({ ok: false, error: "اتاقی با این کد پیدا نشد" });
    const mem = r.members.get(name);
    if (r.phase !== "lobby" && !mem)
      return ack?.({ ok: false, error: "این بازی شروع شده — بعدی!" });
    if (r.players.size >= MAX_PLAYERS && !mem)
      return ack?.({ ok: false, error: "اتاق پر است (حداکثر ۶ نفر)" });
    leaveRoom(s);
    /* v5 BB — REJOIN: the same name returning mid-match resumes with
     * its saved score; in a fresh lobby it (re)enters with score 0. */
    const p: P = { id: s.id, name, avatar, score: r.phase !== "lobby" && mem ? mem.score : 0 };
    r.players.set(s.id, p);
    r.members.set(name, { avatar, score: p.score });
    roomOf.set(s.id, code);
    s.join(code);
    ack?.({ ok: true, code });
    broadcast(r, "player:joined", { id: s.id });
    getIo().to(s.id).emit("room:hello", { yourId: s.id });
    /* mid-match rejoin: hand back the live round so the phone resumes */
    if (r.phase === "round" && r.wheel) {
      getIo().to(s.id).emit("round:began", {
        round: r.round, of: r.rounds, ls: r.wheel.ls, seconds: r.seconds,
      });
    }
  });

  /* ── lobby ── */
  s.on("cfg:set", (arg: { rounds?: number; seconds?: number }) => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r || r.hostId !== s.id || r.phase !== "lobby") return;
    if (arg?.rounds) r.rounds = Math.max(1, Math.min(6, Math.round(arg.rounds)));
    if (arg?.seconds) r.seconds = Math.max(30, Math.min(120, Math.round(arg.seconds)));
    broadcast(r, "room:cfg", { rounds: r.rounds, seconds: r.seconds });
  });

  /* ── round flow (host-authoritative) ── */
  s.on("round:load", (arg: { wheel?: Wheel }) => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r || r.hostId !== s.id) return;
    const ls = Array.isArray(arg?.wheel?.ls) ? arg.wheel.ls.map((c) => String(c).slice(0, 2)) : null;
    if (!ls || ls.length < 5 || ls.length > 12) return;
    r.wheel = { ls, words: [] };
    r.claimed = new Map();
    r.round += 1;
    r.phase = "round";
    broadcast(r, "round:began", { round: r.round, of: r.rounds, ls, seconds: r.seconds });
  });

  s.on("word:claim", (arg: { word?: string }) => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r || r.phase !== "round" || !r.wheel) return;
    const w = String(arg?.word ?? "").trim();
    if (w.length < 2) return;
    if (r.claimed.has(w)) {
      s.emit("word:taken", { word: w });
      return;
    }
    r.claimed.set(w, s.id);
    const p = r.players.get(s.id);
    if (p) {
      p.score += w.length * 10; // hub-computed: len×10, first owner keeps it
      const m = r.members.get(p.name);
      if (m) m.score = p.score;  /* keep the resume memory in sync */
    }
    broadcast(r, "word:scored", {
      pid: s.id, word: w, pts: w.length * 10,
      scores: roster(r).map((x) => ({ id: x.id, score: x.score })),
      claimedCount: r.claimed.size,
    });
  });

  s.on("round:end", () => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r || r.hostId !== s.id || r.phase !== "round") return;
    r.phase = "review";
    const claimed = [...r.claimed.entries()].map(([word, pid]) => ({ word, pid }));
    broadcast(r, "round:review", { round: r.round, claimed, players: roster(r) });
  });

  s.on("game:end", () => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r || r.hostId !== s.id) return;
    r.phase = "over";
    broadcast(r, "game:over", { players: roster(r) });
  });

  s.on("game:rematch", () => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r || r.hostId !== s.id) return;
    r.phase = "lobby";
    r.round = 0;
    r.wheel = null;
    r.claimed = new Map();
    for (const p of r.players.values()) p.score = 0;
    for (const m of r.members.values()) m.score = 0;
    broadcast(r, "room:rematch", null);
  });

  /* ── fun ── */
  s.on("react", (arg: { emoji?: string }) => {
    const r = rooms.get(roomOf.get(s.id) ?? "");
    if (!r) return;
    const emoji = String(arg?.emoji ?? "").slice(0, 8);
    if (!emoji) return;
    getIo().to(r.code).emit("react", { pid: s.id, emoji });
  });

  /* ── teardown ── */
  s.on("leave", () => leaveRoom(s));
  s.on("disconnect", (reason) => { LOG("disconnect", s.id, reason); leaveRoom(s); });
});

function leaveRoom(s: { id: string; rooms?: Set<string> }) {
  const code = roomOf.get(s.id);
  if (!code) return;
  roomOf.delete(s.id);
  const r = rooms.get(code);
  if (!r) return;
  const wasHost = r.hostId === s.id;
  r.players.delete(s.id);
  try { getIo().sockets.sids.delete(s.id); } catch { /* noop */ }
  if (r.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (wasHost) {
    r.hostId = [...r.players.keys()][0];
    getIo().to(code).emit("host:changed", { hostId: r.hostId });
    /* if the host walked away mid-round, calmly end the round */
    if (r.phase === "round") {
      r.phase = "review";
      const claimed = [...r.claimed.entries()].map(([word, pid]) => ({ word, pid }));
      broadcast(r, "round:review", { round: r.round, claimed, players: roster(r) });
      return;
    }
  }
  broadcast(r, "player:left", { id: s.id });
}

console.log(`[party-hub] listening on :${PORT}`);
} /* end not-already-booted */
