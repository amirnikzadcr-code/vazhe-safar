"use client";
/* ------------------------------------------------------------------
 * PartyWifiScreen — «بازی با وای‌فای» (session AB)
 * user: «بازی با وصل شدن دستگاه‌ها از طریق وای فای … کاربرا به‌ینفر
 * وصل شن نقطه اتصال از طریق وای فای ب هم کانکت شن و بازی کنن و خودت
 * این قسمت خوب بلدی بچین معماریش و قابلیت هاش درست کن»
 *
 * ARCHITECTURE
 *   • party-hub mini service (socket.io, :3003 through the gateway)
 *     is the authority for rooms / rosters / word OWNERSHIP / scores.
 *   • Every player is on their OWN phone; the host deposits the round
 *     wheel (letters) at the hub; all players race SIMULTANEOUSLY on
 *     the same ring; the FIRST claimer of a word owns it (hub
 *     arbitrates), everyone else hears «این واژه گرفته شد!».
 *   • Validity of each word is judged by the claiming client against
 *     the identical bundled offline lexicon — the hub never needs the
 *     45k corpus.
 *   • Host migration on disconnect; rematch resets to lobby.
 *
 * PHASES: menu → lobby → round → review → over (→ lobby rematch)
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/game/ui/kit";
import { AVATARS, AvatarFace } from "@/components/game/avatars";
import { LEVELS, isRealWord } from "@/game/data/levelsIndex";
import { letters, faNum, buzz } from "@/game/core/utils";
import { validateWord } from "@/game/core/lexicon";
import { Audio } from "@/game/core/audio";
import { Save } from "@/game/core/save";
import { TurnTimer } from "@/components/game/ui/turntimer";
import {
  PartyNet, NetState, NetReview,
  NetPlayer, isLanTransport,
} from "@/game/net/partyNet";
import { stageZoom } from "@/game/core/stage";

type UiPhase = "menu" | "lobby" | "round" | "review" | "over";

const REACTS = ["🔥", "😂", "😍", "👏"];

/* v5 — LAN (hotspot) tips replace the room-code tip (no codes there) */
const WIFI_TIPS_LAN = [
  "هیچ اینترنتی لازم نیست — همه از هات‌اسپات میزبان وصل می‌شن!",
  "اولین نفری که یک واژه را بسازد، مالک آن واژه می‌شود — هر واژه فقط یک بار!",
  "واژه‌های بلندتر امتیاز بیشتری دارند — هر حرف ۱۰ امتیاز!",
  "همه با یک چرخِ یکسان مسابقه می‌دهید — کاملاً عادلانه!",
];

const WIFI_TIPS = [
  "کدِ ۴ حرفیِ اتاق را به دوستانت بده تا همزمان داخل بشن!",
  "اولین نفری که یک واژه را بسازد، مالک آن واژه می‌شود — هر واژه فقط یک بار!",
  "واژه‌های بلندتر امتیاز بیشتری دارند — هر حرف ۱۰ امتیاز!",
  "همه با یک چرخِ یکسان مسابقه می‌دهید — کاملاً عادلانه!",
];

