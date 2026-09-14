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
import { useLayoutEffect, useRef, type MutableRefObject } from "react";
import { MapTopBar } from "@/components/game/ui/kit";
import { LockChunky, StarGold } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { CHAPTERS } from "@/game/data/chapters";
import { Audio } from "@/game/core/audio";

/* per-chapter waypoints (% of realm canvas) — eyeball-tuned to the
 * painted stone path of each generated scene. Index = level-1 (bottom→top). */
const PATHS: Record<number, [number, number][]> = {
  1: [[52, 90], [46, 83], [39, 77], [46, 70], [56, 63], [52, 55], [44, 48], [40, 41], [42, 36], [39, 31]],
  2: [[52, 90], [42, 83], [58, 77], [40, 69], [57, 62], [41, 53], [56, 47], [43, 39], [55, 34], [54, 30]],
  3: [[52, 87], [60, 79], [52, 71], [62, 64], [52, 56], [61, 48], [53, 41], [61, 36], [62, 33], [62, 29]],
  4: [[48, 90], [33, 82], [44, 74], [60, 66], [56, 58], [42, 50], [40, 42], [45, 36], [51, 33], [52, 30]],
  5: [[42, 87], [55, 79], [64, 71], [56, 63], [44, 54], [38, 46], [44, 38], [49, 32], [51, 31], [52, 29]],
  6: [[45, 87], [34, 79], [46, 71], [56, 63], [47, 55], [40, 47], [44, 40], [49, 33], [51, 31], [50, 29]],
  7: [[40, 87], [52, 80], [61, 72], [56, 65], [44, 57], [33, 49], [32, 43], [36, 37], [41, 33], [44, 29]],
  8: [[50, 89], [60, 81], [55, 73], [45, 65], [51, 57], [59, 49], [55, 42], [48, 35], [45, 32], [43, 29]],
  9: [[52, 87], [64, 79], [57, 71], [45, 63], [51, 55], [59, 47], [52, 40], [45, 33], [49, 31], [53, 29]],
  10: [[48, 87], [37, 79], [45, 71], [55, 63], [48, 55], [40, 47], [46, 40], [53, 33], [51, 31], [51, 29]],
};
const WP: [number, number][] = PATHS[1];

/* the player's CURRENT level: first unlocked-not-done spot on the journey */
function currentLevel(): { c: number; l: number } | null {
  for (let c = 1; c <= 10; c++) {
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
      {/* painted scene — first two chapters eager, rest lazy */}
      <img
        className="realm-img"
        src={`/assets/map/m${String(ch).padStart(2, "0")}.webp`}
        alt=""
        draggable={false}
        loading={ch <= 2 ? "eager" : "lazy"}
        decoding={ch <= 2 ? "sync" : "async"}
      />
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

      {/* wooden signpost — only on the first chapter (reference) */}
      {ch === 1 && (
        <div className="sign-post">
          <b>هر مرحله<br />یک دنیای<br />جدید!</b>
          <span className="heart">♥</span>
        </div>
      )}

      {/* 10 level nodes riding the painted path */}
      {(PATHS[ch] ?? WP).map(([x, y], i) => {
        const lv = i + 1;
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
  ch, coins, onBack, onPlay, onShop,
}: {
  ch: number;
  coins: number;
  onBack: () => void;
  onPlay: (lv: number) => void;
  onShop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement | null>(null);

  /* the player's CURRENT level across the WHOLE journey */
  const cur = currentLevel();

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
        <MapTopBar coins={coins} title="نقشه سفر" onBack={onBack} onPlus={onShop} />

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
            src="/assets/img/grandpa.png"
            alt="عمو دانا"
            draggable={false}
          />
          <div className="bubble">{line}</div>
          <button type="button" className="fab-rewards" onClick={() => { Audio.sfxClick(); onShop(); }} aria-label="جوایز">
            <img src="/assets/img/star.png" alt="" draggable={false} />
            جوایز
            <span className="dot" />
          </button>
        </div>
      </div>
    </div>
  );
}
