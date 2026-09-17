/* ------------------------------------------------------------------
 * واژه‌سفر — lanHub.ts (دورهمی وای‌فای، میزبان = سرور)
 *
 * v5 — the party-hub mini service (mini-services/party-hub, socket.io
 * :3003) is UNREACHABLE from the APK: a hotspot LAN has no internet
 * and the static bundle has no gateway behind it. So the hub logic is
 * PORTED here and runs IN-PROCESS on the host device's WebView.
 *
 * 1:1 port of the socket.io hub semantics (rooms → ONE room here,
 * since a hotspot LAN has exactly one boss):
 *   • hub = AUTHORITY for roster / word OWNERSHIP / scores;
 *   • word validity is judged by the CLAIMING client against the
 *     identical offline lexicon — the hub never needs the 45k corpus;
 *   • same event names as the socket.io protocol so PartyWifiScreen
 *     code paths stay identical across transports;
 *   • member memory (name-keyed) survives rejoin-with-score.
 *
 * Transport-agnostic: emits via a callback, handles one event at a
 * time, returns ack results synchronously. NO capacitor/web imports —
 * testable with bun directly (scripts/test_lan_hub.ts).
 * ------------------------------------------------------------------ */

export const LAN_MAX_PLAYERS = 6;
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L look-alikes

export interface NetP {
  id: string;
  name: string;
  avatar: string;
  score: number;
}
interface Wheel {
  ls: string[];
  words: string[];
}
interface Room {
  code: string;
  hostId: string;
  players: Map<string, NetP>;
  members: Map<string, { avatar: string; score: number }>;
  phase: "lobby" | "round" | "review" | "over";
  rounds: number;
  seconds: number;
  round: number;
  wheel: Wheel | null;
  claimed: Map<string, string>; // word -> playerId
}

export interface AckRes {
  ok: boolean;
  error?: string;
  code?: string;
}

const rid = () => Math.random().toString(36).slice(2, 10);
const newCode = () => {
  let c = "";
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
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
    // wheel letters are public during a round; the word list NEVER
    // leaves the hub (no spoilers on a cheating device's screen)
    wheel: r.phase === "round" && r.wheel ? { ls: r.wheel.ls } : null,
  };
}

export class LanHub {
  private room: Room | null = null;
  private identity = new Map<string, { name: string; avatar: string }>();

  constructor(
    /** toId: peer id | "all" — the transport decides local vs wire */
    private emit: (toId: string | "all", ev: string, payload?: unknown) => void,
  ) {}

  get code(): string {
    return this.room?.code ?? "";
  }
  get phase(): string {
    return this.room?.phase ?? "lobby";
  }
  get playerCount(): number {
    return this.room?.players.size ?? 0;
  }

  /** host-local teardown (leaving the wifi screen / rematch to menu) */
  teardown(): void {
    this.room = null;
    this.identity.clear();
  }

  /** a connected peer dropped (TCP closed) — same as socket.io disconnect */
  peerDown(id: string): void {
    this.leaveRoom(id);
  }

  private broadcast(r: Room, ev: string, payload?: unknown) {
    this.emit("all", ev, payload ?? null);
    this.emit("all", "room:state", state(r));
  }

  private leaveRoom(id: string) {
    const r = this.room;
    if (!r) { this.identity.delete(id); return; }
    if (!r.players.has(id)) { this.identity.delete(id); return; }
    const wasHost = r.hostId === id;
    r.players.delete(id);
    if (r.players.size === 0) {
      this.room = null;
      return;
    }
    if (wasHost) {
      r.hostId = [...r.players.keys()][0];
      this.emit("all", "host:changed", { hostId: r.hostId });
      this.emit("all", "room:state", state(r));
      /* if the host walked away mid-round, calmly end the round */
      if (r.phase === "round") {
        r.phase = "review";
        const claimed = [...r.claimed.entries()].map(([word, pid]) => ({ word, pid }));
        this.broadcast(r, "round:review", { round: r.round, claimed, players: roster(r) });
        return;
      }
    }
    this.broadcast(r, "player:left", { id });
  }