/** pick a random unused level wheel (letters + word pool) */
function pickWheelLive(used: Set<string>): { key: string; ls: string[]; words: string[]; wordSet: Set<string> } {
  for (let t = 0; t < 60; t++) {
    const c = Math.floor(Math.random() * LEVELS.length);
    const list = LEVELS[c];
    const i = Math.floor(Math.random() * list.length);
    const key = `${c}:${i}`;
    if (used.has(key)) continue;
    used.add(key);
    const lv = list[i];
    const ws = [...lv.words, ...lv.bonus];
    return { key, ls: letters(lv.wheel), words: ws, wordSet: new Set(ws) };
  }
  const lv = LEVELS[0][0];
  return { key: "0:0", ls: letters(lv.wheel), words: [...lv.words], wordSet: new Set(lv.words) };
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- floating reaction bubble ---------------- */
function ReactionBubble({ emoji, name }: { emoji: string; name: string }) {
  return (
    <span className="wf-react-pop">
      <i>{emoji}</i>
      <b>{name}</b>
    </span>
  );
}

/* ================= ROOT ================= */
export function WifiRoot({ onExit, onHome }: { onExit: () => void; onHome: () => void }) {
  const LAN = isLanTransport();
  const [ui, setUi] = useState<UiPhase>("menu");
  const [state, setState] = useState<NetState | null>(null);
  const [roundInfo, setRoundInfo] = useState<{ round: number; of: number; ls: string[]; seconds: number } | null>(null);
  const [review, setReview] = useState<NetReview | null>(null);
  const [overPlayers, setOverPlayers] = useState<NetPlayer[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [reacts, setReacts] = useState<{ id: number; emoji: string; name: string }[]>([]);
  const reactId = useRef(0);
  const inRoom = useRef(false);
  /* v5 BB — remember the room code so a network blip can silently rejoin */
  const lastCode = useRef("");

  /* v5 — عمو دانا tutorial: auto-opens the first time the player
   * reaches the WiFi menu; re-openable from the menu button.
   * Persistence is a tiny localStorage flag (no Save-schema churn). */
  const [tutOpen, setTutOpen] = useState(false);
  const tutAuto = useRef(false);
  useEffect(() => {
    if (!LAN) return;
    let seen = false;
    try { seen = !!localStorage.getItem("vz_wifi_tut_v1"); } catch { seen = false; }
    if (!seen) { tutAuto.current = true; setTutOpen(true); }
  }, [LAN]);
  const closeTut = () => {
    setTutOpen(false);
    try { localStorage.setItem("vz_wifi_tut_v1", "1"); } catch { /* private mode */ }
  };
  const [rulesOpen, setRulesOpen] = useState(false);

  /* identity defaults from the player profile */
  const [name, setName] = useState(Save.data.profile.name);
  const [avatar, setAvatar] = useState(Save.data.profile.avatar || AVATARS[0].id);
  /* reactive connection badge (the singleton is not a re-render trigger) */
  const [netUp, setNetUp] = useState(false);
  useEffect(() => {
    const offUp = PartyNet.on("net:up", () => setNetUp(true));
    const offDown = PartyNet.on("net:down", () => setNetUp(false));
    return () => { offUp(); offDown(); };
  }, []);

  /* one-shot hub wiring for the lifetime of this screen */
  useEffect(() => {
    PartyNet.connect(); /* warm the socket immediately — the badge and
                          the first create/join tap then hit a live link */
    PartyNet.setHello(Save.data.profile.name || "مسافر", Save.data.profile.avatar || AVATARS[0].id);
    const offState = PartyNet.on("room:state", (s: NetState) => {
      setState(s);
      setUi((u) => {
        if (s.phase === "lobby") return u === "menu" ? "lobby" : s.phase;
        if (s.phase === "round") return "round";
        if (s.phase === "review") return "review";
        if (s.phase === "over") return "over";
        return u;
      });
    });
    const offBegan = PartyNet.on("round:began", (r: { round: number; of: number; ls: string[]; seconds: number }) => {
      setRoundInfo(r);
      setUi("round");
      Audio.sfxChapterUnlock();
    });
    const offReview = PartyNet.on("round:review", (rv: NetReview) => {
      setReview(rv);
      setUi("review");
      Audio.sfxPartyEnd();
    });
    const offOver = PartyNet.on("game:over", (o: { players: NetPlayer[] }) => {
      setOverPlayers(o.players);
      setUi("over");
      Audio.sfxPartyEnd();
    });
    const offTaken = PartyNet.on("word:taken", () => { /* handled inside WifiTurn */ });
    const offDown = PartyNet.on("net:down", () => setOffline(true));
    const offUp = PartyNet.on("net:up", () => {
      /* v5 BB — a reconnect no longer kicks you to the menu: if we were
       * in a room, SILENTLY REJOIN it (the hub keeps the member's score
       * and, mid-round, re-sends the live wheel). Only when the room is
       * really gone do we fall back to the internal menu. */
      setOffline(false);
      if (inRoom.current) {
        const code = lastCode.current;
        if (code) {
          void PartyNet.joinRoom(code).then((res) => {
            if (res.ok) return;                       // back in — resume
            inRoom.current = false;
            PartyNet.leave();
            setState(null); setRoundInfo(null); setReview(null); setOverPlayers(null);
            setUi("menu");
          });
        } else {
          inRoom.current = false;
          PartyNet.leave();
          setUi("menu");
        }
      }
    });
    return () => {
      offState(); offBegan(); offReview(); offOver(); offTaken(); offDown(); offUp();
      PartyNet.leave();
      inRoom.current = false;
    };
  }, []);

  /* reactions — re-subscribed when the roster changes so the bubble can
   * carry the sender's name (lint-safe: reads state, never mutates) */
  const players = state?.players ?? [];
  useEffect(() => {
    const offReact = PartyNet.on("react", (r: { pid: string; emoji: string }) => {
      const nm = players.find((p) => p.id === r.pid)?.name ?? "";
      reactId.current += 1;
      const id = reactId.current;
      setReacts((rs) => [...rs, { id, emoji: r.emoji, name: nm }]);
      setTimeout(() => setReacts((rs) => rs.filter((x) => x.id !== id)), 1900);
    });
    return offReact;
  }, [players]);

  const amHost = !!state && state.hostId === PartyNet.id;

  /* actions */
  const [menuErr, setMenuErr] = useState("");
  const create = async () => {
    Audio.sfxClick();
    PartyNet.setHello(name, avatar);
    const res = await PartyNet.createRoom();
    if (res.ok) { inRoom.current = true; lastCode.current = res.code ?? ""; setMenuErr(""); setUi("lobby"); }
    else setMenuErr(PartyNet.lastError || "ساخت اتاق ناموفق بود");
  };
  const join = async (code: string): Promise<string> => {
    Audio.sfxClick();
    PartyNet.setHello(name, avatar);
    const res = await PartyNet.joinRoom(code);
    if (res.ok) { inRoom.current = true; lastCode.current = code.trim().toUpperCase(); setUi("lobby"); return ""; }
    return PartyNet.lastError || "اتاق پیدا نشد";
  };
  const leaveTo = (where: "menu" | "home") => {
    Audio.sfxClick();
    PartyNet.leave();
    inRoom.current = false;
    lastCode.current = "";
    setState(null); setRoundInfo(null); setReview(null); setOverPlayers(null);
    if (where === "menu") setUi("menu"); else onHome();
  };

  if (offline) {
    return (
      <div className="vz-page wf-offline">
        <span className="spin" />
        <p>اتصال قطع شده… تلاش برای وصل شدن دوباره</p>
        <button type="button" className="ps-act finish" onClick={() => { setOffline(false); leaveTo("menu"); }}>
          بازگشت
        </button>
      </div>
    );
  }

  return (
    <>
      {ui === "menu" && (
        <WifiMenu
          name={name} setName={setName}
          avatar={avatar} setAvatar={setAvatar}
          netUp={netUp}
          menuErr={menuErr}
          onCreate={create} onJoin={join}
          onExit={onExit}
          lan={LAN}
          onOpenTut={() => { Audio.sfxClick(); setTutOpen(true); }}
          onOpenRules={() => { Audio.sfxClick(); setRulesOpen(true); }}
        />
      )}
      {ui === "lobby" && state && (
        <WifiLobby
          state={state} amHost={amHost} lan={LAN}
          onCfg={(rounds, seconds) => PartyNet.setCfg(rounds, seconds)}
          onStart={() => {
            const wheel = pickWheelLive(new Set());
            PartyNet.loadRound({ ls: wheel.ls, words: wheel.words });
          }}
          onLeave={() => leaveTo("menu")}
          reacts={reacts}
          onOpenRules={() => { Audio.sfxClick(); setRulesOpen(true); }}
        />
      )}
      {ui === "round" && state && roundInfo && (
        <WifiRound
          key={roundInfo.round}
          state={state} roundInfo={roundInfo} amHost={amHost} meId={PartyNet.id}
          onEndRound={() => PartyNet.endRound()}
          onLeave={() => leaveTo("menu")}
          reacts={reacts}
        />
      )}
      {ui === "review" && state && review && (
        <WifiReview
          state={state} review={review} amHost={amHost}
          onNext={() => {
            const wheel = pickWheelLive(new Set());
            PartyNet.loadRound({ ls: wheel.ls, words: wheel.words });
          }}
          onFinish={() => PartyNet.endGame()}
          onLeave={() => leaveTo("menu")}
        />
      )}
      {ui === "over" && state && overPlayers && (
        <WifiOver
          players={overPlayers} meId={PartyNet.id} amHost={amHost}
          onRematch={() => PartyNet.rematch()}
          onLeave={() => leaveTo("menu")}
          onHome={() => leaveTo("home")}
        />
      )}

      {/* v5 — عمو دانا walkthrough + rules sheet (overlay above all) */}
      {tutOpen && <WifiTut onClose={closeTut} />}
      {rulesOpen && <WifiRules onClose={() => setRulesOpen(false)} />}
    </>
  );
}

/* ================= MENU (create / join) =================
 * v5 — TWO FLOWS:
 *   • LAN (APK over a hotspot): «میزبان باش» boots the device's own
 *     room server (LanLink + LanHub); «مهمون باش» walks the player
 *     through joining the host hotspot (settings deep-link → UDP
 *     discovery → auto-join). NO room codes anywhere.
 *   • Browser/dev: the original 4-char-code flow against the
 *     party-hub mini service (kept intact for QA).
 * ------------------------------------------------------------------ */
function WifiMenu({
  name, setName, avatar, setAvatar, netUp, menuErr, onCreate, onJoin, onExit,
  lan, onOpenTut, onOpenRules,
}: {
  name: string; setName: (s: string) => void;
  avatar: string; setAvatar: (s: string) => void;
  netUp: boolean;
  menuErr: string;
  onCreate: () => void;
  onJoin: (code: string) => Promise<string>;
  onExit: () => void;
  lan: boolean;
  onOpenTut: () => void;
  onOpenRules: () => void;
}) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const tips = lan ? WIFI_TIPS_LAN : WIFI_TIPS;
  const [tip] = useState(() => pick(tips));

  /* guest LAN scanner: null | "step1" | "scanning" | err-string */
  const [guest, setGuest] = useState<null | "step1" | "scanning" | string>(null);
  const scanRef = useRef(0); /* cancel token */

  const cycleAvatar = () => {
    Audio.sfxClick();
    const order = AVATARS;
    const i = order.findIndex((a) => a.id === avatar);
    setAvatar(order[(i + 1) % order.length].id);
  };

  const doHost = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    onCreate();
    /* onCreate's lobby switch is driven by room:state; the busy flag
     * simply guards double-taps for the room-create roundtrip */
    setTimeout(() => setBusy(false), 2600);
  };

  const doGuest = async () => {
    const token = ++scanRef.current;
    setGuest("scanning");
    setErr("");
    PartyNet.setHello(name, avatar);
    const e = await onJoin(""); /* LAN join: code is irrelevant */
    if (scanRef.current !== token) return; /* cancelled meanwhile */
    setGuest(e ? e : null);
    setErr(e);
    setBusy(false);
  };

  const doJoin = async () => {
    if (busy) return;
    if (code.trim().length < 3) { setErr("کد اتاق را وارد کن!"); return; }
    setBusy(true);
    const e = await onJoin(code.trim().toUpperCase());
    setBusy(false);
    setErr(e);
  };

  /* ---------- LAN variant ---------- */
  if (lan) {
    return (
      <Sheet bg="/assets/bg/map2b.webp" bgDim={0.3}>
        <div className="ps-top">
          <button type="button" className="ps-x" aria-label="بازگشت" onClick={onExit}>✕</button>
          <div className="sheet-title" style={{ fontSize: 16, padding: "7px 22px" }}>دورهمی وای‌فای</div>
          <span style={{ width: 40 }} />
        </div>

        <div className="scrolly">
          <div className="wf-net-badge" aria-live="polite">
            <span className={`wf-dot ${netUp ? "on" : ""}`} />
            {netUp ? "آمادهٔ بازی محلی — بدون اینترنت" : "در حال آماده‌سازی…"}
          </div>

          <div className="panel rise-in" style={{ borderRadius: 22, padding: 14 }}>
            <div className="ps-row-label">تو کی هستی؟</div>
            <div className="ps-player">
              <button type="button" className="ps-pavatar" onClick={cycleAvatar} aria-label="تغییر آواتار">
                <AvatarFace id={avatar} size={44} />
              </button>
              <input
                className="name-input"
                style={{ flex: 1, margin: 0 }}
                value={name}
                maxLength={12}
                placeholder="اسم تو"
                onChange={(e) => setName(e.target.value)}
                aria-label="اسم تو"
              />
            </div>
          </div>

          {/* the two LAN roles — host = the boss, guest = join the boss */}
          <div className="wf-mode-cards" style={{ marginTop: 12 }}>
            <button type="button" className="wf-mcard host" disabled={busy} onClick={() => { Audio.sfxClick(); void doHost(); }}>
              <span className="wf-mic" aria-hidden>📡</span>
              <span className="wf-mt">میزبان باش</span>
              <span className="wf-md">هات‌اسپات گوشیت رو روشن کن؛ دوستان بهت وصل می‌شن و اتاق روی گوشی خودت ساخته می‌شه</span>
              <span className="wf-go">ساخت اتاق ‹</span>
            </button>
            <button type="button" className="wf-mcard guest" disabled={busy} onClick={() => { Audio.sfxClick(); setGuest("step1"); }}>
              <span className="wf-mic" aria-hidden>🤝</span>
              <span className="wf-mt">مهمون باش</span>
              <span className="wf-md">به هات‌اسپات میزبان وصل شو؛ بازی خودش میزبان رو پیدا می‌کنه</span>
              <span className="wf-go">پیدا کردن میزبان ‹</span>
            </button>
          </div>
          {menuErr && <div className="wf-err" style={{ textAlign: "center", marginTop: 8 }}>{menuErr}</div>}

          <div className="wf-menu-links">
            <button type="button" className="wf-link-btn" onClick={onOpenTut}>
              🎓 آموزش با عمو دانا
            </button>
            <button type="button" className="wf-link-btn" onClick={onOpenRules}>
              📜 قوانین بازی
            </button>
          </div>

          <div className="wf-tip">{tip}</div>
          <div style={{ height: 24 }} />
        </div>

        {/* ---------- guest scanner overlay ---------- */}
        {guest && (
          <div className="wf-scan-veil">
            <div className="wf-scan-card rise-in">
              {guest === "step1" && (
                <>
                  <div className="wf-scan-badge">قدم ۱ از ۲</div>
                  <div className="wf-scan-t">به هات‌اسپات میزبان وصل شو</div>
                  <div className="wf-scan-d">
                    میزبان هات‌اسپات (نقطه اتصال) گوشیش را روشن کرده؛ از تنظیمات وای‌فای،
                    به اسم هات‌اسپات او وصل شو — مثل وقتی که به وای‌فای خونه وصل می‌شی.
                  </div>
                  <div className="wf-scan-art" aria-hidden>
                    <span className="wf-phone" /><span className="wf-waves w1" /><span className="wf-waves w2" /><span className="wf-waves w3" />
                  </div>
                  <button type="button" className="ps-act start" style={{ width: "100%" }}
                    onClick={() => { Audio.sfxClick(); void PartyNet.openWifiSettings?.(); }}>
                    باز کردن تنظیمات وای‌فای
                  </button>
                  <button type="button" className="ps-act go" style={{ width: "100%" }}
                    onClick={() => { Audio.sfxClick(); setGuest("scanning"); void doGuest(); }}>
                    وصل شدم — میزبان رو پیدا کن
                  </button>
                  <button type="button" className="wf-scan-cancel" onClick={() => { Audio.sfxClick(); setGuest(null); }}>
                    انصراف
                  </button>
                </>
              )}
              {guest === "scanning" && (
                <>
                  <div className="wf-scan-badge">قدم ۲ از ۲</div>
                  <div className="wf-scan-t">دنبال میزبان می‌گردیم…</div>
                  <div className="wf-radar" aria-hidden>
                    <span className="wf-radar-ring r1" />
                    <span className="wf-radar-ring r2" />
                    <span className="wf-radar-ring r3" />
                    <span className="wf-radar-dot" />
                  </div>
                  <div className="wf-scan-d" style={{ textAlign: "center" }}>
                    اول امواج وای‌فای، بعد پویش کامل شبکه — تا چند ثانیه طول می‌کشد.
                    <br />
                    اگر پیدا نشد: مطمئن شو وای‌فای تو روشنه و به هات‌اسپات میزبان وصلی، بعد دوباره تلاش کن.
                  </div>
                  <button type="button" className="wf-scan-cancel"
                    onClick={() => { scanRef.current++; Audio.sfxClick(); setGuest(null); }}>
                    لغو جست‌وجو
                  </button>
                </>
              )}
              {guest !== "step1" && guest !== "scanning" && (
                <>
                  <div className="wf-scan-t">پیدا نشد!</div>
                  <div className="wf-scan-d">{guest}</div>
                  <button type="button" className="ps-act go" style={{ width: "100%" }}
                    onClick={() => { setGuest("scanning"); void doGuest(); }}>
                    تلاش دوباره
                  </button>
                  <button type="button" className="wf-scan-cancel" onClick={() => { Audio.sfxClick(); setGuest(null); }}>
                    بازگشت
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Sheet>
    );
  }

  /* ---------- browser/dev variant (room codes, party-hub) ---------- */
  return (
    <Sheet bg="/assets/bg/map2b.webp" bgDim={0.3}>
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="بازگشت" onClick={onExit}>✕</button>
        <div className="sheet-title" style={{ fontSize: 16, padding: "7px 22px" }}>بازی با وای‌فای</div>
        <span style={{ width: 40 }} />
      </div>

      <div className="scrolly">
        <div className="wf-net-badge" aria-live="polite">
          <span className={`wf-dot ${netUp ? "on" : ""}`} />
          {netUp ? "متصل به اتاق‌های دورهمی" : "در حال اتصال…"}
        </div>

        <div className="panel rise-in" style={{ borderRadius: 22, padding: 14 }}>
          <div className="ps-row-label">تو کی هستی؟</div>
          <div className="ps-player">
            <button type="button" className="ps-pavatar" onClick={cycleAvatar} aria-label="تغییر آواتار">
              <AvatarFace id={avatar} size={44} />
            </button>
            <input
              className="name-input"
              style={{ flex: 1, margin: 0 }}
              value={name}
              maxLength={12}
              placeholder="اسم تو"
              onChange={(e) => setName(e.target.value)}
              aria-label="اسم تو"
            />
          </div>
        </div>

        <div className="pm-cards" style={{ marginTop: 12 }}>
          <button type="button" className="pm-card" disabled={busy} onClick={onCreate}>
            <span className="pm-t">🏠 ساخت اتاق جدید</span>
            <span className="pm-d">یک اتاق بساز، کدش را به دوستانت بده و مسابقه را شروع کن</span>
            <span className="pm-go">ساخت اتاق ‹</span>
          </button>
        </div>
        {menuErr && <div className="wf-err" style={{ textAlign: "center", marginTop: 8 }}>{menuErr}</div>}

        <div className="panel rise-in" style={{ borderRadius: 22, padding: 14, marginTop: 12 }}>
          <div className="ps-row-label">یا با کد وارد شو</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="name-input wf-code-input"
              style={{ flex: 1, margin: 0, textAlign: "center", letterSpacing: 8, fontSize: 20, fontWeight: 800 }}
              value={code}
              maxLength={4}
              placeholder="AB23"
              autoCapitalize="characters"
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "")); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void doJoin(); }}
              aria-label="کد اتاق"
            />
            <button type="button" className="wf-join-btn" disabled={busy} onClick={() => void doJoin()}>
              {busy ? "…" : "ورود"}
            </button>
          </div>
          {err && <div className="wf-err">{err}</div>}
        </div>

        <div className="wf-tip">{tip}</div>
        <div style={{ height: 24 }} />
      </div>
    </Sheet>
  );
}

