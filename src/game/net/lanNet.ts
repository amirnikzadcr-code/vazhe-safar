/* ------------------------------------------------------------------
 * واژه‌سفر — lanNet.ts (دورهمی وای‌فای روی هات‌اسپات — بدون اینترنت)
 *
 * v5 ARCHITECTURE (user: «کسی که اتاق ایجاد میکنه نقطه اتصال گوشیش
 * رو روشن میکنه و هرکس بهش وصل شه وارد اتاق میشه و دستگاه‌ها لیست
 * میشن»):
 *
 *   ┌─────────────┐ WiFi hotspot (no internet)  ┌─────────────┐
 *   │ HOST phone  │◄──── TCP 48765 JSON ───────►│ GUEST phones │
 *   │ LanLink.java│      UDP 48766 discovery    │  LanLink     │
 *   │ + LanHub.ts │                             │  LanPartyNet │
 *   └─────────────┘                             └─────────────┘
 *
 *   • HOST = boss device: LanLinkPlugin (java) runs a TCP server +
 *     UDP discovery responder; LanHub (TS) runs the room IN the
 *     host's WebView. The host is ALSO a player (id "host").
 *   • GUEST = discovers the host by UDP broadcast (fallback: direct
 *     connect to the classic hotspot gateway 192.168.43.1), then
 *     exchanges newline-delimited JSON lines.
 *   • Ack correlation: {t, d, a} request → {t:"__ack", a, r} reply.
 *   • PUBLIC API mirrors PartyNetClient 1:1 (on/createRoom/joinRoom/
 *     setCfg/loadRound/claimWord/…), so PartyWifiScreen works over
 *     either transport with zero structural changes.
 * ------------------------------------------------------------------ */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { LanHub, type AckRes } from "./lanHub";

