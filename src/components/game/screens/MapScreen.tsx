"use client";
/* ------------------------------------------------------------------
 * MapScreen — v1.19 PAGED CHAPTER MAP (user session T)
 * «صفحه فصل‌ها مرحله‌ها رو صفحه‌صفحه جدا کنیم و از کنار یک دکمه فلش
 *  بذار… وقتی می‌ره فصل بعد یه افکت… اون فلش قفل باشه»
 *
 *  • ONE chapter = ONE full page (no more 20-realm mega-scroll).
 *  • Side arrows flip chapters: forward arrow (left, RTL) shows a
 *    PADLOCK when the next realm isn't open yet; tapping it shakes
 *    and tells the player exactly how many levels are left to open it.
 *  • Swipe left/right also flips chapters (thresholded, no lib).
 *  • Dots pager jumps anywhere; locked realms are VIEWABLE (veil +
 *    locked nodes) — preview of what's coming keeps players hooked.
 *  • BUG KILLED AT THE ROOT: the old map rendered all 20 realms inside
 *    ONE screen whose onPlay used the map's chapter — tapping a node
 *    in a high realm opened chapter-1's level. Now each page renders
 *    ONLY its own chapter and every node passes (ch, lv) explicitly.
 *
 * PERF: one realm at a time (was 20), decode-gated art, compositor-
 * only slide/pulse animations, neighbours pre-decoded on idle.
 * ------------------------------------------------------------------ */
import { useEffect, useRef, useState } from "react";
import { MapTopBar } from "@/components/game/ui/kit";
import { LockChunky, StarGold } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { CHAPTERS } from "@/game/data/chapters";
import { isDecoded, preloadImage } from "@/game/core/preload";
import { Audio } from "@/game/core/audio";
import { lvPerCh, globalLevel } from "@/game/data/levelsIndex";

/* ---------- color helper: mix two hex colors (no CSS color-mix —
 * older Android webviews don't have it) ---------- */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/* v2.2 SERPENTINE LAYOUT — zigzag that can NEVER overlap.
 * v1.21 (user: «مراحل ب ترتیب از بالا بیان ب پایین شمارش هاش») — the
 * counting now runs TOP → BOTTOM: level 1 sits directly under the
 * chapter plate and the last level rests at the valley bottom. */
const COL_X = { l: 30, r: 70 };

export function nodePos(lv: number, total: number): { x: number; y: number } {
  const rows = Math.ceil(total / 2);
  const row = Math.floor((lv - 1) / 2);
  const second = (lv - 1) % 2 === 1;
  const evenRow = row % 2 === 0;
  const x = evenRow ? (second ? COL_X.r : COL_X.l) : (second ? COL_X.l : COL_X.r);
  const top = 30, bottom = 93;
  const y = rows === 1 ? top : top + ((bottom - top) * row) / (rows - 1);
  return { x, y };
}

/* the player's CURRENT level: first unlocked-not-done spot on the journey */
function currentLevel(): { c: number; l: number } | null {
  for (let c = 1; c <= CHAPTERS.length; c++) {
    if (!Save.chapterUnlocked(c)) continue;
    for (let l = 1; l <= lvPerCh(c); l++) {
      if (Save.levelUnlocked(c, l) && !Save.data.levels[`${c}:${l}`]) return { c, l };
    }
  }
  return null;
}

/* chapter progress (done levels + stars) */
function chProgress(ch: number): { n: number; done: number; stars: number } {
  const n = lvPerCh(ch);
  let done = 0, stars = 0;
  for (let l = 1; l <= n; l++) {
    const rec = Save.data.levels[`${ch}:${l}`];
    if (rec) { done++; stars += rec.stars; }
  }
  return { n, done, stars };
}

/* decode-gated realm art — paints instantly from cache, otherwise
 * fades in over the chapter gradient as soon as it decodes */