/* ================= LOBBY =================
 * v5 — LAN variant swaps the room-code plate for the HOTSPOT plate:
 * the user's flow is «هات‌اسپات روشن → دوستان وصل می‌شن → لیست
 * دستگاه‌ها» — the gathering point is the hotspot, not a code.
 * ------------------------------------------------------------------ */
function WifiLobby({
  state, amHost, lan, onCfg, onStart, onLeave, reacts, onOpenRules,
}: {
  state: NetState;
  amHost: boolean;
  lan: boolean;
  onCfg: (rounds?: number, seconds?: number) => void;
  onStart: () => void;
  onLeave: () => void;
  reacts: { id: number; emoji: string; name: string }[];
  onOpenRules: () => void;
}) {
  const [tip, setTip] = useState(() => pick(lan ? WIFI_TIPS_LAN : WIFI_TIPS));
  const copy = async () => {
    Audio.sfxClick();
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may be blocked — the code is big on screen */ }
  };
  const [copied, setCopied] = useState(false);
  const canStart = state.players.length >= 2;

  return (
    <Sheet bg="/assets/bg/map2b.webp" bgDim={0.3}>
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="خروج" onClick={onLeave}>✕</button>
        <div className="sheet-title" style={{ fontSize: 16, padding: "7px 22px" }}>اتاق انتظار</div>
        <span style={{ width: 40 }} />
      </div>

      <div className="scrolly">
        {/* the gathering point: LAN = hotspot plate · web = code plate */}
        {lan ? (
          <div className="wf-hs-plate rise-in">
            <span className="wf-hs-ic" aria-hidden>📡</span>
            <div className="wf-hs-t">{amHost ? "اتاق روی گوشی تو فعاله" : "وصل شدی به میزبان ✓"}</div>
            <div className="wf-hs-d">
              {amHost
                ? "هات‌اسپاتت روشن بمونه؛ هرکی وصل شه همین‌جا به لیست اضافه می‌شه"
                : "هر وقت میزبان بازی رو شروع کنه، دور برات باز می‌شه"}
            </div>
            <span className={`wf-hs-count ${canStart ? "ok" : ""}`}>
              {faNum(state.players.length)} دستگاه وصل شد
            </span>
            {/* v7 — the host's #1 trip-up is a hotspot that never got
                turned on: put the settings shortcut right here */}
            {amHost && !canStart && (
              <button type="button" className="wf-hs-btn"
                onClick={() => { Audio.sfxClick(); void PartyNet.openWifiSettings?.(); }}>
                📡 روشن کردن نقطه اتصال
              </button>
            )}
          </div>
        ) : (
          <div className="wf-code-plate rise-in">
            <div className="wf-code-label">کد اتاق</div>
            <div className="wf-code">{state.code.split("").map((c, i) => <b key={i}>{c}</b>)}</div>
            <button type="button" className="wf-copy" onClick={() => void copy()}>
              {copied ? "کپی شد! ✓" : "کپی کد"}
            </button>
            <div className="wf-code-hint">دوستانت با این کد از گوشی خودشان وارد شوند</div>
          </div>
        )}

        <div className="panel rise-in" style={{ borderRadius: 22, padding: 14 }}>
          <div className="ps-row-label">
            {lan ? "دستگاه‌ها" : "بازیکن‌ها"} <span className="ps-row-hint">({faNum(state.players.length)} از {faNum(6)})</span>
          </div>
          <div className="wf-roster">
            {state.players.map((p) => (
              <span key={p.id} className={`wf-player ${p.id === state.hostId ? "host" : ""} ${p.id === PartyNet.id ? "me" : ""}`}>
                <AvatarFace id={p.avatar} size={34} />
                <bdi>{p.name}</bdi>
                {p.id === state.hostId && <i className="wf-crown" aria-label="میزبان">👑</i>}
              </span>
            ))}
            {/* v5 — pulsing placeholder so the host SEES the room growing */}
            {lan && !canStart && Array.from({ length: 2 - state.players.length }, (_, i) => (
              <span key={`slot${i}`} className="wf-player slot" aria-hidden>
                <span className="wf-slot-ph" />در انتظار…
              </span>
            ))}
          </div>

          {amHost ? (
            <>
              <div className="ps-row-label">چند دور؟</div>
              <div className="ps-chips">
                {[2, 3, 4, 5].map((r) => (
                  <button key={r} type="button" className={`ps-chip ${state.rounds === r ? "sel" : ""}`} onClick={() => { Audio.sfxClick(); onCfg(r, undefined); }}>
                    {faNum(r)} دور
                  </button>
                ))}
              </div>
              <div className="ps-row-label">زمان هر دور؟</div>
              <div className="ps-chips">
                {[45, 60, 90].map((s) => (
                  <button key={s} type="button" className={`ps-chip ${state.seconds === s ? "sel" : ""}`} onClick={() => { Audio.sfxClick(); onCfg(undefined, s); }}>
                    {faNum(s)} ثانیه
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="wf-wait">میزبان تنظیمات را انتخاب می‌کند…</div>
          )}
        </div>

        {reacts.length > 0 && (
          <div className="wf-reacts">{reacts.map((r) => <ReactionBubble key={r.id} emoji={r.emoji} name={r.name} />)}</div>
        )}

        {amHost ? (
          <button
            type="button"
            className="play-big party-start"
            style={{ opacity: canStart ? 1 : 0.55 }}
            onClick={() => { if (canStart) { Audio.sfxChapterUnlock(); onStart(); } else Audio.sfxWrong(); }}
          >
            {canStart ? "شروع مسابقه!" : "حداقل ۲ نفر لازم است"}
          </button>
        ) : (
          <div className="wf-wait" style={{ textAlign: "center", padding: 14 }}>منتظر شروع مسابقه…</div>
        )}

        <button type="button" className="ps-tip-next" style={{ margin: "10px auto 0" }} onClick={() => { Audio.sfxClick(); setTip(pick(lan ? WIFI_TIPS_LAN : WIFI_TIPS)); }}>
          {tip}
        </button>
        <div className="wf-menu-links" style={{ marginTop: 10 }}>
          <button type="button" className="wf-link-btn" onClick={onOpenRules}>📜 قوانین بازی</button>
        </div>
        <div style={{ height: 24 }} />
      </div>
    </Sheet>
  );
}

/* ================= ROUND (the simultaneous race) ================= */
function WifiRound({
  state, roundInfo, amHost, meId, onEndRound, onLeave, reacts,
}: {
  state: NetState;
  roundInfo: { round: number; of: number; ls: string[]; seconds: number };
  amHost: boolean;
  meId: string;
  onEndRound: () => void;
  onLeave: () => void;
  reacts: { id: number; emoji: string; name: string }[];
}) {
  const ls = roundInfo.ls;
  /* hub-claimed words this round: word → owner name (for the live list) */
  const [claimed, setClaimed] = useState<{ w: string; by: string; me: boolean }[]>([]);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.players.map((p) => [p.id, p.score])));
  const [waitingEnd, setWaitingEnd] = useState(false);
  const takenMsgRef = useRef<{ set: (s: string) => void } | null>(null);

  const rivals = useMemo(
    () => state.players.map((p) => ({ ...p, score: scores[p.id] ?? p.score }))
              .sort((a, b) => b.score - a.score),
    [state.players, scores],
  );

  /* hub events → UI */
  useEffect(() => {
    const offScored = PartyNet.on("word:scored", (x: { pid: string; word: string; pts: number; scores: { id: string; score: number }[] }) => {
      setScores(Object.fromEntries(x.scores.map((s) => [s.id, s.score])));
      setClaimed((cs) => (cs.some((c) => c.w === x.word) ? cs : [{ w: x.word, by: x.pid === meId ? "تو" : (state.players.find((p) => p.id === x.pid)?.name ?? ""), me: x.pid === meId }, ...cs].slice(0, 8)));
      if (x.pid === meId) Audio.sfxWordFound(claimed.length + 1);
      else Audio.sfxLetter(1); /* someone else scored — soft blip */
    });
    const offTaken = PartyNet.on("word:taken", () => {
      takenMsgRef.current?.set("این واژه قبلاً گرفته شد!");
      Audio.sfxWrong();
      buzz([30, 40, 30], Save.data.settings.haptics);
    });
    return () => { offScored(); offTaken(); };
  }, [meId, state.players]);

  const timerEnd = () => {
    if (amHost) onEndRound();
    else setWaitingEnd(true);
  };

  return (
    <Sheet bg="/assets/bg/sunset2b.webp" bgDim={0.22}>
      {/* top bar */}
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="خروج" onClick={onLeave}>✕</button>
        <div className="wf-roundchip">دور {faNum(roundInfo.round)} از {faNum(roundInfo.of)}</div>
        <div className="wf-code-mini">{state.code}</div>
      </div>

      {/* live rivals strip */}
      <div className="wf-strip">
        {rivals.map((p) => (
          <span key={p.id} className={`wf-rival ${p.id === meId ? "me" : ""}`}>
            <AvatarFace id={p.avatar} size={30} />
            <bdi>{p.id === meId ? "تو" : p.name}</bdi>
            <i>{faNum(p.score)}</i>
          </span>
        ))}
      </div>

      <div className="ps-board">
        <div className="ps-wheel-zone">
          <div className="pt-timer-holder">
            <TurnTimer ms={roundInfo.seconds * 1000} onEnd={timerEnd} />
          </div>
          <WifiRing
            ls={ls}
            onClaim={(w) => PartyNet.claimWord(w)}
            takenMsgRef={takenMsgRef}
          />
        </div>

        <div className="ps-msgrow" aria-live="polite">
          {waitingEnd && <span className="ps-dk">زمان تمام شد — منتظر میزبان…</span>}
        </div>

        {/* reactions */}
        <div className="wf-reactbar">
          {REACTS.map((e) => (
            <button key={e} type="button" className="wf-react-btn" onClick={() => { Audio.sfxClick(); PartyNet.react(e); }} aria-label={`واکنش ${e}`}>
              {e}
            </button>
          ))}
        </div>

        {amHost ? (
          <div className="ps-actions">
            <button type="button" className="ps-act finish" onClick={() => { Audio.sfxClick(); onEndRound(); }}>
              پایان دور
            </button>
          </div>
        ) : <div style={{ height: 8 }} />}

        {/* live claimed words */}
        <div className="ps-turnwords">
          {claimed.map((c) => (
            <span key={c.w} className={`ps-tw ${c.me ? "mine" : ""}`}>
              {c.w} <i>{c.me ? "+تو" : c.by}</i>
            </span>
          ))}
        </div>
      </div>

      {reacts.length > 0 && <div className="wf-reacts">{reacts.map((r) => <ReactionBubble key={r.id} emoji={r.emoji} name={r.name} />)}</div>}
    </Sheet>
  );
}

