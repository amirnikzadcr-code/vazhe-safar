"use client";
/* ------------------------------------------------------------------
 * PlayScreen — reference layout (like the mockup photo):
 *   top: pause / مرحله chip / progress chip
 *   board: CREAM panel — every word is its OWN separate row of small
 *          parchment tiles (never overlaps: measured auto-fit)
 *   wheel: wooden ring with letter tiles, tap or drag to spell
 *   bottom: shuffle LEFT, hint RIGHT (with coin cost)
 *
 * WORD TIMING (user request: "don't settle instantly — apply a
 * beautiful effect for ~1s, THEN put it on the board"):
 *   1. word completed → wheel CELEBRATION (golden burst, ring shock,
 *      tile glow cascade, +۵ سکه float, chime) for 1.15 s
 *   2. then the word lands on the board (staggered gold pop + sparkles
 *      + soft settle sound)
 *   3. last word → win modal shortly after. Queue-safe: pending words
 *      are guarded, restart/unmount cancels the timers.
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sheet, useToast, ToastHost } from "@/components/game/ui/kit";
import { StarGold } from "@/components/game/icons";
import { HintBulb, ShuffleArrows } from "@/components/game/icons";
import { getLevel, isRealWord } from "@/game/data/levelsIndex";
import { CHAPTERS } from "@/game/data/chapters";
import { letters, faNum, canBuild, buzz } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { Save, COSTS, REWARDS } from "@/game/core/save";
import { WinModal } from "@/components/game/modals/WinModal";
import { PauseModal } from "@/components/game/modals/Overlays";

/* celebration duration BEFORE the word applies to the board (ms) */
const CELEBRATE_MS = 1150;

