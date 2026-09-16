/* ------------------------------------------------------------------
 * واژه‌سفر — partyNet (دورهمی وای‌فای client link)
 * A single socket.io-client connection to the party-hub mini service
 * through the gateway:  io("/?XTransformPort=3003")
 * (relative URL + XTransformPort query — the Caddy gateway forwards
 *  both polling and websocket upgrades to port 3003.)
 * ------------------------------------------------------------------ */
import { io, Socket } from "socket.io-client";

export interface NetPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
}

export interface NetState {
  code: string;
  phase: "lobby" | "round" | "review" | "over";
  hostId: string;
  rounds: number;
  seconds: number;
  round: number;
  players: NetPlayer[];
  wheel: { ls: string[] } | null;
}

export interface NetRoundBegan {
  round: number;
  of: number;
  ls: string[];
  seconds: number;
}
export interface NetWordScored {
  pid: string;
  word: string;
  pts: number;
  scores: { id: string; score: number }[];
  claimedCount: number;
}
export interface NetReview {
  round: number;
  claimed: { word: string; pid: string }[];
  players: NetPlayer[];
}

type Handler = (payload: any) => void;

class PartyNetClient {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private yourId = "";
  /** last error from a join/create ack (Persian, user-facing) */
  lastError = "";

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  /** connect (idempotent) and dispatch hub events to subscribers */
  connect(): void {
    if (this.socket) return;
    const s = io("/?XTransformPort=3003", {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 900,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
    this.socket = s;
    s.on("connect", () => {
      this.yourId = s.id ?? "";
      s.emit("hello", this.hello);
      this.dispatch("net:up", null);
    });
    s.on("disconnect", (reason) => this.dispatch("net:down", reason));
    s.on("connect_error", () => this.dispatch("net:down", "error"));

    const fwd = (ev: string) =>
      s.on(ev, (p: unknown) => this.dispatch(ev, p));
    fwd("room:state");
    fwd("round:began");
    fwd("word:scored");
    fwd("word:taken");
    fwd("round:review");
    fwd("game:over");
    fwd("host:changed");
    fwd("player:left");
    fwd("react");
    fwd("room:rematch");
    s.on("room:hello", (p: { yourId?: string }) => {
      if (p?.yourId) this.yourId = p.yourId;
      this.dispatch("room:hello", p);
    });
  }

  private hello = { name: "مسافر", avatar: "cat" };
  setHello(name: string, avatar: string): void {
    this.hello = { name: name.trim().slice(0, 14) || "مسافر", avatar };
    this.socket?.emit("hello", this.hello);
  }

  get id(): string {
    return this.yourId || this.socket?.id || "";
  }

  on(ev: string, fn: Handler): () => void {
    let set = this.handlers.get(ev);
    if (!set) { set = new Set(); this.handlers.set(ev, set); }
    set.add(fn);
    return () => { set!.delete(fn); };
  }
  private dispatch(ev: string, p: unknown): void {
    const set = this.handlers.get(ev);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(p); } catch { /* one bad listener never kills the bus */ }
    }
  }

  private emitAck(ev: string, arg: unknown): Promise<{ ok: boolean; error?: string; code?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) { this.lastError = "اتصال برقرار نشد — دوباره تلاش کن"; return resolve({ ok: false }); }
      let done = false;
      const t = setTimeout(() => {
        if (!done) { done = true; this.lastError = "پاسخی از اتاق نرسید"; resolve({ ok: false }); }
      }, 6000);
      this.socket.emit(ev, arg, (res: { ok: boolean; error?: string; code?: string }) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        this.lastError = res?.error ?? "";
        resolve(res ?? { ok: false });
      });
    });
  }

  private async ensureUp(ms = 9000): Promise<boolean> {
    if (this.socket?.connected) return true;
    this.connect();
    return await new Promise((res) => {
      const t = setTimeout(() => { off(); res(false); }, ms);
      const off = this.on("net:up", () => { clearTimeout(t); off(); res(true); });
    });
  }

  async createRoom(): Promise<{ ok: boolean; code?: string }> {
    if (!(await this.ensureUp())) { this.lastError = "اتصال برقرار نشد — دوباره تلاش کن"; return { ok: false }; }
    return this.emitAck("room:create", null);
  }
  async joinRoom(code: string): Promise<{ ok: boolean; code?: string }> {
    if (!(await this.ensureUp())) { this.lastError = "اتصال برقرار نشد — دوباره تلاش کن"; return { ok: false }; }
    return this.emitAck("room:join", { code });
  }
  setCfg(rounds?: number, seconds?: number): void { this.socket?.emit("cfg:set", { rounds, seconds }); }
  loadRound(wheel: { ls: string[]; words: string[] }): void { this.socket?.emit("round:load", { wheel }); }
  claimWord(word: string): void { this.socket?.emit("word:claim", { word }); }
  endRound(): void { this.socket?.emit("round:end"); }
  endGame(): void { this.socket?.emit("game:end"); }
  rematch(): void { this.socket?.emit("game:rematch"); }
  react(emoji: string): void { this.socket?.emit("react", { emoji }); }
  leave(): void {
    this.socket?.emit("leave");
    /* v5 BB-FIX: do NOT clear the handler map here. The WifiScreen owns
     * its subscriptions and unsubscribes them on unmount; wiping them
     * here killed room:state/round:began delivery for the LIFETIME of
     * the screen — a second create/join from the internal menu rendered
     * a dead lobby. (old bug: this.handlers.clear()) */
    try { this.socket?.disconnect(); } catch { /* noop */ }
    this.socket = null;
    this.yourId = "";
  }
}

export const PartyNet = new PartyNetClient();

/* dev debugging handle (harmless in prod, invaluable in browser QA) */
if (typeof window !== "undefined") {
  (window as unknown as { __pNet?: PartyNetClient }).__pNet = PartyNet;
}