/* ---------------- the shared drag ring (WiFi variant) ----------------
 * the same pointer-stroke + rAF-coalesced segment catch as the other
 * wheels; release auto-submits. No golden turn, no streak — the hub
 * decides ownership. */
function WifiRing({
  ls, onClaim, takenMsgRef,
}: {
  ls: string[];
  onClaim: (w: string) => void;
  takenMsgRef: { current: { set: (s: string) => void } | null };
}) {
  const usedWords = useRef<Set<string>>(new Set());
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<number[]>([]);
  const setSelBoth = useCallback((v: number[]) => { selRef.current = v; setSel(v); }, []);
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(0);
  const endedRef = useRef(false);
  const checkingRef = useRef(false);
  useEffect(() => { takenMsgRef.current = { set: setMsg }; }, [takenMsgRef]);

  const ringRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const centersRef = useRef<{ i: number; x: number; y: number }[]>([]);
  const dragRef = useRef(false);
  const strokeRef = useRef({ x: 0, y: 0, t: 0, moved: false });
  /* v7 — full coalesced pointer trail (same as the main Wheel) */
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const auraRef = useRef<SVGPolylineElement | null>(null);
  const coreRef = useRef<SVGPolylineElement | null>(null);
  const shineRef = useRef<SVGPolylineElement | null>(null);
  const beadRef = useRef<SVGGElement | null>(null);
  const tipTargetRef = useRef<{ x: number; y: number } | null>(null);
  const tipCurRef = useRef<{ x: number; y: number } | null>(null);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const prevPtRef = useRef<{ x: number; y: number } | null>(null);
  const catchRRef = useRef(18);
  const rafRef = useRef(0);
  const lineStrRef = useRef("");

  const measure = () => {
    const ring = ringRef.current!;
    const r = ring.getBoundingClientRect();
    rectRef.current = r;
    let tilePx = 46 * stageZoom(); /* design fallback → real px */
    const els = ring.querySelectorAll<HTMLElement>(".pw-tile");
    centersRef.current = Array.from(els).map((el) => {
      const b = el.getBoundingClientRect();
      if (b.width > 0) tilePx = b.width;
      return { i: Number(el.dataset.i), x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
    });
    const ringR = 0.38 * r.width;
    const n = Math.max(3, centersRef.current.length);
    const clear = ringR * (1 - Math.cos((2 * Math.PI) / n));
    /* v7 — the old cap (19.3px) made catches feel «hard» — size the
     * catch to the real tile and keep the pass-through clearance */
    catchRRef.current = Math.max(18, Math.min(tilePx * 0.52, clear * 0.92));
  };

  const paintLine = () => {
    const pts = selRef.current
      .map((i) => centersRef.current.find((c) => c.i === i))
      .filter(Boolean)
      .map((c) => `${c!.x},${c!.y}`);
    const tip = tipCurRef.current;
    if (tip) pts.push(`${tip.x},${tip.y}`);
    const s = pts.join(" ");
    if (s !== lineStrRef.current) {
      lineStrRef.current = s;
      auraRef.current?.setAttribute("points", s);
      coreRef.current?.setAttribute("points", s);
      shineRef.current?.setAttribute("points", s);
    }
    const bead = beadRef.current;
    if (bead) {
      if (tip) {
        bead.setAttribute("transform", `translate(${tip.x} ${tip.y})`);
        bead.setAttribute("opacity", "1");
      } else if (bead.getAttribute("opacity") !== "0") {
        bead.setAttribute("opacity", "0");
      }
    }
  };

  const distToSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  };

  const addToSel = (i: number) => {
    if (selRef.current.includes(i)) return false;
    Audio.sfxLetter(selRef.current.length % 3);
    setSelBoth([...selRef.current, i]);
    return true;
  };

  /* v7 — CATCH THE WHOLE STROKE (mirrors the main Wheel): one frame
   * can register a whole run of tiles IN ORDER, so fast strokes never
   * skip seats or feel sticky (Word-Cookies catch). */
  const catchUpTo = (pt: { x: number; y: number } | null) => {
    if (!dragRef.current || !pt) return;
    const from = prevPtRef.current ?? pt;
    if (Math.hypot(pt.x - from.x, pt.y - from.y) < 3) { prevPtRef.current = pt; return; }
    const T = catchRRef.current * catchRRef.current;
    let played = false;
    for (let guard = 0; guard < 14; guard++) {
      const cur = selRef.current;
      const seg = prevPtRef.current ?? pt;
      let best: number | null = null;
      let bestD = T;
      for (const c of centersRef.current) {
        if (cur.includes(c.i)) continue;
        const d = distToSeg(c.x, c.y, seg.x, seg.y, pt.x, pt.y);
        if (d * d < bestD) { bestD = d * d; best = c.i; }
      }
      if (best === null) break;
      if (!played) { Audio.sfxLetter(selRef.current.length % 3); played = true; }
      addToSel(best);
      const c = centersRef.current.find((c) => c.i === best)!;
      tipCurRef.current = { x: c.x, y: c.y };
      prevPtRef.current = { x: c.x, y: c.y };
      const el = ringRef.current?.querySelector<HTMLElement>(`.pw-tile[data-i="${best}"]`);
      if (el && typeof el.animate === "function") {
        el.animate(
          [{ transform: "translate(-50%,-50%) scale(1.26)" }, { transform: "translate(-50%,-50%) scale(1.07)" }],
          { duration: 200, easing: "cubic-bezier(.2,1.6,.4,1)" },
        );
      }
      if (Math.abs(pt.x - c.x) < 1 && Math.abs(pt.y - c.y) < 1) break;
    }
    prevPtRef.current = pt;
  };

  const tick = () => {
    /* v7 — consume the coalesced trail IN ORDER before the lerp */
    const trail = trailRef.current;
    if (trail.length > 0) {
      if (dragRef.current) for (const pt of trail) catchUpTo(pt);
      trail.length = 0;
    }
    const tipT = tipTargetRef.current;
    const tipC = tipCurRef.current;
    if (tipT && tipC) {
      tipC.x += (tipT.x - tipC.x) * 0.42;
      tipC.y += (tipT.y - tipC.y) * 0.42;
      if (Math.abs(tipT.x - tipC.x) < 0.5 && Math.abs(tipT.y - tipC.y) < 0.5) { tipC.x = tipT.x; tipC.y = tipT.y; }
    }
    paintLine();
    const settled = !dragRef.current && tipT && tipC && tipT.x === tipC.x && tipT.y === tipC.y;
    if (settled) { rafRef.current = 0; return; }
    rafRef.current = requestAnimationFrame(tick);
  };
  const ensureRaf = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(tick); };
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const word = sel.map((i) => ls[i]).join("");

  const clearStroke = () => {
    setSelBoth([]);
    tipTargetRef.current = null;
    tipCurRef.current = null;
    paintLine();
  };

  const submitWith = async (selArr: number[]) => {
    if (endedRef.current || checkingRef.current) return;
    if (selArr.length < 2) {
      setMsg("حداقل ۲ حرف!"); setShake((s) => s + 1); Audio.sfxWrong();
      clearStroke();
      return;
    }
    const w = selArr.map((i) => ls[i]).join("");
    if (usedWords.current.has(w)) {
      setMsg("این واژه قبلاً گرفته شد!"); setShake((s) => s + 1); Audio.sfxWrong();
      clearStroke();
      return;
    }
    if (isRealWord(w)) {
      usedWords.current.add(w);
      onClaim(w);
      clearStroke();
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    const good = await validateWord(w);
    checkingRef.current = false;
    if (good) {
      usedWords.current.add(w);
      onClaim(w);
    } else {
      setMsg("این واژه پذیرفته نشد!"); setShake((s) => s + 1); Audio.sfxWrong();
    }
    clearStroke();
  };

  const ringDown = (e: React.PointerEvent) => {
    if (endedRef.current || checkingRef.current) return;
    measure();
    const r = rectRef.current!;
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    strokeRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
    dragRef.current = true;
    ringRef.current?.classList.add("dragging");
    try { ringRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    tipCurRef.current = { x: lx, y: ly };
    prevPtRef.current = { x: lx, y: ly };
    tipTargetRef.current = { x: lx, y: ly };
    lastPtRef.current = { x: lx, y: ly };
    ensureRaf();
  };
  const ringMove = (e: React.PointerEvent) => {
    if (!dragRef.current || endedRef.current) return;
    const r = rectRef.current;
    if (!r) return;
    const st = strokeRef.current;
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 6) st.moved = true;
    /* v7 — record every coalesced sample; the tick catches along the
     * true path so quick curved strokes never cut a corner */
    const nat = e.nativeEvent as PointerEvent;
    let evs: PointerEvent[] | null = null;
    try { evs = typeof nat.getCoalescedEvents === "function" ? nat.getCoalescedEvents() : null; } catch { evs = null; }
    if (evs && evs.length > 1) {
      for (const ce of evs) trailRef.current.push({ x: ce.clientX - r.left, y: ce.clientY - r.top });
    }
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    trailRef.current.push({ x: lx, y: ly });
    tipTargetRef.current = { x: lx, y: ly };
    lastPtRef.current = { x: lx, y: ly };
    ensureRaf();
  };
  const ringUp = () => {
    if (!dragRef.current) return;
    /* v7 — flush the trail first: a fast stroke ending between two
     * frames still registers every seat it passed */
    const trail = trailRef.current;
    if (trail.length > 0) {
      for (const pt of trail) catchUpTo(pt);
      trail.length = 0;
    }
    catchUpTo(lastPtRef.current);
    dragRef.current = false;
    ringRef.current?.classList.remove("dragging");
    const st = strokeRef.current;
    if (!st.moved && Date.now() - st.t < 400) {
      tipTargetRef.current = null;
      tipCurRef.current = null;
      paintLine();
      return;
    }
    const cur = selRef.current;
    const last = cur.length ? centersRef.current.find((c) => c.i === cur[cur.length - 1]) : null;
    if (last && cur.length >= 2) {
      tipTargetRef.current = { x: last.x, y: last.y };
      ensureRaf();
    } else {
      tipTargetRef.current = null; tipCurRef.current = null; paintLine();
    }
    if (cur.length >= 2) void submitWith([...cur]);
  };

  return (
    <div
      ref={ringRef}
      className="ps-ring"
      onPointerDown={ringDown}
      onPointerMove={ringMove}
      onPointerUp={ringUp}
      onPointerCancel={ringUp}
      style={{ touchAction: "none" }}
      role="group"
      aria-label="چرخ حروف مسابقه"
    >
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden>
        <polyline ref={auraRef} points="" fill="none" stroke="rgba(255,187,56,.30)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <polyline ref={coreRef} points="" fill="none" stroke="#ffc93c" strokeWidth={10.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
        <polyline ref={shineRef} points="" fill="none" stroke="rgba(255,252,232,.9)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        <g ref={beadRef} opacity="0">
          <circle r={12} fill="rgba(255,220,110,.30)" />
          <circle r={5.5} fill="#fff6d8" stroke="#ffb302" strokeWidth="2" />
        </g>
      </svg>
      {ls.map((ch, i) => {
        const ang = -90 + (360 / ls.length) * i;
        const rad = (ang * Math.PI) / 180;
        return (
          <span
            key={i}
            data-i={i}
            className={`pw-tile ${sel.includes(i) ? "sel" : ""}`}
            style={{ left: `${50 + 38 * Math.cos(rad)}%`, top: `${50 + 38 * Math.sin(rad)}%` }}
            aria-label={`حرف ${ch}`}
          >
            {ch}
          </span>
        );
      })}
      <div className="ps-hub">
        {word ? word : <span className="ps-hub-hint">واژه بساز…</span>}
      </div>
      <div className="ps-msgrow">
        {msg && <span key={shake} className="ps-msg shake-x">{msg}</span>}
        {checking && <span className="ps-dk"><span className="spin" />در حال بررسی…</span>}
      </div>
    </div>
  );
}