export function PlayScreen({
  ch, lv, coins, onExit, onNext, onSettings, onShop, coinsBump,
}: {
  ch: number;
  lv: number;
  coins: number;
  onExit: () => void;
  onNext: () => void;
  onSettings: () => void;
  onShop: () => void;
  coinsBump: () => void;
}) {
  const theme = CHAPTERS[ch - 1];
  const level = useMemo(() => getLevel(ch, lv), [ch, lv]);
  /* each word displayed separately, longest first (stable, pretty rows) */
  const wordRows = useMemo(
    () => [...level.words].sort((a, b) => letters(b).length - letters(a).length || (a < b ? -1 : 1)),
    [level],
  );
  const wheelLetters = useMemo(() => letters(level.wheel), [level]);

  const [found, setFound] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set()); // "word#idx"
  const [justFound, setJustFound] = useState<{ word: string; k: number } | null>(null);
  const [wheelFx, setWheelFx] = useState<{ word: string; k: number } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [won, setWon] = useState<{ stars: number; coins: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [tutorial, setTutorial] = useState(() => !Save.data.tutorialDone && ch === 1 && lv === 1);
  const [tutFading, setTutFading] = useState(false);
  const tutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [earned, setEarned] = useState({ words: 0, bonus: 0 });
  const mistakesRef = useRef(0);
  const foundRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fxKRef = useRef(0);

  /* keep ref in sync (effects only — never during render) */
  useEffect(() => { foundRef.current = found; }, [found]);

  const { toast, show } = useToast();

  /* -------- tutorial: fades out on the FIRST drag (user request:
   * "باید وقتی یبار میکشی محو بشه") — no more stuck overlay ------- */
  const dismissTutorial = useCallback(() => {
    if (!Save.data.tutorialDone) Save.markTutorialDone();
    setTutFading((f) => {
      if (f) return f;
      tutTimerRef.current = setTimeout(() => setTutorial(false), 420);
      return true;
    });
  }, []);
  useEffect(() => () => { if (tutTimerRef.current) clearTimeout(tutTimerRef.current); }, []);

  const clearPending = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    pendingRef.current.clear();
    setWheelFx(null);
  }, []);
  useEffect(() => () => clearPending(), [clearPending]);

  /* letters of a word currently visible (found = all, hint = some) */
  const letterShown = useCallback((word: string, idx: number, isFound: boolean) => {
    if (isFound) return true;
    return revealed.has(`${word}#${idx}`);
  }, [revealed]);

  /* stage 2: the word actually lands on the board */
  const commitFound = useCallback((word: string) => {
    pendingRef.current.delete(word);
    const next = new Set(foundRef.current);
    next.add(word);
    foundRef.current = next;
    setFound(next);
    fxKRef.current += 1;
    setJustFound({ word, k: fxKRef.current });
    Audio.sfxSettle();
  }, []);

  /* stage 1: reward + wheel celebration, then apply to the board */
  const celebrate = useCallback((word: string, byPlayer: boolean) => {
    if (foundRef.current.has(word) || pendingRef.current.has(word)) return;
    pendingRef.current.add(word);
    Save.countWord();
    Save.addCoins(REWARDS.perWord);
    setEarned((e) => ({ ...e, words: e.words + 1 }));
    Audio.sfxWordFound(foundRef.current.size + pendingRef.current.size);
    buzz([18, 30, 18], Save.data.settings.haptics);
    coinsBump();
    if (byPlayer) dismissTutorial();
    fxKRef.current += 1;
    const k = fxKRef.current;
    setWheelFx({ word, k });
    const t = setTimeout(() => {
      /* only end the celebration if THIS word's fx is still showing */
      setWheelFx((cur) => (cur && cur.k === k ? null : cur));
      commitFound(word);
    }, CELEBRATE_MS);
    timersRef.current.push(t);
  }, [coinsBump, commitFound, dismissTutorial]);

  /* words completed purely by hints → auto-found */
  useEffect(() => {
    for (const w of wordRows) {
      if (found.has(w)) continue;
      const ls = letters(w);
      let all = true;
      for (let i = 0; i < ls.length; i++) {
        if (!revealed.has(`${w}#${i}`)) { all = false; break; }
      }
      if (all) celebrate(w, false);
    }
  }, [revealed, found, wordRows, celebrate]);

  /* all words done → finish */
  useEffect(() => {
    if (won || wordRows.length === 0) return;
    if (found.size >= wordRows.length) {
      const stars = mistakesRef.current === 0 ? 3 : mistakesRef.current <= 2 ? 2 : 1;
      const total = REWARDS.perStar * stars;
      Save.addCoins(total);
      Save.completeLevel(ch, lv, stars, mistakesRef.current);
      coinsBump();
      Audio.sfxLevelComplete(stars);
      const t = setTimeout(() => setWon({ stars, coins: total }), 340);
      return () => clearTimeout(t);
    }
  }, [found, wordRows, won, ch, lv, coinsBump]);

  /* ------------ submit (from wheel release) ------------
   * "new"   → target word just celebrated (wheel keeps its selection
   *           through the fx, then clears)
   * "known" → already-found word (never punished, wheel clears)
   * false   → not a word / bonus handled / mistake (wheel clears) */
  const submit = useCallback((str: string): "new" | "known" | false => {
    if (!str || str.length < 2) return false;
    if (wordRows.includes(str)) {
      if (!foundRef.current.has(str) && !pendingRef.current.has(str)) {
        celebrate(str, true);
        return "new";
      }
      return "known";
    }
    const uniq = new Set(wordRows);
    if (!uniq.has(str) && isRealWord(str) && canBuild(str, level.wheel)) {
      if (Save.addBonusWord(ch, lv, str)) {
        Save.countBonus();
        Save.addCoins(REWARDS.perBonus);
        setEarned((e) => ({ ...e, bonus: e.bonus + 1 }));
        Audio.sfxBonus();
        coinsBump();
        show(`واژه پنهان! +${faNum(REWARDS.perBonus)} سکه`);
      } else {
        show("این واژهٔ پنهان را قبلاً یافتی!");
      }
      return false;
    }
    mistakesRef.current += 1;
    Audio.sfxWrong();
    buzz(40, Save.data.settings.haptics);
    setShaking(true);
    return false;
  }, [wordRows, level, ch, lv, coinsBump, show, celebrate]);

  /* mid-drag auto-complete — true ONLY when a NEW word was just
   * celebrated (dragging through an already-found word continues
   * the stroke so longer words like قوی are still reachable) */
  const checkAuto = useCallback((str: string): boolean => {
    if (str.length < 2) return false;
    if (wordRows.includes(str) && !foundRef.current.has(str) && !pendingRef.current.has(str)) {
      celebrate(str, true);
      return true;
    }
    return false;
  }, [wordRows, celebrate]);

  /* ------------ hint: reveal next letter of the first unfound word ------------ */
  const doHint = () => {
    if (won) return;
    const nextWord = wordRows.find((w) => !foundRef.current.has(w) && !pendingRef.current.has(w));
    if (!nextWord) return;
    const ls = letters(nextWord);
    for (let i = 0; i < ls.length; i++) {
      if (!revealed.has(`${nextWord}#${i}`)) {
        if (!Save.spendCoins(COSTS.hint)) {
          Audio.sfxWrong();
          show("سکه کافی ندارید!");
          onShop();
          return;
        }
        coinsBump();
        setRevealed((prev) => new Set(prev).add(`${nextWord}#${i}`));
        Audio.sfxReveal();
        show("یک حرف آشکار شد");
        return;
      }
    }
  };

  const doShuffle = () => {
    setShuffleKey((k) => k + 1);
    Audio.sfxShuffle();
  };

  const starsDone = wordRows.filter((w) => found.has(w)).length;

  return (
    <Sheet bg={theme.bg} bgDim={0.12}>
      {/* top bar */}
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" aria-label="منو" className="ib3 sunset" onClick={() => { Audio.sfxClick(); setPaused(true); }}>
            <MenuLines />
          </button>
          <span className="chip" style={{ fontSize: 14 }}>مرحله {faNum((ch - 1) * 10 + lv)}</span>
        </div>
        <span className="chip" style={{ fontSize: 14 }}>
          <StarGold size={17} />
          {faNum(starsDone)}/{faNum(wordRows.length)}
        </span>
      </div>

      {/* board — every word its OWN row, cream panel like the reference photo */}
      <div
        className={`board-box ${shaking ? "shake" : ""}`}
        onAnimationEnd={() => setShaking(false)}
        style={{ flex: "1 1 auto", margin: "4px 14px 0", maxHeight: "44%", minHeight: 130 }}
      >
        <WordBoard
          words={wordRows}
          found={found}
          isShown={letterShown}
          justFound={justFound}
        />
      </div>

      {/* wheel */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 0 2px" }}>
        <Wheel
          letters={wheelLetters}
          shuffleKey={shuffleKey}
          fx={wheelFx}
          reward={REWARDS.perWord}
          onAuto={checkAuto}
          onRelease={submit}
          onFirstDrag={dismissTutorial}
        />
      </div>

      {/* helper row — shuffle bottom-LEFT, hint bottom-RIGHT */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 18px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", position: "relative", zIndex: 20 }}>
        <button
          type="button"
          aria-label="راهنما"
          className="ib3 helper honey"
          onClick={doHint}
        >
          <HintBulb size={26} />
          <span className="chip" style={{ position: "absolute", bottom: -10, fontSize: 11.5, padding: "1px 8px", gap: 4 }}>
            <span className="coin-ic" style={{ width: 13, height: 13 }} />
            {faNum(COSTS.hint)}
          </span>
        </button>
        <button type="button" aria-label="بر زدن" className="ib3 helper green" onClick={doShuffle}>
          <ShuffleArrows size={24} />
        </button>
      </div>

      {/* tutorial overlay (pointer-events none → wheel stays playable;
       * fades away on the FIRST drag) */}
      {tutorial && (
        <div
          className={`fade-in ${tutFading ? "tut-out" : ""}`}
          style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(10,26,46,.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "36%", pointerEvents: "none" }}
        >
          <div style={{ textAlign: "center" }}>
            <div className="bubble tut-ring" style={{ margin: "0 auto 10px", maxWidth: 260, fontSize: 15 }}>
              حرف‌ها را به ترتیب لمس کن و واژه بساز!
            </div>
            <HandSvg />
          </div>
        </div>
      )}

      {paused && (
        <PauseModal
          onResume={() => setPaused(false)}
          onRestart={() => {
            clearPending();
            setPaused(false);
            setFound(new Set());
            setRevealed(new Set());
            setJustFound(null);
            mistakesRef.current = 0;
            setEarned({ words: 0, bonus: 0 });
            setShuffleKey((k) => k + 1);
          }}
          onExit={onExit}
          onSettings={onSettings}
        />
      )}

      {won && (
        <WinModal
          stars={won.stars}
          coins={won.coins}
          words={earned.words}
          bonus={earned.bonus}
          isLast={lv >= 10}
          onContinue={onNext}
          onShop={onShop}
        />
      )}

      <ToastHost toast={toast} />
    </Sheet>
  );
}

