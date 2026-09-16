"use client";
/* ------------------------------------------------------------------
 * PartyScreen — «بازی دورهمی» (v2.4, session O)
 * A creative pass-and-play party mode for 2..6 friends on ONE phone:
 *   1. SETUP   → player count + names (Persian OR English both fine —
 *                wrapped in <bdi> so Latin names never break the RTL
 *                layout) + avatars + rounds; عمو دانا explains the game
 *   2. HANDOFF → big «نوبتِ …» card with a personalized pep line
 *   3. TURN    → 40s ring; tap the wheel letters to build words; every
 *                real word scores (length + SPEED + streak) ×2 on the
 *                golden turn; عمو دانا drops a coaching line each turn
 *   4. FINAL   → confetti podium, spotlights, personalized superlatives
 * v2.4 (user): «جملات رو افزایش بده … همه اسم‌ها توی جملات باشه» →
 * the whole message bank is now TEMPLATED with the actual player names
 * (dozens of fresh lines per event, all family-friendly).
 * Design: warm wooden party look, static CSS only (zero idle anims).
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/game/ui/kit";
import { AVATARS, AvatarFace } from "@/components/game/avatars";
import { LEVELS, isRealWord } from "@/game/data/levelsIndex";
import { letters, faNum, buzz } from "@/game/core/utils";
import { validateWord, LEXICON_WORDS } from "@/game/core/lexicon";
import { Audio } from "@/game/core/audio";
import { Save } from "@/game/core/save";

const TURN_MS = 40_000;
type Phase = "setup" | "handoff" | "turn" | "recap" | "final";

interface PConf { name: string; avatar: string }
interface PState { name: string; avatar: string; score: number; streak: number; best: number; words: number }

/* ---------------- helpers ---------------- */

/** pick a random item */
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** pick a random unused level wheel (letters + valid word set) */
function pickWheel(used: Set<string>): { key: string; ls: string[]; words: Set<string> } {
  for (let t = 0; t < 60; t++) {
    const c = Math.floor(Math.random() * LEVELS.length);
    const list = LEVELS[c];
    const i = Math.floor(Math.random() * list.length);
    const key = `${c}:${i}`;
    if (used.has(key)) continue;
    used.add(key);
    const lv = list[i];
    return { key, ls: letters(lv.wheel), words: new Set([...lv.words, ...lv.bonus]) };
  }
  const lv = LEVELS[0][0];
  return { key: "0:0", ls: letters(lv.wheel), words: new Set(lv.words) };
}

const scoreWord = (len: number, speedSec: number, streak: number, golden: boolean) => {
  const base = len * 10 + Math.max(0, speedSec) * 2 + Math.max(0, streak) * 10;
  return base * (golden ? 2 : 1);
};

/* ---------------- جملات دورهمی — name-templated, family-friendly ----------------
 * {n} = player name. Dozens of variants per event → never repetitive. */
const HANDOFF_LINES = [
  "{n}، آماده‌ای؟ واژه‌ها سرِ راهن!",
  "نوبتِ {n} است — نشان بده چه‌کارا می‌کنی!",
  "{n}، چرخ آماده‌ست؛ واژه‌ها منتظرن!",
  "دست‌ها روی موبایل، چشم‌ها به چرخ — {n}!",
  "{n} عزیز، سریع باش، زمان می‌گذره!",
  "حالا نوبت {n} است که بدرخشه!",
  "{n}، یک نفس عمیق… و شروع!",
  "واژه‌خونه‌ها جای {n} خالی‌نشد!",
  "{n}، امتیازها هوایت را دارند!",
  "چراغ‌ها روشن، دوربین روی {n}!",
];
const TURN_CHEERS = [
  "{n}، چه واژه‌ای ساختی؟",
  "یک واژه دیگر، {n}!",
  "{n}، زنجیره‌ات را ادامه بده!",
  "واژه‌های بلندتر، امتیاز بیشتر، {n}!",
  "عجله کن {n}، زمان نمی‌ایستد!",
  "{n}، چرخ طلایی هوایت را دارد!",
  "آفرین {n}، همین‌طوری!",
  "{n}، قهرمان واژه‌ها همین‌جا نشسته!",
];
const COACH_TIPS = [
  "سلام! من عمو دانا‌م. هر بازیکن در نوبتش باید تا پایان زمان، واژه‌های واقعی بسازد!",
  "واژه‌های بلندتر امتیاز بیشتری دارند — حواست به حرف‌های اضافه باشد!",
  "واژه‌های پنهان را بسازی، امتیاز پنهان می‌گیری… یعنی خیلی بیشتر!",
  "نوبتِ آخرِ هر دور، چرخِ طلایی است: همه امتیازها دو برابر!",
  "اگر سریع واژه بسازی، پاداشِ سرعت هم می‌گیری!",
  "زنجیرهٔ واژه‌های پشت‌سرهم امتیاز اضافه دارد — نبرد را رها نکن!",
  "این حرف‌ها را با هم بچین تا واژه بسازی؛ من همین‌جا تماشا می‌کنم!",
  "واژه‌ها باید واقعی باشند؛ ساختِ بی‌معنا امتیازی ندارد!",
];
const FINISH_LINES = [
  "چه دورهمی گرمی بود!",
  "خنده‌ها و واژه‌ها، هر دو تمام‌نشده!",
  "دور بعدی رو برای انتقام آماده شو!",
  "واژه‌ها امروز حسابی چرخیدند!",
  "این دورهمی تاریخ‌ساز شد!",
];
const SUPERLATIVES: { cond: (p: PState, all: PState[]) => boolean; line: (p: PState) => string }[] = [
  { cond: (p) => p.best >= 60, line: (p) => `سریع‌ترین واژه‌ها از {n} بود!`.replace("{n}", p.name) },
  { cond: (p, all) => all.filter((x) => x.score === all[0].score).length > 1, line: (p) => `مساوی شدید — حتماً یک دورِ تعیین‌کننده با ${p.name}!` },
];

