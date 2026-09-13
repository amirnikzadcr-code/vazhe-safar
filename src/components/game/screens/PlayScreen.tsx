"use client";
/* ------------------------------------------------------------------
 * PlayScreen — reference layout:
 *   top: pause / مرحله chip / progress chip
 *   board: white rounded panel, MEASURED auto-fit cells (never overflows)
 *   wheel: wooden ring with letter tiles, tap or drag to spell
 *   bottom-left shuffle, bottom-right hint (with coin cost)
 * Word found → CSS pop (no canvas = zero lag). Win modal is bounded.
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sheet, useToast, ToastHost } from "@/components/game/ui/kit";
import { Pause, Shuffle, Lightbulb } from "@/components/game/icons";
import { StarGold } from "@/components/game/icons";
import { getLevel, isRealWord } from "@/game/data/levelsIndex";
import { CHAPTERS } from "@/game/data/chapters";
import { makeCrossword, CrosswordLayout } from "@/game/crossword";
import { letters, faNum, canBuild, buzz } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { Save, COSTS, REWARDS } from "@/game/core/save";
import { WinModal } from "@/components/game/modals/WinModal";
import { PauseModal } from "@/components/game/modals/Overlays";

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
  const layout = useMemo(() => makeCrossword(level.words, level.id)!, [level]);
  const wheelLetters = useMemo(() => letters(level.wheel), [level]);

  const [found, setFound] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set()); // "r,c"
  const [shaking, setShaking] = useState(false);
  const [won, setWon] = useState<{ stars: number; coins: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [tutorial, setTutorial] = useState(() => !Save.data.tutorialDone && ch === 1 && lv === 1);
  const [earned, setEarned] = useState({ words: 0, bonus: 0 });
  const mistakesRef = useRef(0);
  const foundRef = useRef<Set<string>>(new Set());

  /* keep ref in sync (effects only — never during render) */
  useEffect(() => { foundRef.current = found; }, [found]);

  const { toast, show } = useToast();

  /* ------------ derived: every filled board cell ------------ */
  const cellFilled = useMemo(() => {
    const s = new Set<string>();
    for (const p of layout.placements) {
      if (!found.has(p.word)) continue;
      const ls = letters(p.word);
      for (let i = 0; i < ls.length; i++) {
        s.add(p.dir === "v" ? `${p.r + i},${p.c}` : `${p.r},${p.c - i}`);
      }
    }
    for (const k of revealed) s.add(k);
    return s;
  }, [found, revealed, layout]);

  const markFound = useCallback((word: string, byPlayer: boolean) => {
    if (foundRef.current.has(word)) return;
    const next = new Set(foundRef.current);
    next.add(word);
    foundRef.current = next; /* immediate — guards double calls same tick */
    setFound(next);
    Save.countWord();
    Save.addCoins(REWARDS.perWord);
    setEarned((e) => ({ ...e, words: e.words + 1 }));
    Audio.sfxWordFound(foundRef.current.size);
    buzz([18, 30, 18], Save.data.settings.haptics);
    coinsBump();
    if (byPlayer && !Save.data.tutorialDone) {
      Save.markTutorialDone();
      setTutorial(false);
    }
  }, [coinsBump]);

  /* words completed purely by hints → auto-found */
  useEffect(() => {
    for (const p of layout.placements) {
      if (found.has(p.word)) continue;
      const ls = letters(p.word);
      let all = true;
      for (let i = 0; i < ls.length; i++) {
        const k = p.dir === "v" ? `${p.r + i},${p.c}` : `${p.r},${p.c - i}`;
        if (!cellFilled.has(k)) { all = false; break; }
      }
      if (all) markFound(p.word, false);
    }
  }, [cellFilled, found, layout, markFound]);

  /* all words done → finish */
  useEffect(() => {
    if (won || layout.placements.length === 0) return;
    if (found.size >= layout.placements.length) {
      const stars = mistakesRef.current === 0 ? 3 : mistakesRef.current <= 2 ? 2 : 1;
      const total = REWARDS.perStar * stars;
      Save.addCoins(total);
      Save.completeLevel(ch, lv, stars, mistakesRef.current);
      coinsBump();
      Audio.sfxLevelComplete(stars);
      const t = setTimeout(() => setWon({ stars, coins: total }), 420);
      return () => clearTimeout(t);
    }
  }, [found, layout, won, ch, lv, coinsBump]);

  /* ------------ submit (from wheel release) ------------ */
  const submit = useCallback((str: string) => {
    if (!str || str.length < 2) return;
    if (layout.placements.some((p) => p.word === str) && !foundRef.current.has(str)) {
      markFound(str, true);
      return;
    }
    const uniq = new Set(layout.placements.map((p) => p.word));
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
      return;
    }
    mistakesRef.current += 1;
    Audio.sfxWrong();
    buzz(40, Save.data.settings.haptics);
    setShaking(true);
  }, [layout, level, ch, lv, coinsBump, show, markFound]);

  /* mid-drag auto-complete check — never counts a mistake */
  const checkAuto = useCallback((str: string): boolean => {
    if (str.length < 2) return false;
    if (layout.placements.some((p) => p.word === str) && !foundRef.current.has(str)) {
      markFound(str, true);
      return true;
    }
    return false;
  }, [layout, markFound]);

  /* ------------ hint ------------ */
  const doHint = () => {
    if (won) return;
    const nextWord = layout.placements.find((p) => !foundRef.current.has(p.word));
    if (!nextWord) return;
    const ls = letters(nextWord.word);
    for (let i = 0; i < ls.length; i++) {
      const k = nextWord.dir === "v" ? `${nextWord.r + i},${nextWord.c}` : `${nextWord.r},${nextWord.c - i}`;
      if (!cellFilled.has(k)) {
        if (!Save.spendCoins(COSTS.hint)) {
          Audio.sfxWrong();
          show("سکه کافی ندارید!");
          onShop();
          return;
        }
        coinsBump();
        setRevealed((prev) => new Set(prev).add(k));
        Audio.sfxHint();
        show("یک حرف آشکار شد");
        return;
      }
    }
  };

  const doShuffle = () => {
    setShuffleKey((k) => k + 1);
    Audio.sfxShuffle();
  };

  const starsDone = layout.placements.filter((p) => found.has(p.word)).length;

  return (
    <Sheet bg={theme.bg} bgDim={0.32} blur={2}>
      {/* top bar */}
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" aria-label="توقف" className="ib3" onClick={() => { Audio.sfxClick(); setPaused(true); }}>
            <Pause size={20} />
          </button>
          <span className="chip" style={{ fontSize: 14 }}>مرحله {faNum((ch - 1) * 10 + lv)}</span>
        </div>
        <span className="chip" style={{ fontSize: 14 }}>
          <StarGold size={17} />
          {faNum(starsDone)}/{faNum(layout.placements.length)}
        </span>
      </div>

      {/* board — grows into available space; measured cells; shakes in place on wrong word */}
      <div
        className={`board-box ${shaking ? "shake" : ""}`}
        onAnimationEnd={() => setShaking(false)}
        style={{ flex: "1 1 auto", margin: "4px 14px 0", maxHeight: "40%", minHeight: 150 }}
      >
        <Board layout={layout} filled={cellFilled} />
      </div>

      {/* wheel */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 0 2px" }}>
        <Wheel
          letters={wheelLetters}
          shuffleKey={shuffleKey}
          onAuto={checkAuto}
          onRelease={submit}
        />
      </div>

      {/* helper row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 18px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", position: "relative", zIndex: 20 }}>
        <button type="button" aria-label="بر زدن" className="ib3 green" onClick={doShuffle}>
          <Shuffle size={20} />
        </button>
        <button
          type="button"
          aria-label="راهنما"
          className="ib3"
          style={{ ["--ib" as string]: "#ffd76e", ["--ib-edge" as string]: "#b06e00", ["--ib-fg" as string]: "#6b4300" }}
          onClick={doHint}
        >
          <Lightbulb size={22} />
          <span className="chip" style={{ position: "absolute", bottom: -10, fontSize: 11.5, padding: "1px 8px", gap: 4 }}>
            <span className="coin-ic" style={{ width: 13, height: 13 }} />
            {faNum(COSTS.hint)}
          </span>
        </button>
      </div>

      {/* tutorial overlay (pointer-events none → wheel stays playable) */}
      {tutorial && (
        <div
          className="fade-in"
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
          onRestart={() => { setPaused(false); setFound(new Set()); setRevealed(new Set()); mistakesRef.current = 0; setEarned({ words: 0, bonus: 0 }); setShuffleKey((k) => k + 1); }}
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

/* ================= Board (measured, auto-fit — never overflows) ================= */
function Board({ layout, filled }: { layout: CrosswordLayout; filled: Set<string> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(26);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.clientWidth - 22;
      const h = el.clientHeight - 22;
      if (w <= 0 || h <= 0) return;
      const c = Math.floor(Math.min(w / layout.cols, h / layout.rows, 46));
      setCell(Math.max(16, c));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  return (
    <div ref={boxRef} style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
      <div
        dir="ltr"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.cols}, ${cell}px)`,
          gridAutoRows: `${cell}px`,
          gap: Math.max(3, Math.round(cell * 0.12)),
        }}
      >
        {layout.grid.map((row, r) =>
          row.map((ch, c) => {
            const key = `${r},${c}`;
            const isFill = filled.has(key);
            if (!ch) return <span key={key} className="bcell gap" style={{ width: cell, height: cell }} />;
            return (
              <span key={key} className={`bcell ${isFill ? "fill" : "empty"}`} style={{ width: cell, height: cell, fontSize: Math.round(cell * 0.58) }}>
                {ch}
              </span>
            );
          }),
        )}
      </div>
    </div>
  );
}

/* ================= Wheel — owns its own selection state ================= */
function Wheel({
  letters: ls, shuffleKey, onAuto, onRelease,
}: {
  letters: string[];
  shuffleKey: number;
  onAuto: (str: string) => boolean;
  onRelease: (str: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const selRef = useRef<number[]>([]);
  const dragRef = useRef(false);

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
  };

  /* note: selection is always empty between drags; restart resets found/revealed
     only, so no extra clearing logic is needed when letters change. */

  const tileAt = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const t = el?.closest("[data-tile]") as HTMLElement | null;
    return t ? Number(t.dataset.tile) : null;
  };

  const toLocal = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * 100,
      y: ((clientY - r.top) / r.height) * 100,
    };
  };

  const down = (e: React.PointerEvent) => {
    const i = tileAt(e.clientX, e.clientY);
    if (i === null || Number.isNaN(i)) return;
    dragRef.current = true;
    try { wrapRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    applySel([i]);
    setTip(toLocal(e.clientX, e.clientY));
    Audio.sfxLetter(0);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const local = toLocal(e.clientX, e.clientY);
    setTip(local);
    const i = tileAt(e.clientX, e.clientY);
    const cur = selRef.current;
    if (i !== null && !Number.isNaN(i) && !cur.includes(i)) {
      const next = [...cur, i];
      Audio.sfxLetter(next.length);
      applySel(next);
      /* auto-submit on exact unfound word (no mistake penalty) */
      if (onAuto(next.map((k) => ls[k]).join(""))) {
        dragRef.current = false;
        applySel([]);
        setTip(null);
      }
    }
  };

  const up = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    const cur = selRef.current;
    if (cur.length >= 2) onRelease(cur.map((k) => ls[k]).join(""));
    applySel([]);
    setTip(null);
  };

  /* selection polyline in the 0–100 viewBox space (no ref reads) */
  const linePts = sel
    .map((i) => positions.find((p) => p.idx === i))
    .filter(Boolean)
    .map((p) => `${p!.x},${p!.y}`)
    .join(" ");
  const tipPt = tip ? ` ${tip.x},${tip.y}` : "";

  return (
    <div
      ref={wrapRef}
      className="wheel-wrap"
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
      {sel.length > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
          <polyline
            points={linePts + tipPt}
            fill="none"
            stroke="rgba(255,190,40,.92)"
            strokeWidth={2.6}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 9 }}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        </svg>
      )}
      {positions.map(({ idx, x, y }) => (
        <span
          key={idx}
          data-tile={idx}
          className={`tile ${sel.includes(idx) ? "sel" : ""}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          aria-label={ls[idx]}
        >
          {ls[idx]}
        </span>
      ))}
    </div>
  );
}

/* tutorial hand */
function HandSvg() {
  return (
    <svg className="tut-hand" width="54" height="54" viewBox="0 0 24 24" aria-hidden style={{ margin: "0 auto", display: "block", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.4))" }}>
      <path fill="#ffd9b3" stroke="#b97c3f" strokeWidth="0.8" d="M11 9V4.8a1.4 1.4 0 0 1 2.8 0V9m0-2.4a1.4 1.4 0 0 1 2.8 0V9m0-1.2a1.4 1.4 0 0 1 2.8 0v4.7c0 4.2-2.6 7-6.4 7-3 0-4.6-1.4-6-3.8l-2-3.6c-.6-1-.3-1.9.5-2.3.7-.4 1.7-.1 2.3.8l1 1.4V6.2a1.4 1.4 0 0 1 2.8 0" />
    </svg>
  );
}