/* ---------------- native bridge (LanLinkPlugin.java) ---------------- */
interface LanLinkInterface {
  startHost(opts: { port?: number }): Promise<void>;
  discoverHost(opts: { timeoutMs?: number }): Promise<{ ip: string; port: number }>;
  connect(opts: { host: string; port?: number }): Promise<void>;
  send(opts: { text: string; peerId?: string }): Promise<void>;
  stop(): Promise<void>;
  openWifiSettings(): Promise<void>;
  addListener(
    ev: string,
    cb: (data: { id?: string; text?: string; port?: number; ip?: string; reason?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const LanLink = registerPlugin<LanLinkInterface>("LanLink");

type Handler = (payload: any) => void;
interface Line { t: string; d?: unknown; a?: number }

const line = (t: string, d?: unknown, a?: number): string =>
  JSON.stringify(a === undefined ? { t, d } : { t, d, a });

/* classic Android hotspot gateways tried if UDP discovery misses */
const FALLBACK_HOSTS = ["192.168.43.1"];

export const isNativeLan = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/* ------------------------------------------------------------------ */
class LanPartyNet {
  private handlers = new Map<string, Set<Handler>>();
  private hub: LanHub | null = null;
  private role: "host" | "guest" | null = null;
  private myId = "";
  private linkUp = false;
  private ackSeq = 1;
  private pendingAcks = new Map<number, (res: AckRes) => void>();
  private hello = { name: "مسافر", avatar: "cat" };
  private handles: PluginListenerHandle[] = [];
  private wired = false;
  lastError = "";

  get connected(): boolean {
    return this.linkUp;
  }

  get id(): string {
    return this.myId;
  }

  /* ---------------- event bus (identical to PartyNetClient) -------- */
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

  /* warm call from WifiRoot mount — LAN has no socket to preheat, but
   * the badge expects a net:up. Native bridge listeners wire here. */
  connect(): void {
    if (!isNativeLan()) return;
    this.wireBridge();
    if (!this.linkUp) {
      /* menu state: the local device is always "up" for the UI */
      this.dispatch("net:up", null);
    }
  }

  private wireBridge(): void {
    if (this.wired) return;
    this.wired = true;
    const safe = async (p: Promise<unknown>, ev: string, data: unknown) => {
      try { await p; } catch { /* bridge callbacks never throw upward */ }
      this.dispatch(ev, data);
    };
    /* host-side lifecycle */
    void safe(LanLink.addListener("hostReady", () => { /* resolved via startHost */ }), "__noop", null);
    void safe(LanLink.addListener("hostDown", (d) => {
      this.linkUp = false;
      this.dispatch("net:down", d?.reason ?? "hostDown");
    }), "__noop", null);
    void safe(LanLink.addListener("clientUp", (d) => {
      /* the device is visible on the wire; the actual roster entry
       * lands when the client sends hello + room:join */
      this.dispatch("lan:clientUp", { id: d?.id ?? "" });
    }), "__noop", null);
    void safe(LanLink.addListener("clientDown", (d) => {
      const id = d?.id ?? "";
      this.hub?.peerDown(id);
    }), "__noop", null);
    /* shared message pump */
    void safe(LanLink.addListener("lanMessage", (m) => {
      this.onLine(m?.id ?? "", m?.text ?? "");
    }), "__noop", null);
    /* guest-side lifecycle */
    void safe(LanLink.addListener("lanUp", (d) => {
      this.linkUp = true;
      this.dispatch("net:up", d);
    }), "__noop", null);
    void safe(LanLink.addListener("lanDown", () => {
      this.linkUp = false;
      this.dispatch("net:down", "closed");
    }), "__noop", null);
  }

  /* ---------------- line pump ---------------- */
  private onLine(fromId: string, text: string): void {
    let msg: Line;
    try { msg = JSON.parse(text) as Line; } catch { return; }
    if (!msg || typeof msg.t !== "string") return;

    if (msg.t === "__ack") {
      const res = (msg as unknown as { a?: number; r?: AckRes });
      if (typeof res.a === "number") {
        const done = this.pendingAcks.get(res.a);
        if (done) { this.pendingAcks.delete(res.a); done(res.r ?? { ok: false }); }
      }
      return;
    }

    if (this.role === "host") {
      this.hub?.handle(fromId, msg.t, msg.d, (ackRes) => {
        try { void LanLink.send({ peerId: fromId, text: line("__ack", ackRes, msg.a) }); } catch { /* drop */ }
      });
      return;
    }
    /* guest: the host's messages are broadcasts for the UI */
    if (msg.t === "room:hello") {
      const y = (msg.d as { yourId?: string } | null)?.yourId;
      if (y) this.myId = y; /* the hub's own id for THIS device */
    }
    this.dispatch(msg.t, msg.d);
  }

  private waitAck(a: number, ms = 6000): Promise<AckRes> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        if (this.pendingAcks.has(a)) {
          this.pendingAcks.delete(a);
          this.lastError = "پاسخی از اتاق نرسید";
          resolve({ ok: false });
        }
      }, ms);
      this.pendingAcks.set(a, (res) => { clearTimeout(t); resolve(res); });
    });
  }

  /* host-local send: straight into the hub; guest: over the wire */
  private callHost(ev: string, d: unknown, wantAck: boolean): Promise<AckRes> {
    if (this.role === "host") {
      return new Promise((resolve) => {
        this.hub?.handle(this.myId, ev, d, wantAck ? resolve : null);
        if (!wantAck) resolve({ ok: true });
      });
    }
    const a = this.ackSeq++;
    try { void LanLink.send({ text: line(ev, d, a) }); } catch { return Promise.resolve({ ok: false }); }
    return this.waitAck(a);
  }

  /* ---------------- identity ---------------- */
  setHello(name: string, avatar: string): void {
    this.hello = { name: name.trim().slice(0, 14) || "مسافر", avatar };
    if (this.role === "host") {
      this.hub?.handle(this.myId, "hello", this.hello, null);
    } else if (this.role === "guest" && this.linkUp) {
      try { void LanLink.send({ text: line("hello", this.hello) }); } catch { /* drop */ }
    }
  }

  /* ---------------- host: become the boss ---------------- */
  async createRoom(): Promise<{ ok: boolean; code?: string }> {
    if (!isNativeLan()) { this.lastError = "لینک محلی در دسترس نیست"; return { ok: false }; }
    this.wireBridge();
    this.teardownLocal();
    /* EE — STOP first, then start: a previous session's server may still
     * be alive-but-stale; Java's `if (hosting.get()) resolve()` would
     * early-resolve on that zombie and the room would exist with NO live
     * listener. A fresh stop() guarantees startHost rebinds for real.
     * Then up to 3 bind attempts (the plugin walks 12 ports per call):
     * transient port-release races no longer surface as «ساخت اتاق روی
     * این دستگاه ممکن نشد». */
    try { await LanLink.stop(); } catch { /* nothing to stop yet */ }
    let started = false;
    for (let attempt = 0; attempt < 3 && !started; attempt++) {
      try {
        await LanLink.startHost({ port: 48765 });
        started = true;
      } catch {
        try { await LanLink.stop(); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 260));
      }
    }
    if (!started) {
      this.lastError = "ساخت اتاق ممکن نشد — گوشی را یک‌بار ببندید و دوباره تلاش کنید";
      return { ok: false };
    }
    this.role = "host";
    this.myId = "host";
    this.linkUp = true;
    this.hub = new LanHub((toId, ev, payload) => {
      const text = line(ev, payload);
      try {
        if (toId === "all") void LanLink.send({ text });
        else if (toId !== this.myId) void LanLink.send({ text, peerId: toId });
      } catch { /* drop */ }
      if (toId === "all" || toId === this.myId) this.dispatch(ev, payload);
    });
    this.hub.handle(this.myId, "hello", this.hello, null);
    const res = await new Promise<AckRes>((resolve) => {
      this.hub!.handle(this.myId, "room:create", null, resolve);
    });
    if (!res.ok) { this.lastError = "ساخت اتاق ناموفق بود"; return { ok: false }; }
    this.dispatch("net:up", null);
    return { ok: true, code: res.code };
  }

  /* ---------------- guest: find the boss, join ---------------- */
  async joinRoom(_code: string): Promise<{ ok: boolean; code?: string }> {
    if (!isNativeLan()) { this.lastError = "لینک محلی در دسترس نیست"; return { ok: false }; }
    this.wireBridge();
    if (this.role !== "guest") this.teardownLocal();

    /* already linked? just join */
    if (!this.linkUp) {
      this.role = "guest";
      const found = await this.findHost();
      if (!found) { this.lastError = "میزبان پیدا نشد — مطمئن شو به هات‌اسپات میزبان وصلی"; return { ok: false }; }
      /* v7 — the discovery fallback may have ALREADY opened the socket,
       * and a connect() to the SAME host now resolves inside the plugin
       * instead of rejecting (the old «already connected» reject made
       * the join flow race its own live link and report a failure that
       * was not one). Every path below waits for net:up calmly. */
      if (!this.linkUp) {
        try {
          await LanLink.connect({ host: found.ip, port: found.port });
        } catch {
          this.lastError = "وصل شدن به میزبان ممکن نشد";
          return { ok: false };
        }
        /* the plugin fires lanUp once the socket is live */
        if (!this.linkUp) {
          const up = await new Promise<boolean>((resolve) => {
            const t = setTimeout(() => { off(); resolve(false); }, 3000);
            const off = this.on("net:up", () => { clearTimeout(t); off(); resolve(true); });
          });
          if (!up) { this.lastError = "وصل شدن به میزبان ممکن نشد"; return { ok: false }; }
        }
      }
    }

    /* identity + join over the wire */
    try { await LanLink.send({ text: line("hello", this.hello) }); } catch { /* drop */ }
    const res = await this.callHost("room:join", { code: "" }, true);
    this.lastError = res.error ?? "";
    if (!res.ok) return { ok: false };
    /* myId arrives via room:hello; keep a usable fallback meanwhile */
    if (!this.myId) this.myId = "guest";
    return { ok: true, code: res.code };
  }

  private async findHost(): Promise<{ ip: string; port: number } | null> {
    /* v7 — two tuned rounds (the plugin's discoverHost now combines the
     * UDP broadcast AND a subnet sweep in one call). Worst case ≈10s
     * with useful work at every step, instead of the old 3×(3.5+3.5)s
     * stall that read as «هیچی نمی‌شه». */
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await LanLink.discoverHost({ timeoutMs: attempt === 0 ? 3500 : 1800 });
        if (r?.ip) return { ip: r.ip, port: r.port ?? 48765 };
      } catch { /* fall through to the direct pokes */ }
      for (const ip of FALLBACK_HOSTS) {
        try {
          await LanLink.connect({ host: ip, port: 48765 });
          return { ip, port: 48765 };
        } catch { /* next */ }
      }
    }
    return null;
  }

  /* ---------------- room ops (identical surface) ---------------- */
  setCfg(rounds?: number, seconds?: number): void {
    void this.callHost("cfg:set", { rounds, seconds }, false);
  }
  loadRound(wheel: { ls: string[]; words: string[] }): void {
    void this.callHost("round:load", { wheel }, false);
  }
  claimWord(word: string): void {
    void this.callHost("word:claim", { word }, false);
  }
  endRound(): void { void this.callHost("round:end", null, false); }
  endGame(): void { void this.callHost("game:end", null, false); }
  rematch(): void { void this.callHost("game:rematch", null, false); }
  react(emoji: string): void { void this.callHost("react", { emoji }, false); }

  leave(): void {
    if (this.role === "guest" && this.linkUp) {
      try { void LanLink.send({ text: line("leave", null) }); } catch { /* drop */ }
    }
    try { void LanLink.stop(); } catch { /* noop */ }
    this.teardownLocal();
  }

  private teardownLocal(): void {
    this.hub?.teardown();
    this.hub = null;
    this.role = null;
    this.myId = "";
    this.linkUp = false;
    for (const [, fn] of this.pendingAcks) fn({ ok: false });
    this.pendingAcks.clear();
  }

  /** open Android WiFi settings (hotspot toggle lives there) */
  async openWifiSettings(): Promise<void> {
    try { await LanLink.openWifiSettings(); } catch { /* settings unavailable */ }
  }
}

export { LanPartyNet };

/* dev debugging handle (harmless in prod, invaluable in browser QA) */
if (typeof window !== "undefined") {
  (window as unknown as { __LanNet?: LanPartyNet }).__LanNet = new LanPartyNet();
}