/* ---------------- countdown ring (own state → parent never re-renders) ---------------- */
function TurnTimer({ ms, onEnd }: { ms: number; onEnd: () => void }) {
  const C = 2 * Math.PI * 26;
  const [run, setRun] = useState(false);
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  const leftRef = useRef(left);
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; });
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const rem = Math.max(0, ms - (Date.now() - t0));
      const s = Math.ceil(rem / 1000);
      if (s !== leftRef.current) {
        leftRef.current = s;
        setLeft(s);
        if (s <= 3 && s > 0) Audio.sfxLetter(2); /* gentle final ticks */
      }
      if (rem <= 0) { clearInterval(id); endRef.current(); }
    }, 200);
    const raf = requestAnimationFrame(() => setRun(true)); /* arm the ring transition */
    return () => { clearInterval(id); cancelAnimationFrame(raf); };
  }, [ms]);
  const low = left <= 5;
  return (
    <div className={`pt-timer ${low ? "low" : ""}`} aria-label={`${faNum(left)} ثانیه`}>
      <svg width="66" height="66" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(74,44,14,.35)" strokeWidth="6" />
        <circle
          className="pt-ring"
          cx="32" cy="32" r="26" fill="none"
          stroke={low ? "#ff5b5b" : "#ffd76e"} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={run ? C : 0}
          transform="rotate(-90 32 32)"
          style={{ transition: `stroke-dashoffset ${ms}ms linear` }}
        />
      </svg>
      <b>{faNum(left)}</b>
    </div>
  );
}

/* ---------------- عمو دانا — the party coach ---------------- */
function Coach({ line, small }: { line: string; small?: boolean }) {
  return (
    <div className={`pt-coach ${small ? "small" : ""}`}>
      <img src="/assets/img/grandpa.webp" alt="عمو دانا" draggable={false} />
      <div className="pt-coach-bubble">{line}</div>
    </div>
  );
}

/* ---------------- festive garland (static CSS lights) ---------------- */
function Garland() {
  return (
    <div className="pt-garland" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ background: ["#ffd76e", "#ff8fab", "#7ce97f", "#7cc9ff", "#c9a1ff"][i % 5] }} />
      ))}
    </div>
  );
}