/* three-line menu glyph (user request: pause button → hamburger icon) */
function MenuLines() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className="menu-ic" aria-hidden>
      <path d="M4.5 6.6h15" stroke="#fff" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M4.5 12h15" stroke="#ffe08a" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M4.5 17.4h15" stroke="#fff" strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  );
}

/* ================= WordBoard — each word = its own separate row.
   Uniform tile size measured from the longest word → smaller tiles,
   mathematically guaranteed to fit: overlap is impossible. ================= */
function WordBoard({
  words, found, isShown, justFound,
}: {
  words: string[];
  found: Set<string>;
  isShown: (word: string, idx: number, isFound: boolean) => boolean;
  justFound: { word: string; k: number } | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState(30);
  const longest = useMemo(() => Math.max(3, ...words.map((w) => letters(w).length)), [words]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      /* width for longest word: tile*len + inner gaps(4px)*(len-1) + row padding */
      const c = Math.floor((w - 28 - 4 * (longest - 1)) / longest);
      setTile(Math.max(20, Math.min(36, c)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [longest]);

  return (
    <div ref={boxRef} className="wboard" style={{ ["--wt" as string]: `${tile}px` }}>
      {words.map((w) => {
        const ls = letters(w);
        const isF = found.has(w);
        const isJf = justFound?.word === w;
        return (
          <div
            key={w}
            className={`wrow ${isF ? "done" : ""}`}
            data-jf={isJf ? justFound!.k : undefined}
          >
            {ls.map((ch, i) => {
              const shown = isShown(w, i, isF);
              return (
                <span
                  key={i}
                  className={`wtile ${isF ? "fill" : shown ? "reveal" : "empty"}`}
                  style={{ animationDelay: isF ? `${i * 45}ms` : shown ? "0ms" : undefined, fontSize: Math.round(tile * 0.6) }}
                >
                  {shown ? ch : ""}
                </span>
              );
            })}
            {isF && (
              <span className="wsparkles" aria-hidden>
                {Array.from({ length: 6 }, (_, s) => (
                  <i key={s} style={{ ["--dx" as string]: `${(s - 2.5) * 26}px`, ["--dy" as string]: `${-18 - (s % 3) * 14}px`, ["--dd" as string]: `${s * 45}ms` }} />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================= Wheel — owns its own selection state.
   While `fx` is set (word celebrated) the selection polyline stays
   visible, tiles glow in a cascade and new drags are blocked. ================= */
function Wheel({
  letters: ls, shuffleKey, fx, reward, onAuto, onRelease, onFirstDrag,
}: {
  letters: string[];
  shuffleKey: number;
  fx: { word: string; k: number } | null;
  reward: number;
  onAuto: (str: string) => boolean;
  onRelease: (str: string) => "new" | "known" | false;
  onFirstDrag?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPolylineElement | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [celebK, setCelebK] = useState(0);
  const selRef = useRef<number[]>([]);
  const dragRef = useRef(false);
  const firstDragRef = useRef(false);
  const centersRef = useRef<{ idx: number; x: number; y: number }[]>([]);
  const tipTargetRef = useRef<{ x: number; y: number } | null>(null);
  const tipCurRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const rRef = useRef(46); /* hit radius in px, measured per stroke */

  const positions = useMemo(() => {
    const n = ls.length;
    const rot = shuffleKey % n;
    return ls.map((_, i) => {
      const idx = (i + rot) % n;
      const ang = -90 + (360 / n) * i;
      const rad = (ang * Math.PI) / 180;
      return { idx, x: 50 + 37 * Math.cos(rad), y: 50 + 37 * Math.sin(rad) };
    });
  }, [ls, shuffleKey]);

  /* keep selRef in sync inside handlers via helper */
  const applySel = (next: number[]) => {
    selRef.current = next;
    setSel(next);
    paintLine();
  };

  /* ------- BUTTERY DRAG (user request: «ب شدت نرم روان بکن») -------
   * • selection line is painted by DIRECT DOM writes (polyline.points)
   *   → pointermove causes ZERO React re-renders
   * • hit-test by cached tile centers + distance (no elementFromPoint
   *   per move, no layout thrash)
   * • the tail CHASES the finger with a lerp in a rAF loop and retracts
   *   into the last caught tile when the stroke ends */
  const paintLine = () => {
    const el = lineRef.current;
    if (!el) return;
    const pts = selRef.current
      .map((i) => centersRef.current.find((c) => c.idx === i))
      .filter(Boolean)
      .map((c) => `${c!.x},${c!.y}`);
    const tip = tipCurRef.current;
    if (tip) pts.push(`${tip.x},${tip.y}`);
    el.setAttribute("points", pts.join(" "));
  };

  const tick = () => {
    const tipT = tipTargetRef.current;
    const tipC = tipCurRef.current;
    if (tipT && tipC) {
      tipC.x += (tipT.x - tipC.x) * 0.45;
      tipC.y += (tipT.y - tipC.y) * 0.45;
      if (Math.abs(tipT.x - tipC.x) < 0.7 && Math.abs(tipT.y - tipC.y) < 0.7) {
        tipC.x = tipT.x; tipC.y = tipT.y;
      }
    }
    paintLine();
    const settled = !dragRef.current && tipT && tipC && tipT.x === tipC.x && tipT.y === tipC.y;
    if (settled) { rafRef.current = 0; return; } /* tail fully retracted → stop the loop */
    rafRef.current = requestAnimationFrame(tick);
  };
  const ensureRaf = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(tick); };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /* cache tile centers in PIXELS once per stroke (1 layout read) */
  const measure = () => {
    const r = wrapRef.current!.getBoundingClientRect();
    centersRef.current = positions.map((p) => ({
      idx: p.idx,
      x: (p.x / 100) * r.width,
      y: (p.y / 100) * r.height,
    }));
    rRef.current = Math.max(30, r.width * 0.15);
    return r;
  };

  /* distance hit-test — never misses between tiles, super cheap */
  const hitTile = (lx: number, ly: number): number | null => {
    const R = rRef.current;
    let best: number | null = null;
    let bestD = R * R;
    for (const c of centersRef.current) {
      const dx = c.x - lx, dy = c.y - ly;
      const d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = c.idx; }
    }
    return best;
  };

  /* fx set → celebrate; fx cleared (word landed) → release selection */
  useEffect(() => {
    if (fx) setCelebK(fx.k);
    else if (celebK) {
      applySel([]);
      tipTargetRef.current = null;
      tipCurRef.current = null;
      paintLine();
      setCelebK(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx]);

  const endStroke = (keepLineDuringFx: boolean) => {
    dragRef.current = false;
    if (keepLineDuringFx) {
      /* tail retracts into the last caught tile while the celebration plays */
      const cur = selRef.current;
      const last = cur.length ? centersRef.current.find((c) => c.idx === cur[cur.length - 1]) : null;
      if (last) { tipTargetRef.current = { x: last.x, y: last.y }; ensureRaf(); return; }
    }
    applySel([]);
    tipTargetRef.current = null;
    tipCurRef.current = null;
    paintLine();
  };

  const down = (e: React.PointerEvent) => {
    if (celebK) return; /* celebrating → inputs locked for the moment */
    const r = measure();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    const i = hitTile(lx, ly);
    if (i === null) return;
    if (!firstDragRef.current) { firstDragRef.current = true; onFirstDrag?.(); }
    dragRef.current = true;
    try { wrapRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    applySel([i]);
    const c = centersRef.current.find((c) => c.idx === i)!;
    tipCurRef.current = { x: c.x, y: c.y };
    tipTargetRef.current = { x: lx, y: ly };
    ensureRaf();
    Audio.sfxLetter(0);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const r = wrapRef.current!.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    tipTargetRef.current = { x: lx, y: ly };
    const i = hitTile(lx, ly);
    const cur = selRef.current;
    if (i !== null && !cur.includes(i)) {
      const next = [...cur, i];
      Audio.sfxLetter(next.length);
      applySel(next);
      /* tail snaps to the newly caught tile — then keeps chasing */
      const c = centersRef.current.find((c) => c.idx === i)!;
      tipCurRef.current = { x: c.x, y: c.y };
      /* auto-submit on exact unfound word (no mistake penalty) —
       * selection stays visible through the celebration */
      if (onAuto(next.map((k) => ls[k]).join(""))) endStroke(true);
    }
    ensureRaf();
  };

  const up = () => {
    if (!dragRef.current) return;
    const cur = selRef.current;
    if (cur.length >= 2) {
      const r = onRelease(cur.map((k) => ls[k]).join(""));
      if (r === "new") { endStroke(true); return; } /* keep line during fx */
    }
    endStroke(false);
  };

  return (
    <div
      ref={wrapRef}
      className={`wheel-wrap ${celebK ? "fx" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={() => { if (dragRef.current) up(); }}
      style={{ touchAction: "none" }}
      role="group"
      aria-label="چرخ حروف"
    >
      <div className="wheel-wood" />
      <div className="wheel-hub">
        <StarGold size={26} />
      </div>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden>
        <polyline
          ref={lineRef}
          points=""
          fill="none"
          stroke="rgba(255,190,40,.92)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      </svg>
      <div key={shuffleKey} style={{ position: "absolute", inset: 0 }}>
        {positions.map(({ idx, x, y }, pi) => (
          <span
            key={idx}
            data-tile={idx}
            className={`tile tile-in ${sel.includes(idx) ? "sel" : ""}`}
            style={{ left: `${x}%`, top: `${y}%`, ["--i" as string]: pi }}
            aria-label={ls[idx]}
          >
            {ls[idx]}
          </span>
        ))}
      </div>

      {/* ---- CELEBRATION FX (pure CSS, bounded, 60fps) ---- */}
      {celebK > 0 && (
        <div key={celebK} className="wheel-burst" aria-hidden>
          <span className="wb-ring" />
          <span className="wb-flash" />
          {Array.from({ length: 10 }, (_, s) => (
            <i
              key={s}
              style={{
                ["--dx" as string]: `${Math.cos((s / 10) * Math.PI * 2) * 120}px`,
                ["--dy" as string]: `${Math.sin((s / 10) * Math.PI * 2) * 120}px`,
                ["--dd" as string]: `${s * 24}ms`,
                ["--dc" as string]: s % 2 ? "#ffd94e" : "#ffefb0",
              }}
            />
          ))}
        </div>
      )}
      {celebK > 0 && (
        <span key={`coin${celebK}`} className="fx-coin" aria-hidden>
          <span className="coin-ic" style={{ width: 18, height: 18 }} />
          +{faNum(reward)}
        </span>
      )}
    </div>
  );
}

/* tutorial hand — performs a real drag arc (down → glide → up) */
function HandSvg() {
  return (
    <span className="hand-drag" style={{ margin: "0 auto", display: "block", width: 54 }}>
      <svg className="tut-hand" width="54" height="54" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.4))" }}>
        <path fill="#ffd9b3" stroke="#b97c3f" strokeWidth="0.8" d="M11 9V4.8a1.4 1.4 0 0 1 2.8 0V9m0-2.4a1.4 1.4 0 0 1 2.8 0V9m0-1.2a1.4 1.4 0 0 1 2.8 0v4.7c0 4.2-2.6 7-6.4 7-3 0-4.6-1.4-6-3.8l-2-3.6c-.6-1-.3-1.9.5-2.3.7-.4 1.7-.1 2.3.8l1 1.4V6.2a1.4 1.4 0 0 1 2.8 0" />
      </svg>
    </span>
  );
}