/* ================= ROUND REVIEW ================= */
function WifiReview({
  state, review, amHost, onNext, onFinish, onLeave,
}: {
  state: NetState;
  review: NetReview;
  amHost: boolean;
  onNext: () => void;
  onFinish: () => void;
  onLeave: () => void;
}) {
  const rank = useMemo(() => [...review.players].sort((a, b) => b.score - a.score), [review.players]);
  const nameOf = (pid: string) => {
    if (pid === PartyNet.id) return "تو";
    return review.players.find((p) => p.id === pid)?.name ?? "؟";
  };
  const isLast = review.round >= state.rounds;

  return (
    <Sheet bg="/assets/bg/sunset2b.webp" bgDim={0.22}>
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="خروج" onClick={onLeave}>✕</button>
        <div className="wf-roundchip">پایان دور {faNum(review.round)}</div>
        <span style={{ width: 40 }} />
      </div>
      <div className="scrolly">
        <div className="ps-recap rise-in">
          <span className="ps-recap-round">واژه‌های گرفته‌شده</span>
          {review.claimed.length > 0 ? (
            <div className="wf-review-words">
              {review.claimed.map((c) => (
                <span key={c.word} className={`ps-recap-w ${c.pid === PartyNet.id ? "mine" : ""}`}>
                  {c.word} <i>{nameOf(c.pid)}</i>
                </span>
              ))}
            </div>
          ) : (
            <div className="ps-recap-none">هیچ واژه‌ای گرفته نشد!</div>
          )}
          <div className="ps-recap-stand">
            <div className="ps-recap-stand-t">جدول امتیازها</div>
            {rank.map((p, i) => (
              <div key={p.id} className={`ps-recap-row ${p.id === PartyNet.id ? "me" : ""}`}>
                <i>{faNum(i + 1)}</i>
                <b><bdi>{p.id === PartyNet.id ? "تو" : p.name}</bdi></b>
                <span className="pts">{faNum(p.score)}</span>
              </div>
            ))}
          </div>
          {amHost ? (
            <button
              type="button"
              className="ps-recap-go"
              onClick={() => { Audio.sfxClick(); if (isLast) onFinish(); else onNext(); }}
            >
              {isLast ? "دیدن برنده‌ها" : "دورِ بعدی ←"}
            </button>
          ) : (
            <div className="wf-wait">منتظر میزبان…</div>
          )}
        </div>
        <div style={{ height: 24 }} />
      </div>
    </Sheet>
  );
}

