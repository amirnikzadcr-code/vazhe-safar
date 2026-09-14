"use client";
/* ------------------------------------------------------------------
 * MapScreen — EXACT reference redesign (user's photo #1 right):
 * «نقشه سفر» — every chapter is ONE painted AI scene with the stone
 * path baked in; 10 slate 3D level nodes ride the path; ornamental
 * rope GATE marks the border between chapters; wooden signpost,
 * grandpa speech bubble + golden جوایز fab (bottom bar).
 *
 * PERF: image realms + content-visibility:auto → offscreen chapters
 * cost nothing. NO idle animations anywhere except ONE tiny pulse on
 * the current node. Images lazy-decode as you approach them.
 * ------------------------------------------------------------------ */
import { useLayoutEffect, useEffect, useRef, useState, type MutableRefObject } from "react";
import { MapTopBar } from "@/components/game/ui/kit";
import { LockChunky, StarGold } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { CHAPTERS } from "@/game/data/chapters";
import { isDecoded, preloadImage } from "@/game/core/preload";
import { Audio } from "@/game/core/audio";

/* v2.4 — realm image with decode-gated fade-in: paints instantly from
 * the cache when already decoded (deferred preload got it), otherwise
 * fades in over the chapter gradient as soon as it decodes. */
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

/* v2.2 SERPENTINE LAYOUT — computed zigzag that can NEVER overlap.
 * The old hand-tuned waypoints put nodes 3–5% apart → on narrow phones
 * the 54px buttons collided («دکمه‌ها تو هم تو هم شده»). Now: 5 rows ×
 * 2 columns, row spacing ≈ 15.5% of realm height (~110px on phones) —
 * more than 1.5× the node+stars height. Level 1 = bottom-right start,
 * the trail snakes upward. A dotted stone trail connects the nodes. */
const ROW_Y = [88.5, 73, 57.5, 42, 26.5];       /* % of realm height, bottom → top */
const COL_X = { l: 30, r: 70 };                  /* % of realm width */

export function nodePos(lv: number): { x: number; y: number } {
  const row = Math.floor((lv - 1) / 2);          /* 0..4 */
  const second = (lv - 1) % 2 === 1;             /* second node of the row */
  const evenRow = row % 2 === 0;
  const x = evenRow ? (second ? COL_X.r : COL_X.l) : (second ? COL_X.l : COL_X.r);
  return { x, y: ROW_Y[row] };
}

/* the player's CURRENT level: first unlocked-not-done spot on the journey */
function currentLevel(): { c: number; l: number } | null {
  for (let c = 1; c <= CHAPTERS.length; c++) {
    if (!Save.chapterUnlocked(c)) continue;
    for (let l = 1; l <= 10; l++) {
      if (Save.levelUnlocked(c, l) && !Save.data.levels[`${c}:${l}`]) return { c, l };
    }
  }
  return null;
}