  /** handle one inbound event; ack != null → returns the ack result */
  handle(
    id: string,
    ev: string,
    arg: unknown,
    ack: ((res: AckRes) => void) | null,
  ): void {
    switch (ev) {
      case "hello": {
        const h = (arg ?? {}) as { name?: string; avatar?: string };
        this.identity.set(id, {
          name: String(h?.name ?? "").trim().slice(0, 14) || "مسافر",
          avatar: String(h?.avatar ?? "cat").slice(0, 12),
        });
        ack?.({ ok: true });
        return;
      }

      /* ── room lifecycle ── */
      case "room:create": {
        this.leaveRoom(id);
        const ident = this.identity.get(id) ?? { name: "مسافر", avatar: "cat" };
        const r: Room = {
          code: newCode(),
          hostId: id,
          players: new Map(),
          members: new Map(),
          phase: "lobby",
          rounds: 3,
          seconds: 60,
          round: 0,
          wheel: null,
          claimed: new Map(),
        };
        r.players.set(id, { id, name: ident.name, avatar: ident.avatar, score: 0 });
        r.members.set(ident.name, { avatar: ident.avatar, score: 0 });
        this.room = r;
        ack?.({ ok: true, code: r.code });
        /* ONLY the creator learns their id — a room-wide broadcast
         * would overwrite every other member's yourId */
        this.emit(id, "room:hello", { yourId: id });
        this.emit(id, "room:state", state(r));
        return;
      }

      case "room:join": {
        const code = String((arg as { code?: string })?.code ?? "").trim().toUpperCase();
        const r = this.room;
        const ident = this.identity.get(id) ?? { name: "مسافر", avatar: "cat" };
        this.identity.set(id, ident);
        if (!r || (code && r.code !== code)) {
          ack?.({ ok: false, error: "اتاقی با این کد پیدا نشد" });
          return;
        }
        const mem = r.members.get(ident.name);
        if (r.phase !== "lobby" && !mem) {
          ack?.({ ok: false, error: "این بازی شروع شده — بعدی!" });
          return;
        }
        if (r.players.size >= LAN_MAX_PLAYERS && !mem) {
          ack?.({ ok: false, error: "اتاق پر است (حداکثر ۶ نفر)" });
          return;
        }
        if (r.players.has(id)) { ack?.({ ok: true, code: r.code }); return; }
        /* REJOIN: the same name returning mid-match resumes with its
         * saved score; in a fresh lobby it (re)enters with score 0. */
        const p: NetP = {
          id, name: ident.name, avatar: ident.avatar,
          score: r.phase !== "lobby" && mem ? mem.score : 0,
        };
        r.players.set(id, p);
        r.members.set(ident.name, { avatar: ident.avatar, score: p.score });
        ack?.({ ok: true, code: r.code });
        this.broadcast(r, "player:joined", { id });
        this.emit(id, "room:hello", { yourId: id });
        /* mid-match rejoin: hand back the live round so the phone resumes */
        if (r.phase === "round" && r.wheel) {
          this.emit(id, "round:began", {
            round: r.round, of: r.rounds, ls: r.wheel.ls, seconds: r.seconds,
          });
        }
        return;
      }

      /* ── lobby ── */
      case "cfg:set": {
        const r = this.room;
        if (!r || r.hostId !== id || r.phase !== "lobby") return;
        const a = (arg ?? {}) as { rounds?: number; seconds?: number };
        if (a?.rounds) r.rounds = Math.max(1, Math.min(6, Math.round(a.rounds)));
        if (a?.seconds) r.seconds = Math.max(30, Math.min(120, Math.round(a.seconds)));
        this.broadcast(r, "room:cfg", { rounds: r.rounds, seconds: r.seconds });
        return;
      }

      /* ── round flow (host-authoritative) ── */
      case "round:load": {
        const r = this.room;
        if (!r || r.hostId !== id) return;
        const a = (arg ?? {}) as { wheel?: { ls?: unknown; words?: unknown } };
        const ls = Array.isArray(a?.wheel?.ls) ? a.wheel!.ls!.map((c) => String(c).slice(0, 2)) : null;
        if (!ls || ls.length < 5 || ls.length > 12) return;
        r.wheel = { ls, words: [] };
        r.claimed = new Map();
        r.round += 1;
        r.phase = "round";
        this.broadcast(r, "round:began", { round: r.round, of: r.rounds, ls, seconds: r.seconds });
        return;
      }

      case "word:claim": {
        const r = this.room;
        if (!r || r.phase !== "round" || !r.wheel) return;
        const w = String((arg as { word?: string })?.word ?? "").trim();
        if (w.length < 2) return;
        if (r.claimed.has(w)) {
          this.emit(id, "word:taken", { word: w });
          return;
        }
        r.claimed.set(w, id);
        const p = r.players.get(id);
        if (p) {
          p.score += w.length * 10; // hub-computed: len×10, first owner keeps it
          const m = r.members.get(p.name);
          if (m) m.score = p.score;
        }
        this.broadcast(r, "word:scored", {
          pid: id, word: w, pts: w.length * 10,
          scores: roster(r).map((x) => ({ id: x.id, score: x.score })),
          claimedCount: r.claimed.size,
        });
        return;
      }

      case "round:end": {
        const r = this.room;
        if (!r || r.hostId !== id || r.phase !== "round") return;
        r.phase = "review";
        const claimed = [...r.claimed.entries()].map(([word, pid]) => ({ word, pid }));
        this.broadcast(r, "round:review", { round: r.round, claimed, players: roster(r) });
        return;
      }

      case "game:end": {
        const r = this.room;
        if (!r || r.hostId !== id) return;
        r.phase = "over";
        this.broadcast(r, "game:over", { players: roster(r) });
        return;
      }

      case "game:rematch": {
        const r = this.room;
        if (!r || r.hostId !== id) return;
        r.phase = "lobby";
        r.round = 0;
        r.wheel = null;
        r.claimed = new Map();
        for (const p of r.players.values()) p.score = 0;
        for (const m of r.members.values()) m.score = 0;
        this.broadcast(r, "room:rematch", null);
        return;
      }

      /* ── fun ── */
      case "react": {
        const r = this.room;
        if (!r) return;
        const emoji = String((arg as { emoji?: string })?.emoji ?? "").slice(0, 8);
        if (!emoji) return;
        this.emit("all", "react", { pid: id, emoji });
        return;
      }

      /* ── teardown ── */
      case "leave": {
        this.leaveRoom(id);
        return;
      }

      default:
        return;
    }
  }
}

/* re-export for the transport that builds line payloads */
export { rid as lanRid, state as lanRoomState };