/* ================= FINAL PODIUM ================= */
function WifiOver({
  players, meId, amHost, onRematch, onLeave, onHome,
}: {
  players: NetPlayer[];
  meId: string;
  amHost: boolean;
  onRematch: () => void;
  onLeave: () => void;
  onHome: () => void;
}) {
  const rank = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const champ = rank[0];
  const seats = [
    { p: rank[1], place: 2 },
    { p: rank[0], place: 1 },
    { p: rank[2], place: 3 },
  ].filter((s) => !!s.p);
  const h = (place: number) => (place === 1 ? 92 : place === 2 ? 64 : 48);
  const medal = (place: number) => (place === 1 ? "#ffd76e" : place === 2 ? "#cfd6e4" : "#e0995c");

  return (
    <div className="vz-page ps-final">
      <div className="ps-spot" aria-hidden />
      <div className="ps-confetti" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <i key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: ["#ffd76e", "#ff8fab", "#7ce97f", "#7cc9ff", "#c9a1ff"][i % 5],
              animationDuration: `${2.4 + (i % 5) * 0.35}s`,
              animationDelay: `${(i % 7) * 0.12}s`,
            }}
          />
        ))}
      </div>

      <div className="ps-final-title title3d" data-t="پایان مسابقه!">پایان مسابقه!</div>
      <div className="ps-crown-wrap rise-in">
        <svg width="46" height="30" viewBox="0 0 46 30" aria-hidden>
          <path d="M3 26 L6 8 L15 17 L23 3 L31 17 L40 8 L43 26 Z" fill="#ffd94e" stroke="#c87f06" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="23" cy="20" r="2.6" fill="#e25c5c" /><circle cx="12" cy="21" r="2" fill="#3d9df0" /><circle cx="34" cy="21" r="2" fill="#3fae5c" />
        </svg>
        <span className="ps-champ-ava"><AvatarFace id={champ.avatar} size={78} /></span>
        <div className="ps-champ-name"><bdi>{champ.id === meId ? "تو!" : champ.name}</bdi></div>
        <div className="ps-champ-score">{faNum(champ.score)} امتیاز</div>
        {champ.id === meId && <div className="ps-final-sub">🏆 قهرمانِ واژه‌ها خودتی!</div>}
      </div>

      <div className="ps-podium">
        {seats.map(({ p, place }) => (
          <div key={p.id + place} className="ps-pod-col">
            <div className="ps-pod-ava">
              <AvatarFace id={p.avatar} size={place === 1 ? 60 : 48} />
              <span className={`ps-medal g${place}`}>{faNum(place)}</span>
            </div>
            <b className="ps-pod-name"><bdi>{p.id === meId ? "تو" : p.name}</bdi></b>
            <div className="ps-pod-block" style={{ height: h(place), background: `linear-gradient(180deg, ${medal(place)}, ${medal(place)}cc)` }}>
              <span className="ps-pod-rank">{faNum(p.score)}</span>
            </div>
          </div>
        ))}
      </div>

      {rank.length > 3 && (
        <div className="ps-rest">
          {rank.slice(3).map((p, i) => (
            <span key={p.id} className="ps-rest-row">
              <i>{faNum(i + 4)}</i> <bdi>{p.id === meId ? "تو" : p.name}</bdi> · {faNum(p.score)}
            </span>
          ))}
        </div>
      )}

      <div className="ps-final-actions">
        {amHost ? (
          <button type="button" className="play-big" style={{ fontSize: 19, padding: "10px 30px" }} onClick={() => { Audio.sfxChapterUnlock(); onRematch(); }}>
            دوباره!
          </button>
        ) : (
          <div className="wf-wait">منتظر میزبان برای دور دوباره…</div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="ps-act back" onClick={onLeave}>اتاق</button>
          <button type="button" className="ps-act finish" onClick={onHome}>صفحه اصلی</button>
        </div>
      </div>
    </div>
  );
}