/* ============ one chapter = a painted scene + 10 nodes ============ */
function Realm({
  ch, onPlay, isCurHere, curLv, curRef,
}: {
  ch: number;
  onPlay: (lv: number) => void;
  isCurHere: boolean;
  curLv: number;
  curRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const theme = CHAPTERS[ch - 1];
  const unlockedCh = Save.chapterUnlocked(ch);
  let done = 0, stars = 0;
  for (let l = 1; l <= 10; l++) {
    const rec = Save.data.levels[`${ch}:${l}`];
    if (rec) { done++; stars += rec.stars; }
  }

  return (
    <section
      className="realm"
      data-realm={ch}
      style={{ aspectRatio: "700 / 1225", ["--acc" as string]: theme.accent }}
    >
      {/* painted scene — v2.4 LAZY + fade-in: 20 full-page bitmaps can no
          longer all sit in memory (weak phones), so realms decode as the
          player scrolls near them. Gate/banner/gradient keep the section
          fully presentable while the art fades in. */}
      <RealmImg src={`/assets/map/m${String(ch).padStart(2, "0")}.webp`} />
      <div className="realm-shade" />

      {/* ornamental gate — the «مرز» between chapters (chapter medal) */}
      <div className="gate-band">
        <span className="gate-rope" />
        <span className="gate-medal">{unlockedCh ? faNum(ch) : <LockChunky size={17} />}</span>
        <span className="gate-label">فصل {faNum(ch)} · {theme.title}</span>
        <span className="gate-rope r" />
      </div>

      {/* storybook banner */}
      <div className="realm-banner">
        <div className="rb-plate">
          <span className="rb-medal">{unlockedCh ? faNum(ch) : <LockChunky size={15} />}</span>
          <div className="rb-title">{theme.title}</div>
          <div className="rb-sub">{theme.subtitle}</div>
          <div className="rb-sub" style={{ fontWeight: 800, color: theme.accent }}>
            مرحله {faNum(done)}/{faNum(10)} · <span style={{ color: "#c98d2e" }}>★ {faNum(stars)}/{faNum(30)}</span>
          </div>
        </div>
      </div>

      {/* wooden signpost removed (v2.2) — it collided with the left node
          column and duplicated the guide bubble's text */}

      {/* dotted stone trail connecting level 1 → 10 (static, zero cost) */}
      {Array.from({ length: 9 }, (_, s) => {
        const a = nodePos(s + 1);
        const b = nodePos(s + 2);
        return [0.36, 0.68].map((t, ti) => (
          <span
            key={`${s}-${ti}`}
            className="path-stone"
            style={{ left: `${a.x + (b.x - a.x) * t}%`, top: `${a.y + (b.y - a.y) * t}%` }}
            aria-hidden
          />
        ));
      })}

      {/* 10 level nodes on the serpentine trail */}
      {Array.from({ length: 10 }, (_, i) => {
        const lv = i + 1;
        const { x, y } = nodePos(lv);
        const key = `${ch}:${lv}`;
        const rec = Save.data.levels[key];
        const unlocked = unlockedCh && Save.levelUnlocked(ch, lv);
        const isCur = isCurHere && lv === curLv;
        return (
          <div
            key={lv}
            ref={isCur ? curRef : undefined}
            style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}
          >
            {isCur && <span className="cur-tag">شما اینجایید</span>}
            <button
              type="button"
              disabled={!unlocked}
              className={`map-node ${!unlocked ? "locked" : ""} ${isCur ? "cur" : ""}`}
              aria-label={`مرحله ${faNum(lv)}${unlocked ? "" : " — قفل"}`}
              onClick={() => { if (unlocked) { Audio.sfxClick(); onPlay(lv); } }}
            >
              {!unlocked ? <LockChunky size={20} /> : faNum(lv)}
            </button>
            <span className="node-stars">
              {Array.from({ length: 3 }, (_, s) => (
                <StarGold key={s} size={13} className={`star-ic ${rec && s < rec.stars ? "star-twinkle" : "off"}`} />
              ))}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/* ================================ screen ================================ */
export function MapScreen({
  ch, onBack, onPlay, onShop,
}: {
  ch: number;
  onBack: () => void;
  onPlay: (lv: number) => void;
  onShop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement | null>(null);

  /* the player's CURRENT level across the WHOLE journey */
  const cur = currentLevel();

  /* v4 PERF — while the player looks at the map, quietly decode THIS
   * chapter's play backdrop + its music track. Tapping a level then
   * starts the music and paints the backdrop with ZERO decode work on
   * the main thread (fetching+decoding both at the tap moment was a
   * guaranteed stall on phones — read as «هنگ کردن موقع ورود به مرحله»). */
  useEffect(() => {
    const bg = `/assets/bg/ch${String(ch).padStart(2, "0")}.webp`;
    const track = `ch${String(ch).padStart(2, "0")}`;
    const idle = (fn: () => void) => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1500 });
      else setTimeout(fn, 350);
    };
    idle(() => { void preloadImage(bg); });
    idle(() => { Audio.preloadTrack(track); });
  }, [ch]);

  /* center the current level instantly (layout effect → before paint) */
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const el = curRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const s = sc.getBoundingClientRect();
      sc.scrollTop += r.top - s.top - sc.clientHeight / 2 + r.height / 2;
    } else if (cur) {
      const realm = sc.querySelector<HTMLElement>(`[data-realm="${cur.c}"]`);
      if (realm) sc.scrollTop = realm.offsetTop;
    } else {
      sc.scrollTop = 0; /* everything done → crown the top */
    }
  }, []);

  const lines = [
    "بیا ببینیم تا کجا می‌تونی بری!",
    "هر مرحله یک دنیای جدید!",
    "چای رو هم بزن، کلمه‌ها رو هم!",
    "با هر کلمه، روستا قشنگ‌تر می‌شه!",
  ];
  const guideCh = cur?.c ?? ch;
  const line = lines[(guideCh - 1) % lines.length];

  return (
    <div className="vz-page">
      {/* soft sky underlay (instant paint, no flash while scenes decode) */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#bfe6ff 0%,#8fd0ff 45%,#a8e08b 100%)" }} />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <MapTopBar title="نقشه سفر" onBack={onBack} onPlus={onShop} />

        <div className="map-scroll" ref={scrollRef}>
          <div className="map-world">
            {/* chapter 10 at the TOP … chapter 1 at the BOTTOM — the
                journey climbs upward, realms change as you scroll up */}
            {CHAPTERS.slice().reverse().map((theme) => (
              <Realm
                key={theme.id}
                ch={theme.id}
                onPlay={onPlay}
                isCurHere={cur?.c === theme.id}
                curLv={(() => {
                  if (cur?.c !== theme.id) return -1;
                  for (let l = 1; l <= 10; l++) {
                    if (Save.levelUnlocked(theme.id, l) && !Save.data.levels[`${theme.id}:${l}`]) return l;
                  }
                  return -1;
                })()}
                curRef={curRef}
              />
            ))}
          </div>
        </div>

        {/* guide bar — grandpa + bubble + جوایز fab (reference) */}
        <div className="map-guide">
          <img
            className="guide-avatar"
            src="/assets/img/grandpa.webp"
            alt="عمو دانا"
            draggable={false}
          />
          <div className="bubble">{line}</div>
          <button type="button" className="fab-rewards" onClick={() => { Audio.sfxClick(); onShop(); }} aria-label="جوایز">
            <img src="/assets/img/star.webp" alt="" draggable={false} />
            جوایز
            <span className="dot" />
          </button>
        </div>
      </div>
    </div>
  );
}