function RealmImg({ src }: { src: string }) {
  const [ready, setReady] = useState(() => isDecoded(src));
  return (
    <img
      className="realm-img"
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onLoad={(e) => {
        const el = e.currentTarget;
        if (el.complete && el.naturalWidth > 0) setReady(true);
      }}
      style={{ opacity: ready ? 1 : 0, transition: ready ? "none" : "opacity .3s ease" }}
      onError={() => setReady(true)}
    />
  );
}

/* chunky side arrow — forward points LEFT (RTL), back points RIGHT */
function ChIcon({ dir }: { dir: "next" | "prev" }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <path
        d={dir === "next" ? "M15.5 4.5 L8 12 L15.5 19.5" : "M8.5 4.5 L16 12 L8.5 19.5"}
        fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function SideArrow({
  dir, locked, hidden, onClick, label,
}: {
  dir: "next" | "prev";
  locked: boolean;
  hidden: boolean;
  onClick: () => void;
  label: string;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      className={`ch-arrow ${dir} ${locked ? "locked" : ""}`}
      aria-label={label}
      onClick={(e) => {
        if (locked) {
          /* shake feedback without a re-render (tap-frame only) */
          const el = e.currentTarget;
          el.classList.remove("shake");
          void el.offsetWidth;
          el.classList.add("shake");
          Audio.sfxWrong();
          onClick();
          return;
        }
        Audio.sfxClick();
        onClick();
      }}
    >
      {locked ? <LockChunky size={19} /> : <ChIcon dir={dir} />}
    </button>
  );
}

/* module-level: remembers the last chapter shown, so a remount knows
 * which way to slide (forward = from the left in RTL, back = right) */
let lastSeenMapCh = 0;

/* ================================ screen ================================ */
export function MapScreen({
  ch, onBack, onPlay, onShop, onNav,
}: {
  ch: number;
  onBack: () => void;
  onPlay: (ch: number, lv: number) => void;
  onShop: () => void;
  onNav: (ch: number) => void;
}) {
  const theme = CHAPTERS[ch - 1];
  const unlockedCh = Save.chapterUnlocked(ch);
  const n = lvPerCh(ch);
  const g0 = globalLevel(ch, 1);
  const g1 = globalLevel(ch, n);
  const prog = chProgress(ch);
  const cur = currentLevel();
  const curLv = cur && cur.c === ch ? cur.l : -1;

  /* mini toast for locked-arrow nudges («چند مرحله مونده تا فصل بعد») */
  const [note, setNote] = useState("");
  const noteTimer = useRef(0);
  const say = (msg: string) => {
    setNote(msg);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(""), 2100);
  };
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  /* slide direction for the page flip */
  const dir = ch >= lastSeenMapCh ? "fwd" : "back";
  useEffect(() => { lastSeenMapCh = ch; }, [ch]);

  /* v1.21 — keep the active chapter chip visible in the rail */
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chipsRef.current?.querySelector(".ch-chip.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [ch]);

  /* PERF — idle-prefetch: this realm's art + the two neighbours' art,
   * next chapter's play backdrop and its music track. Arrow flips then
   * paint + start sound with ZERO decode work on the tap frame. */
  useEffect(() => {
    const idle = (fn: () => void) => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1200 });
      else setTimeout(fn, 300);
    };
    const realm = (c: number) => `/assets/map/m${String(c).padStart(2, "0")}.webp`;
    idle(() => { void preloadImage(realm(ch)); });
    if (ch < CHAPTERS.length) {
      idle(() => { void preloadImage(realm(ch + 1)); });
      idle(() => { void preloadImage(`/assets/bg/ch${String(ch + 1).padStart(2, "0")}.webp`); });
      idle(() => { Audio.preloadTrack(`ch${String(ch + 1).padStart(2, "0")}`); });
    }
    if (ch > 1) idle(() => { void preloadImage(realm(ch - 1)); });
  }, [ch]);

  /* navigation */
  const goNext = () => {
    if (ch >= CHAPTERS.length) return;
    if (!Save.chapterUnlocked(ch + 1)) {
      const left = Math.max(0, 7 - prog.done);
      say(left > 0 ? `فصل بعدی قفله! ${faNum(left)} مرحلهٔ دیگر تا باز شدن` : "فصل بعدی قفله!");
      return;
    }
    onNav(ch + 1);
  };
  const goPrev = () => {
    if (ch <= 1) return;
    if (!Save.chapterUnlocked(ch - 1)) { say("این فصل هنوز قفله!"); return; }
    onNav(ch - 1);
  };

  /* swipe (thresholded pointer gestures — no library, no scroll hijack) */
  const swipe = useRef({ x: 0, y: 0, t: 0 });
  const onPointerDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    const dx = e.clientX - s.x, dy = e.clientY - s.y, dt = Date.now() - s.t;
    if (dt > 650 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (dx < 0) goNext(); else goPrev();
  };

  /* grandpa guide line — v1.21: EVERY chapter carries عمو دانا's OWN
   * sentence (user: «در هر فصل عمو دانا متن خاصی نوشته باشد») */
  const line = !unlockedCh
    ? "این فصل هنوز قفله؛ بیا فصل‌های قبل رو کامل کنیم!"
    : theme.guide;

  return (
    <div className="vz-page">
      {/* chapter-colored underlay (instant paint while art decodes) */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg, ${theme.realm.sky[0]} 0%, ${theme.realm.sky[1]} 40%, ${theme.realm.land[0]} 74%, ${theme.realm.land[1]} 100%)`,
        }}
      />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <MapTopBar title={`فصل ${faNum(ch)} · ${theme.title}`} onBack={onBack} onPlus={onShop} />

        {/* ============ THE CHAPTER SCENE (one page = one chapter) ============ */}
        <div
          key={ch}
          className={`ch-scene ${dir === "fwd" ? "in-fwd" : "in-back"}`}
          style={{ ["--acc" as string]: theme.accent, ["--acc-dk" as string]: mix(theme.accent, "#000000", 0.45), ["--acc-lt" as string]: mix(theme.accent, "#ffffff", 0.5) }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <RealmImg src={`/assets/map/m${String(ch).padStart(2, "0")}.webp`} />
          <div className="realm-shade" />

          {/* chapter plate + progress ribbon */}
          <div className="ch-plate">
            <div className="ch-plate-row">
              <span className="ch-medal">{unlockedCh ? faNum(ch) : <LockChunky size={15} />}</span>
              <div className="ch-plate-t">
                <div className="ch-title">{theme.title}</div>
                <div className="ch-range">مرحله‌های {faNum(g0)} تا {faNum(g1)}</div>
              </div>
              <span className="ch-stars">
                <StarGold size={14} />
                {faNum(prog.stars)}/{faNum(n * 3)}
              </span>
            </div>
            <div className="ch-progress">
              <span className="ch-pbar"><i style={{ ["--p" as string]: unlockedCh ? prog.done / n : 0 }} /></span>
              <span className="ch-plabel">{faNum(prog.done)}/{faNum(n)}</span>
            </div>
          </div>

          {/* dotted stone trail (static decoration, zero cost) */}
          {unlockedCh && Array.from({ length: n - 1 }, (_, s) => {
            const a = nodePos(s + 1, n);
            const b = nodePos(s + 2, n);
            return [0.36, 0.68].map((t, ti) => (
              <span
                key={`${s}-${ti}`}
                className="path-stone"
                style={{ left: `${a.x + (b.x - a.x) * t}%`, top: `${a.y + (b.y - a.y) * t}%` }}
                aria-hidden
              />
            ));
          })}

          {/* level nodes — ONE continuous number across the journey */}
          {Array.from({ length: n }, (_, i) => {
            const lv = i + 1;
            const { x, y } = nodePos(lv, n);
            const rec = Save.data.levels[`${ch}:${lv}`];
            const unlocked = unlockedCh && Save.levelUnlocked(ch, lv);
            const isCur = unlocked && lv === curLv;
            const done = !!rec;
            return (
              <div key={lv} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}>
                {isCur && <span className="cur-tag">شما اینجایید</span>}
                <button
                  type="button"
                  disabled={!unlocked}
                  className={`map-node ${done ? "done" : unlocked ? "open" : ""} ${!unlocked ? "locked" : ""} ${isCur ? "cur" : ""}`}
                  aria-label={`مرحله ${faNum(globalLevel(ch, lv))}${unlocked ? "" : " — قفل"}`}
                  onClick={() => { if (unlocked) { Audio.sfxClick(); onPlay(ch, lv); } }}
                >
                  {!unlocked ? <LockChunky size={20} /> : faNum(globalLevel(ch, lv))}
                </button>
                <span className="node-stars">
                  {Array.from({ length: 3 }, (_, s) => (
                    <StarGold key={s} size={13} className={`star-ic ${rec && s < rec.stars ? "star-twinkle" : "off"}`} />
                  ))}
                </span>
              </div>
            );
          })}

          {/* locked veil — preview keeps the player hungry for the next realm */}
          {!unlockedCh && (
            <div className="ch-veil" aria-hidden>
              <span className="ch-veil-lock"><LockChunky size={44} /></span>
              <div className="ch-veil-t">این فصل هنوز قفله!</div>
              <div className="ch-veil-s">
                برای باز شدن، {faNum(7)} مرحله از فصل قبل را کامل کن
              </div>
            </div>
          )}

          {/* side arrows — forward = next chapter (left, RTL) */}
          <SideArrow
            dir="next"
            hidden={ch >= CHAPTERS.length}
            locked={!Save.chapterUnlocked(ch + 1)}
            label="فصل بعد"
            onClick={goNext}
          />
          <SideArrow
            dir="prev"
            hidden={ch <= 1}
            locked={!Save.chapterUnlocked(ch - 1)}
            label="فصل قبل"
            onClick={goPrev}
          />
        </div>

        {/* chapter CHIP RAIL (v1.21 — user: «قابلیتی که راحت‌تر بین فصل‌ها
            جا ب جا شه ب شرط اینکه باز کرده باشه»): the tiny dots became
            big numbered chips — one tap jumps to ANY chapter; locked ones
            still open in preview (veil) to keep the hunger alive.
            Auto-scrolls the active chip into view. */}
        <div className="ch-chips" ref={chipsRef} aria-label="انتخاب فصل">
          {CHAPTERS.map((c) => {
            const active = c.id === ch;
            const open = Save.chapterUnlocked(c.id);
            const doneAll = chProgress(c.id).done >= lvPerCh(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`ch-chip ${active ? "on" : ""} ${doneAll ? "gold" : ""} ${!open ? "locked" : ""}`}
                style={active ? { ["--acc" as string]: theme.accent } : undefined}
                aria-label={`فصل ${faNum(c.id)}${open ? "" : " — قفل"}`}
                onClick={() => { if (!active) { Audio.sfxClick(); onNav(c.id); } }}
              >
                {!open ? <LockChunky size={11} /> : faNum(c.id)}
              </button>
            );
          })}
        </div>

        {/* guide bar — grandpa + bubble (v1.21: the جوایز fab is REMOVED
            — user: «اون دکمه جوایز حذف کن» — the shop stays reachable
            from the top bar; the bubble is the chapter's own line) */}
        <div className="map-guide">
          <img
            className="guide-avatar"
            src="/assets/img/grandpa.webp"
            alt="عمو دانا"
            draggable={false}
          />
          <div className="bubble">{line}</div>
        </div>

        {/* mini toast */}
        {note && <div className="ch-note pop-in" role="status">{note}</div>}
      </div>
    </div>
  );
}