/* ================= عمو دانا — WiFi WALKTHROUGH =================
 * v5 (user: «با عمو دانا آموزشش بده کامل») — a 5-step storybook
 * overlay: veil + card with the grandpa art, progress dots and
 * next/back. Auto-opens the first time the LAN menu is reached;
 * reopening lives behind the «آموزش با عمو دانا» button.
 * Transform/opacity animations only; skips nothing under lowfx (it
 * is interaction-gated, never idle-running). */
const TUT_STEPS: { t: string; d: string; art: string }[] = [
  {
    t: "سلام! من عمو دانام 👋",
    d: "این بازی دورهمی اینترنتی نمی‌خواد! هر کدوم با گوشی خودتون بازی می‌کنید و فقط وای‌فایِ گوشی‌ها به هم وصل می‌شه.",
    art: "/assets/char/hello.webp",
  },
  {
    t: "قدم ۱ — میزبان اتاق رو می‌سازه",
    d: "یک نفر «میزبان باش» رو می‌زنه و نقطه اتصال (هات‌اسپات) گوشیش رو روشن می‌کنه. اتاق بازی روی همین گوشی ساخته می‌شه و هات‌اسپات باید روشن بمونه.",
    art: "/assets/char/point.webp",
  },
  {
    t: "قدم ۲ — دوستان وصل می‌شن",
    d: "بقیه «مهمون باش» رو می‌زنن، از تنظیمات وای‌فای به هات‌اسپات میزبان وصل می‌شن — بازی خودش میزبان رو پیدا می‌کنه. اگر پیدا نشد: چک کن وای‌فای‌ت روشنه و هنوز به هات‌اسپات میزبان وصلی، بعد دوباره تلاش کن.",
    art: "/assets/char/thumb.webp",
  },
  {
    t: "قدم ۳ — میزبان بازی رو شروع می‌کنه",
    d: "میزبان تعداد دورها و زمان هر دور رو انتخاب می‌کنه و «شروع مسابقه» رو می‌زنه. همه همزمان روی یک چرخِ یکسان مسابقه می‌دید!",
    art: "/assets/char/cheer.webp",
  },
  {
    t: "قانون طلایی ⭐",
    d: "دست بکش روی حروف، واژه بساز و رها کن. اولین نفری که یک واژه رو بسازه مالکشه — هر واژه فقط یک بار! آخر بازی هم سکوی قهرمانی منتظرتونه.",
    art: "/assets/char/hello.webp",
  },
];