/* ================= SETUP ================= */
function Setup({ onStart, onExit }: { onStart: (ps: PConf[], rounds: number) => void; onExit: () => void }) {
  const [count, setCount] = useState(3);
  const [rounds, setRounds] = useState(3);
  const [conf, setConf] = useState<PConf[]>(
    AVATARS.slice(0, 6).map((a, i) => ({ name: "", avatar: a.id })) /* fixed pool, index = default avatar */
  );
  const [tip, setTip] = useState(() => COACH_TIPS[0]); /* عمو دانا explains the game */

  const cycleAvatar = (i: number) => {
    Audio.sfxClick();
    setConf((cs) => {
      const used = new Set(cs.filter((_, j) => j !== i).map((c) => c.avatar));
      const order = [...AVATARS, ...AVATARS];
      const cur = order.findIndex((a) => a.id === cs[i].avatar);
      for (let k = cur + 1; k < order.length; k++) {
        if (!used.has(order[k].id)) {
          const next = [...cs];
          next[i] = { ...next[i], avatar: order[k].id };
          return next;
        }
      }
      return cs;
    });
  };

  return (
    <Sheet bg="/assets/bg/map2b.webp" bgDim={0.3}>
      <Garland />
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="بازگشت" onClick={onExit}>✕</button>
        <div className="sheet-title" style={{ fontSize: 16, padding: "7px 22px" }}>بازی دورهمی</div>
        <span style={{ width: 40 }} />
      </div>

      <div className="scrolly">
        {/* v4 — the enlarged dictionary is a selling point: show its size
            (user: «دایره لغات بازی دورهمی افزایش بده ۱۰۰۰ تا لغت بزار») */}
        <div
          className="ps-pool-badge"
          style={{
            margin: "4px auto 10px", width: "fit-content", maxWidth: "92%",
            background: "linear-gradient(180deg,rgba(255,236,170,.95),rgba(255,214,90,.95))",
            border: "2px solid #fff", outline: "1.5px solid #c98a1d", borderRadius: 999,
            color: "#6b4a1e", fontWeight: 800, fontSize: 12.5, padding: "5px 14px",
            boxShadow: "0 3px 0 #b47708", textAlign: "center",
          }}
          aria-live="polite"
        >
          بیش از {faNum(LEXICON_WORDS)} واژهٔ فارسی در چرخِ دورهمی!
        </div>
        {/* عمو دانا teaches the game (user: «عمو دانا بیاد بازی رو یاد بده») */}
        <Coach line={tip} />
        <button
          type="button"
          className="ps-tip-next"
          onClick={() => { Audio.sfxClick(); setTip(pick(COACH_TIPS)); }}
          aria-label="نکته بعدی"
        >
          نکتهٔ بعدی ✨
        </button>

        <div className="panel rise-in" style={{ borderRadius: 22, padding: 14 }}>
          <div className="ps-row-label">چند نفرید؟</div>
          <div className="ps-chips">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n} type="button"
                className={`ps-chip ${count === n ? "sel" : ""}`}
                onClick={() => { Audio.sfxClick(); setCount(n); }}
              >{faNum(n)} نفر</button>
            ))}
          </div>

          <div className="ps-row-label">بازیکن‌ها <span className="ps-row-hint">(اسم فارسی یا انگلیسی)</span></div>
          <div className="ps-players">
            {conf.slice(0, count).map((c, i) => (
              <div key={i} className="ps-player">
                <button type="button" className="ps-pavatar" onClick={() => cycleAvatar(i)} aria-label="تغییر آواتار">
                  <AvatarFace id={c.avatar} size={44} />
                </button>
                <input
                  className="name-input"
                  style={{ flex: 1, margin: 0 }}
                  value={c.name}
                  maxLength={12}
                  placeholder={`بازیکن ${faNum(i + 1)}`}
                  onChange={(e) => setConf((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  aria-label={`اسم بازیکن ${faNum(i + 1)}`}
                />
              </div>
            ))}
          </div>

          <div className="ps-row-label">چند دور؟</div>
          <div className="ps-chips">
            {[3, 5, 7].map((r) => (
              <button
                key={r} type="button"
                className={`ps-chip ${rounds === r ? "sel" : ""}`}
                onClick={() => { Audio.sfxClick(); setRounds(r); }}
              >{faNum(r)} دور</button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="play-big party-start"
          onClick={() => {
            Audio.sfxChapterUnlock();
            onStart(
              conf.slice(0, count).map((c, i) => ({ ...c, name: c.name.trim() || `بازیکن ${faNum(i + 1)}` })),
              rounds,
            );
          }}
        >
          شروع دورهمی!
        </button>
        <div style={{ height: 24 }} />
      </div>
    </Sheet>
  );
}

/* ================= HANDOFF =================
 * v1.22 — the next player starts with a BUTTON (user: «سریع نره نفر
 * بعدی نه — یک دکمه ظاهر شه که نوبت نفر بعدیه و شخص بزنه روی دکمه
 * بره نفر بعد»): no more 2.3s auto-start — the phone is passed around
 * calmly and the turn begins only when «شروع!» is pressed. */
function Handoff({ p, round, rounds, total, onGo }: {
  p: PState; round: number; rounds: number; total: { name: string; avatar: string; score: number }[]; onGo: () => void;
}) {
  const rank = [...total].sort((a, b) => b.score - a.score);
  return (
    <div className="vz-page ps-handoff">
      <Garland />
      <div className="ps-hand-card rise-in">
        <div className="ps-hand-round">دور {faNum(round)} از {faNum(rounds)}</div>
        <AvatarFace id={p.avatar} size={92} />
        <div className="ps-hand-name">نوبتِ <bdi>{p.name}</bdi>!</div>
        <div className="ps-hand-hint">{pick(HANDOFF_LINES).replace("{n}", p.name)}</div>
        <div className="ps-hand-ranks">
          {rank.slice(0, 3).map((r, i) => (
            <span key={r.name} className="ps-rank-chip">
              <i>{faNum(i + 1)}</i> <bdi>{r.name}</bdi> · {faNum(r.score)}
            </span>
          ))}
        </div>
        {/* Z-FAIR (user: «نوبت رو عادلانه تر بکن تعداد کلمات برای هر
         * فرد») — everyone plays the SAME letters this round, and the
         * full word pool is fresh for every player. */}
        <div className="ps-fair-note">⚖️ همه با همین حرف‌ها بازی می‌کنند — کاملاً عادلانه!</div>
        <button type="button" className="ps-hand-go" onClick={() => { Audio.sfxClick(); onGo(); }}>
          شروع!
        </button>
      </div>
    </div>
  );
}

/* ================= TURN ================= */
function TurnGame({
  p, round, rounds, golden, wheel, onWord, onTurnEnd, onExit,
}: {
  p: PState;
  round: number; rounds: number;
  golden: boolean;
  /** Z-FAIR — the ROUND wheel: every player in this round faces the
   *  EXACT same letters (pass-and-play Boggle fairness), so the words
   *  available («تعداد کلمات») are identical for each person. */
  wheel: { key: string; ls: string[]; words: Set<string> };
  onWord: (pts: number, word: string) => void;
  onTurnEnd: (scored: boolean, words: { w: string; pts: number }[]) => void;
  onExit: () => void;
}) {
  const levelWords = wheel.words;
  /* Z-FAIR — words already said this TURN only. (The old global set
   * meant player 2 lost every word player 1 found — with the shared
   * round wheel that was a real handicap. Now each player faces the
   * FULL pool of the same wheel: perfectly equal opportunity.)
   * The component remounts every turn (key=round:turnIdx) so a plain
   * ref is naturally per-turn. */
  const usedWords = useRef<Set<string>>(new Set());
  /* X-FIX — the «تعداد واژه‌های موجود» counter is GONE (user request).
   * The FULL-dictionary scan it used to run (~۸٬۸۰۰ canBuild checks per
   * wheel, on the render path) was also pure wasted phone CPU — a nice
   * speedup for the very screen that complained about lag. */
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<number[]>([]);
  const setSelBoth = useCallback((v: number[]) => { selRef.current = v; setSel(v); }, []);
  const [turnWords, setTurnWords] = useState<{ w: string; pts: number }[]>([]);
  const turnWordsRef = useRef(turnWords);
  useEffect(() => { turnWordsRef.current = turnWords; }, [turnWords]);
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false); /* offline lexicon check */
  const [shake, setShake] = useState(0);
  const [pops, setPops] = useState<{ id: number; pts: number }[]>([]);
  const popId = useRef(0);
  const endedRef = useRef(false);
  const checkingRef = useRef(false);
  const t0Ref = useRef(Date.now());
  /* عمو دانا's coaching line for THIS turn */
  const coachLine = useMemo(() => pick(COACH_TIPS.slice(1)), []);
  const cheer = useMemo(() => pick(TURN_CHEERS).replace("{n}", p.name), [p.name]);

  /* v1.22 — DRAGGABLE PARTY RING (user: «اونجا هم کلمات رو کشیدنی
   * بکن»): the same pointer-stroke the main wheel uses.
   * SESSION Y: the golden 3-layer RIBBON + the glowing finger-bead
   * draw through the stroke exactly like the main wheel, and the
   * drag is rAF-COALESCEd — pointermove only records the finger;
   * the single rAF tick does the hit-test + painting.
   * SESSION Z (user: «وقتی یبار میزنی روی کلمه انتخاب میشه هایلات
   * میشه این رو درست بکن و فقط با کشیدن کلمات انتخاب شن»): the
   * tap-to-select/toggle behavior is GONE — pointerdown NO LONGER
   * lights a tile, and a quick tap does NOTHING. A letter joins the
   * word ONLY when the finger DRAGS through its path (the segment
   * catch below). */
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const centersRef = useRef<{ i: number; x: number; y: number }[]>([]);
  const dragRef = useRef(false);
  const strokeRef = useRef({ x: 0, y: 0, t: 0, moved: false, before: [] as number[], tile: null as number | null });
  /* ribbon SVG + finger bead (painted by direct DOM writes) */
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
    const R = Math.max(30, r.width * 0.16); /* TAP radius */
    const els = ring.querySelectorAll<HTMLElement>(".pw-tile");
    centersRef.current = Array.from(els).map((el) => {
      const b = el.getBoundingClientRect();
      return { i: Number(el.dataset.i), x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
    });
    /* Y — tight SEGMENT catch radius (same anti-graze math as the main
     * wheel): a stroke skipping a seat can never graze it */
    const ringR = 0.38 * r.width;
    const n = Math.max(3, centersRef.current.length);
    const clear = ringR * (1 - Math.cos((2 * Math.PI) / n));
    catchRRef.current = Math.max(14, Math.min(19.3, clear * 0.85));
    return R;
  };
  const hitTile = (lx: number, ly: number, R: number): number | null => {
    let best: number | null = null;
    let bd = R * R;
    for (const c of centersRef.current) {
      const dx = c.x - lx, dy = c.y - ly;
      const d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = c.i; }
    }
    return best;
  };
  void hitTile; /* Z — taps never select; kept for potential tooling */
  const addToSel = (i: number) => {
    if (selRef.current.includes(i)) return false;
    Audio.sfxLetter(selRef.current.length % 3);
    setSelBoth([...selRef.current, i]);
    return true;
  };

  /* ---- the ribbon: selected tile centers + the chasing finger tip,
   * written straight to the polylines (skip-unchanged guard so idle
   * frames cost nothing) ---- */
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

  /* distance from point P to segment AB — the Y catch primitive */
  const distToSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  };

  /* the single per-frame worker: tail lerp → coalesced SEGMENT catch →
   * paint. A tile is caught when the finger PATH passes within catchR
   * of its center — never merely by coming close (no grazed seats).
   * ringUp() flushes it synchronously — a release can never miss. */
  const catchUpTo = (pt: { x: number; y: number } | null) => {
    if (!dragRef.current || !pt) return;
    const from = prevPtRef.current ?? pt;
    /* Z — DRAG-ONLY: a stationary finger catches NOTHING (a segment of
     * ~zero length would sit ON the pressed tile at distance 0 and
     * light it up on a mere tap). Any real movement immediately
     * catches the tile under the path start — so drags still begin
     * naturally from the press point. */
    if (Math.hypot(pt.x - from.x, pt.y - from.y) < 3) { prevPtRef.current = pt; return; }
    const T = catchRRef.current * catchRRef.current;
    let best: number | null = null;
    let bestD = T;
    const cur = selRef.current;
    for (const c of centersRef.current) {
      if (cur.includes(c.i)) continue;
      const d = distToSeg(c.x, c.y, from.x, from.y, pt.x, pt.y);
      if (d * d < bestD) { bestD = d * d; best = c.i; }
    }
    if (best === null) { prevPtRef.current = pt; return; }
    addToSel(best);
    /* tail snaps to the newly caught tile, then keeps chasing */
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
  };

  const tick = () => {
    const tipT = tipTargetRef.current;
    const tipC = tipCurRef.current;
    if (tipT && tipC) {
      tipC.x += (tipT.x - tipC.x) * 0.32;
      tipC.y += (tipT.y - tipC.y) * 0.32;
      if (Math.abs(tipT.x - tipC.x) < 0.5 && Math.abs(tipT.y - tipC.y) < 0.5) { tipC.x = tipT.x; tipC.y = tipT.y; }
    }
    catchUpTo(lastPtRef.current);
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

  const word = sel.map((i) => wheel.ls[i]).join("");

  const accept = (wordStr: string, selArr: number[], note?: string) => {
    const speed = Math.ceil(Math.max(0, TURN_MS - (Date.now() - t0Ref.current)) / 1000);
    const pts = scoreWord(selArr.length, speed, p.streak, golden);
    usedWords.current.add(wordStr);
    Audio.sfxWordFound(turnWordsRef.current.length + 1);
    buzz([16, 26, 16], Save.data.settings.haptics);
    setTurnWords((ws) => [{ w: wordStr, pts }, ...ws]);
    setSelBoth([]);
    setMsg(note ?? "");
    popId.current += 1;
    const id = popId.current;
    setPops((ps) => [...ps, { id, pts }]);
    setTimeout(() => setPops((ps) => ps.filter((x) => x.id !== id)), 1100);
    onWord(pts, wordStr);
  };

  /* X-FIX — every built word is validated against the OFFLINE lexicon
   * that ships inside the app (۴۵٬۰۰۰+ واژهٔ پاک‌سازی‌شده — no network,
   * no waiting, and the UI never names any dictionary; user: «اسمی لغت
   * نامه در بازی نبر»). The curated game dictionary answers instantly;
   * the clean corpus file covers everything else.
   * Y-FIX — a REJECTED release clears the stroke immediately (like the
   * main wheel) so no half-built nonsense lingers on the ring. */
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
    const wordStr = selArr.map((i) => wheel.ls[i]).join("");
    if (usedWords.current.has(wordStr)) {
      setMsg("این واژه قبلاً گفته شد!"); setShake((s) => s + 1); Audio.sfxWrong();
      clearStroke();
      return;
    }
    if (isRealWord(wordStr) || levelWords.has(wordStr)) {
      accept(wordStr, selArr);
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    const good = await validateWord(wordStr);
    checkingRef.current = false;
    if (endedRef.current) { setChecking(false); return; }
    setChecking(false);
    if (good) {
      accept(wordStr, selArr, "واژه تأیید شد!");
    } else {
      setMsg("این واژه پذیرفته نشد!"); setShake((s) => s + 1); Audio.sfxWrong();
      clearStroke();
    }
  };

  const endNow = (scored: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    onTurnEnd(scored, turnWordsRef.current);
  };

  /* TurnTimer stores onEnd in a ref refreshed every render, so a plain
   * fresh closure each render is the safest (no stale first-render
   * capture of endNow/onTurnEnd). */
  const timerEnd = () => endNow(turnWordsRef.current.length > 0);

  const ringDown = (e: React.PointerEvent) => {
    if (endedRef.current || checkingRef.current) return;
    measure();
    const r = rectRef.current!;
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    /* Z — a press NEVER selects: it only arms the stroke. The first
     * caught letter is whichever tile the finger PATH passes through
     * (the pressed tile itself is at distance 0 from the start point,
     * so beginning the drag ON a tile still picks it up naturally). */
    strokeRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, before: [...selRef.current], tile: null };
    dragRef.current = true;
    ringRef.current?.classList.add("dragging");
    try { ringRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    tipCurRef.current = { x: lx, y: ly };
    prevPtRef.current = { x: lx, y: ly }; /* catch segments start at the touch point */
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
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    /* ONLY record the finger — the rAF tick does hit-test + painting
     * (coalescing: 3 pointer events in one frame = one paint) */
    tipTargetRef.current = { x: lx, y: ly };
    lastPtRef.current = { x: lx, y: ly };
    ensureRaf();
  };
  const ringUp = () => {
    if (!dragRef.current) return;
    /* flush pending catch work BEFORE judging (stroke may end between
     * two rAF ticks) */
    catchUpTo(lastPtRef.current);
    dragRef.current = false;
    ringRef.current?.classList.remove("dragging");
    const st = strokeRef.current;
    /* Z — a quick tap WITHOUT movement selects nothing and does
     * nothing (the old tap-toggle is gone): just retract the bead. */
    if (!st.moved && Date.now() - st.t < 400) {
      tipTargetRef.current = null;
      tipCurRef.current = null;
      paintLine();
      return;
    }
    /* tail retracts into the last caught tile while the verdict plays */
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
    <div className="vz-page">
      {/* top bar */}
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="خروج" onClick={onExit}>✕</button>
        <div className={`ps-active ${golden ? "golden" : ""}`}>
          <AvatarFace id={p.avatar} size={34} />
          <b><bdi>{p.name}</bdi></b>
          {p.streak >= 2 && <span className="ps-streak">🔥{faNum(p.streak)}</span>}
          <span className="ps-active-score">{faNum(p.score)}</span>
        </div>
        <div className="ps-roundchip">دور {faNum(round)}/{faNum(rounds)}</div>
      </div>
      {golden && <div className="ps-golden-note">چرخِ طلایی — امتیازها ۲ برابر!</div>}

      {/* عمو دانا's personalized cheer for this turn */}
      <div className="ps-cheer" aria-live="polite">{cheer}</div>

      <div className="ps-board">
        {/* timer + wheel */}
        <div className="ps-wheel-zone">
          <div className="pt-timer-holder">
            <TurnTimer ms={TURN_MS} onEnd={timerEnd} />
          </div>
          <div
            ref={ringRef}
            className={`ps-ring ${golden ? "golden" : ""}`}
            onPointerDown={ringDown}
            onPointerMove={ringMove}
            onPointerUp={ringUp}
            onPointerCancel={ringUp}
            style={{ touchAction: "none" }}
            role="group"
            aria-label="چرخ حروف دورهمی"
          >
            {/* Y — the DRAG RIBBON, same 3-layer gold stroke + glowing
                finger-bead as the main wheel (user: «اون خط نوار هم
                اضافه بکن وقتی میکشی»). Painted by direct DOM writes. */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden>
              <polyline ref={auraRef} points="" fill="none" stroke="rgba(255,187,56,.30)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
              <polyline ref={coreRef} points="" fill="none" stroke="#ffc93c" strokeWidth={10.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
              <polyline ref={shineRef} points="" fill="none" stroke="rgba(255,252,232,.9)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
              <g ref={beadRef} opacity="0">
                <circle r={12} fill="rgba(255,220,110,.30)" />
                <circle r={5.5} fill="#fff6d8" stroke="#ffb302" strokeWidth="2" />
              </g>
            </svg>
            {wheel.ls.map((ch, i) => {
              const ang = -90 + (360 / wheel.ls.length) * i;
              const rad = (ang * Math.PI) / 180;
              return (
                <span
                  key={i}
                  data-i={i}
                  className={`pw-tile ${sel.includes(i) ? "sel" : ""}`}
                  style={{
                    left: `${50 + 38 * Math.cos(rad)}%`,
                    top: `${50 + 38 * Math.sin(rad)}%`,
                  }}
                  aria-label={`حرف ${ch}`}
                >
                  {ch}
                </span>
              );
            })}
            <div className="ps-hub">
              {word ? word : <span className="ps-hub-hint">واژه بساز…</span>}
            </div>
          </div>
        </div>

        {/* message + pops + the quiet offline word check */}
        <div className="ps-msgrow">
          {msg && <span key={shake} className="ps-msg shake-x">{msg}</span>}
          {checking && <span className="ps-dk"><span className="spin" />در حال بررسی واژه…</span>}
          {pops.map((x) => (
            <span key={x.id} className={`ps-pop ${golden ? "golden" : ""}`}>+{faNum(x.pts)}</span>
          ))}
        </div>

        {/* actions — the drag ring IS the input: build by DRAGGING →
            release auto-submits (Z: taps never select). The old
            ثبت/پاک buttons are gone; only «پایان نوبت» remains. */}
        <div className="ps-actions">
          <button type="button" className="ps-act finish" onClick={() => { Audio.sfxClick(); endNow(turnWordsRef.current.length > 0); }}>
            پایان نوبت
          </button>
        </div>

        {/* عمو دانا coaching line */}
        <Coach line={coachLine} small />

        {/* words found this turn (no counter — the count is gone) */}
        <div className="ps-turnwords">
          {turnWords.slice(0, 6).map((x) => (
            <span key={x.w} className="ps-tw">{x.w} <i>+{faNum(x.pts)}</i></span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= TURN-END RECAP (v1.22) =================
 * user: «وقتی هرشخص نوبتش تموم میشه سریع نره نفره بعدی — یک دکمه
 * ظاهر شه که نوبت نفر بعدیه و شخص بزنه روی دکمه بره نفر بعد».
 * The turn ends into THIS calm card: the player's words + points,
 * the live standings, and ONE big button that hands the phone over. */
function Recap({
  r, players, onNext,
}: {
  r: { pIdx: number; words: { w: string; pts: number }[]; gained: number; last: boolean };
  players: PState[];
  onNext: () => void;
}) {
  const p = players[r.pIdx];
  const rank = useMemo(() => [...players].sort((a, b) => b.score - a.score).slice(0, 3), [players]);
  return (
    <div className="vz-page ps-handoff">
      <Garland />
      <div className="ps-recap">
        <span className="ps-recap-round">پایان نوبت</span>
        <AvatarFace id={p.avatar} size={72} />
        <div className="ps-recap-name"><bdi>{p.name}</bdi></div>
        <span className="ps-recap-pts">‎+{faNum(r.gained)} امتیاز</span>
        {r.words.length > 0 ? (
          <div className="ps-recap-words">
            {r.words.map((x) => (
              <span key={x.w} className="ps-recap-w">{x.w} <i>+{faNum(x.pts)}</i></span>
            ))}
          </div>
        ) : (
          <div className="ps-recap-none">این نوبت واژه‌ای ساخته نشد — دور بعد بهتر!</div>
        )}
        <div className="ps-recap-stand">
          <div className="ps-recap-stand-t">جدول امتیازها</div>
          {rank.map((x, i) => (
            <div key={x.name} className="ps-recap-row">
              <i>{faNum(i + 1)}</i>
              <b><bdi>{x.name}</bdi></b>
              <span className="pts">{faNum(x.score)}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={`ps-recap-go ${r.last ? "final" : ""}`}
          onClick={() => { Audio.sfxClick(); onNext(); }}
        >
          {r.last ? "دیدن برنده‌ها" : "نوبتِ نفر بعدی ←"}
        </button>
      </div>
    </div>
  );
}

/* ================= FINAL PODIUM ================= */
function Final({ ps, onRematch, onNewPlayers, onHome }: {
  ps: PState[]; onRematch: () => void; onNewPlayers: () => void; onHome: () => void;
}) {
  const rank = useMemo(() => [...ps].sort((a, b) => b.score - a.score), [ps]);
  const champ = rank[0];
  /* personalized superlatives (names inside the sentences) */
  const speedKing = useMemo(() => [...ps].sort((a, b) => b.best - a.best)[0], [ps]);
  const line = useMemo(() => pick(FINISH_LINES), []);
  /* podium seats carry their REAL place (2nd, 1st, 3rd) */
  const seats = [
    { p: rank[1], place: 2 },
    { p: rank[0], place: 1 },
    { p: rank[2], place: 3 },
  ].filter((s) => !!s.p);
  const h = (place: number) => (place === 1 ? 92 : place === 2 ? 64 : 48); /* podium heights */
  const medal = (place: number) => (place === 1 ? "#ffd76e" : place === 2 ? "#cfd6e4" : "#e0995c");
  return (
    <div className="vz-page ps-final">
      {/* spotlights + one-shot confetti — transform/opacity only */}
      <div className="ps-spot" aria-hidden />
      <div className="ps-confetti" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: ["#ffd76e", "#ff8fab", "#7ce97f", "#7cc9ff", "#c9a1ff"][i % 5],
              animationDuration: `${2.4 + (i % 5) * 0.35}s`,
              animationDelay: `${(i % 7) * 0.12}s`,
            }}
          />
        ))}
      </div>

      <Garland />
      <div className="ps-final-title title3d" data-t="پایان دورهمی!">پایان دورهمی!</div>
      <div className="ps-crown-wrap rise-in">
        <svg width="46" height="30" viewBox="0 0 46 30" aria-hidden>
          <path d="M3 26 L6 8 L15 17 L23 3 L31 17 L40 8 L43 26 Z" fill="#ffd94e" stroke="#c87f06" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="23" cy="20" r="2.6" fill="#e25c5c" /><circle cx="12" cy="21" r="2" fill="#3d9df0" /><circle cx="34" cy="21" r="2" fill="#3fae5c" />
        </svg>
        {/* v1.22 — champion halo ring (graphical winners' page) */}
        <span className="ps-champ-ava"><AvatarFace id={champ.avatar} size={78} /></span>
        <div className="ps-champ-name"><bdi>{champ.name}</bdi></div>
        <div className="ps-champ-score">{faNum(champ.score)} امتیاز · {faNum(champ.words)} واژه</div>
        <div className="ps-final-line">{line}</div>
        {speedKing && speedKing.best >= 40 && speedKing.name !== champ.name && (
          <div className="ps-final-sub">سریع‌ترین واژه‌ها از <bdi>{speedKing.name}</bdi> بود!</div>
        )}
      </div>

      <div className="ps-podium">
        {seats.map(({ p, place }) => (
          <div key={p.name + place} className="ps-pod-col">
            {/* X-FIX (user: «اسم هاشون با رتبه عددشون تداخل داره»): the
                rank medal now sits ON THE AVATAR'S CORNER (absolute) —
                the old negative-margin version was pulled up over the
                name text. Name gets its own clear row below. */}
            <div className="ps-pod-ava">
              <AvatarFace id={p.avatar} size={place === 1 ? 60 : 48} />
              <span className={`ps-medal g${place}`}>{faNum(place)}</span>
            </div>
            <b className="ps-pod-name"><bdi>{p.name}</bdi></b>
            <div className="ps-pod-block" style={{ height: h(place), background: `linear-gradient(180deg, ${medal(place)}, ${medal(place)}cc)` }}>
              <span className="ps-pod-rank">{faNum(p.score)}</span>
              <span className="ps-pod-score">{faNum(p.words)} واژه</span>
            </div>
          </div>
        ))}
      </div>

      {rank.length > 3 && (
        <div className="ps-rest">
          {rank.slice(3).map((p, i) => (
            <span key={p.name} className="ps-rest-row">
              <i>{faNum(i + 4)}</i> <bdi>{p.name}</bdi> · {faNum(p.score)}
            </span>
          ))}
        </div>
      )}

      <div className="ps-final-actions">
        <button type="button" className="play-big" style={{ fontSize: 19, padding: "10px 30px" }} onClick={() => { Audio.sfxChapterUnlock(); onRematch(); }}>
          دوباره!
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="ps-act back" onClick={onNewPlayers}>بازیکنان جدید</button>
          <button type="button" className="ps-act finish" onClick={onHome}>صفحه اصلی</button>
        </div>
      </div>
    </div>
  );
}

/* ================= SCREEN ROOT ================= */
export function PartyScreen({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<PState[]>([]);
  const [rounds, setRounds] = useState(3);
  const [round, setRound] = useState(1);
  const [turnIdx, setTurnIdx] = useState(0);
  /* v1.22 — the turn-end recap payload (who played, what they made,
   * how many points, whether the whole game is over) */
  const [recap, setRecap] = useState<{ pIdx: number; words: { w: string; pts: number }[]; gained: number; last: boolean } | null>(null);
  const usedWords = useRef<Set<string>>(new Set());
  const usedWheelKeys = useRef<Set<string>>(new Set());
  /* Z-FAIR — ONE wheel per ROUND, shared by every player's turn in
   * that round (the same letters, the same opportunities). A fresh
   * wheel is drawn for each new round, and every turn's used-word
   * pool resets, so nobody is penalized for going after a friend. */
  const [roundWheel, setRoundWheel] = useState<{ key: string; ls: string[]; words: Set<string> } | null>(null);

  const n = players.length;
  const golden = n > 0 && turnIdx % n === n - 1; /* last turn of every round */

  const startAll = (conf: PConf[], r: number) => {
    setPlayers(conf.map((c) => ({ ...c, score: 0, streak: 0, best: 0, words: 0 })));
    setRounds(r);
    setRound(1);
    setTurnIdx(0);
    setRecap(null);
    usedWords.current = new Set();
    usedWheelKeys.current = new Set();
    setRoundWheel(pickWheel(usedWheelKeys.current));
    setPhase("handoff");
  };

  const onWord = (pts: number) => {
    const me = n > 0 ? turnIdx % n : 0;
    setPlayers((ps) => ps.map((p, i) => (i === me ? { ...p, score: p.score + pts, best: Math.max(p.best, pts), words: p.words + 1 } : p)));
  };

  /* v1.22 — a turn NEVER advances on its own anymore: it ends into a
   * RECAP card (words + points + standings) with a big «نوبتِ نفر
   * بعدی» button. turnIdx is a GLOBAL turn counter — the player index
   * is turnIdx % n (the raw index overruns the players array and
   * crashed the recap on the 3rd turn of a 2-player game). */
  const onTurnEnd = (scored: boolean, words: { w: string; pts: number }[]) => {
    const me = n > 0 ? turnIdx % n : 0;
    setPlayers((ps) => ps.map((p, i) => (i === me ? { ...p, streak: scored ? p.streak + 1 : 0 } : p)));
    const gained = words.reduce((s, x) => s + x.pts, 0);
    const isLastOfRound = n > 0 && (turnIdx + 1) % n === 0;
    const last = isLastOfRound && round >= rounds;
    if (!last) {
      setTurnIdx((t) => t + 1);
      if (isLastOfRound) {
        setRound((r) => r + 1);
        setRoundWheel(pickWheel(usedWheelKeys.current)); /* Z-FAIR: fresh shared wheel per round */
      }
    }
    setRecap({ pIdx: me, words, gained, last });
    setPhase("recap");
  };

  if (phase === "setup") return <Setup onStart={startAll} onExit={onExit} />;
  if (phase === "final") {
    return (
      <Final
        ps={players}
        onRematch={() => {
          setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, streak: 0, best: 0, words: 0 })));
          setRound(1); setTurnIdx(0); setRecap(null);
          usedWords.current = new Set(); usedWheelKeys.current = new Set();
          setRoundWheel(pickWheel(usedWheelKeys.current));
          setPhase("handoff");
        }}
        onNewPlayers={() => setPhase("setup")}
        onHome={onExit}
      />
    );
  }
  /* v1.22 — the calm turn-end card; the button decides what's next */
  if (phase === "recap" && recap) {
    return (
      <Sheet bg="/assets/bg/sunset2b.webp" bgDim={0.22}>
        <Recap
          r={recap}
          players={players}
          onNext={() => {
            if (recap.last) { Audio.sfxPartyEnd(); setPhase("final"); }
            else setPhase("handoff");
            setRecap(null);
          }}
        />
      </Sheet>
    );
  }
  const cur = players[turnIdx % Math.max(1, n)];
  if (!cur || !roundWheel) return null;
  if (phase === "handoff") {
    return (
      <Handoff
        p={cur} round={round} rounds={rounds}
        total={players.map(({ name, avatar, score }) => ({ name, avatar, score }))}
        onGo={() => setPhase("turn")}
      />
    );
  }
  return (
    <Sheet bg="/assets/bg/sunset2b.webp" bgDim={0.22}>
      <TurnGame
        key={`${round}:${turnIdx}`}
        p={cur}
        round={round} rounds={rounds}
        golden={golden}
        wheel={roundWheel}
        onWord={onWord}
        onTurnEnd={onTurnEnd}
        onExit={onExit}
      />
    </Sheet>
  );
}