function WifiTut({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const s = TUT_STEPS[i];
  const next = () => {
    Audio.sfxClick();
    if (i + 1 >= TUT_STEPS.length) onClose();
    else setI(i + 1);
  };
  return (
    <div className="wf-tut-veil" role="dialog" aria-label="آموزش دورهمی وای‌فای">
      <div className="wf-tut-card">
        <div className="wf-tut-art" style={{ backgroundImage: `url(${s.art})` }} aria-hidden />
        <div className="wf-tut-step">آموزش {faNum(i + 1)} از {faNum(TUT_STEPS.length)}</div>
        <div className="wf-tut-t">{s.t}</div>
        <div className="wf-tut-d">{s.d}</div>
        <div className="wf-tut-dots" aria-hidden>
          {TUT_STEPS.map((_, k) => (
            <span key={k} className={`wf-tut-dot ${k === i ? "on" : ""} ${k < i ? "done" : ""}`} />
          ))}
        </div>
        <div className="wf-tut-btns">
          {i > 0 && (
            <button type="button" className="ps-act back" onClick={() => { Audio.sfxClick(); setI(i - 1); }}>
              قبلی
            </button>
          )}
          <button type="button" className="ps-act go" onClick={next}>
            {i + 1 >= TUT_STEPS.length ? "فهمیدم، بریم! 🎉" : "بعدی ‹"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= RULES SHEET ================= */
const RULES: { t: string; d: string }[] = [
  { t: "📡 اتصال", d: "میزبان هات‌اسپاتش رو روشن می‌کنه؛ بقیه بهش وصل می‌شن. هیچ اینترنتی لازم نیست — فقط وای‌فای بین گوشی‌ها." },
  { t: "🎡 چرخ مشترک", d: "هر دور همه با حروف یک چرخ یکسان مسابقه می‌دن — کاملاً عادلانه." },
  { t: "✋ ساخت واژه", d: "انگشتت رو روی حروف بکش تا یک واژه بسازه و رها کن. واژه باید معنادار باشه (واژه‌نامه تو گوشی خودته)." },
  { t: "⚡ اولویت با سریع‌تره", d: "اولین نفری که یک واژه رو بسازه مالکش می‌شه؛ بقیه «این واژه قبلاً گرفته شد!» می‌بینن." },
  { t: "💯 امتیاز", d: "هر حرف ۱۰ امتیاز — واژه‌های بلندتر طلا شدن!" },
  { t: "⏱ زمان", d: "هر دور زمان محدود داره؛ وقت تموم شه میزبان دور رو می‌بنده و مرور امتیازها میاد." },
  { t: "🏆 پایان", d: "بعد از آخرین دور، سکوی قهرمانی نشان می‌ده که کی پادشاه واژه‌هاست!" },
];

function WifiRules({ onClose }: { onClose: () => void }) {
  return (
    <div className="wf-tut-veil" role="dialog" aria-label="قوانین بازی">
      <div className="wf-tut-card rules">
        <div className="wf-tut-t" style={{ marginTop: 0 }}>📜 قوانین دورهمی</div>
        <div className="wf-rules-list">
          {RULES.map((r) => (
            <div key={r.t} className="wf-rule-row">
              <div className="wf-rule-t">{r.t}</div>
              <div className="wf-rule-d">{r.d}</div>
            </div>
          ))}
        </div>
        <button type="button" className="ps-act go" style={{ width: "100%" }} onClick={() => { Audio.sfxClick(); onClose(); }}>
          فهمیدم!
        </button>
      </div>
    </div>
  );
}
