"use client";
/* ------------------------------------------------------------------
 * PlayScreen — reference layout (like the mockup photo):
 *   top: pause / مرحله chip / progress chip
 *   board: CREAM panel — every word is its OWN separate row of small
 *          parchment tiles (never overlaps: measured auto-fit)
 *   wheel: wooden ring with white letter tiles, tap or drag to spell
 *   bottom-left shuffle, bottom-right hint (with coin cost)
 * No crossword generator → level opens instantly, zero CPU spike.
 * Word found → staggered gold pop + sparkle burst (pure CSS, 60fps).
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sheet, useToast, ToastHost } from "@/components/game/ui/kit";
import { Pause, Shuffle, Lightbulb } from "@/components/game/icons";
import { StarGold } from "@/components/game/icons";
import { getLevel, isRealWord } from "@/game/data/levelsIndex";
import { CHAPTERS } from "@/game/data/chapters";
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
  /* each word displayed separately, longest first (stable, pretty rows) */
  const wordRows = useMemo(
    () => [...level.words].sort((a, b) => letters(b).length - letters(a).length || (a < b ? -1 : 1)),
    [level],
  );
  const wheelLetters = useMemo(() => letters(level.wheel), [level]);

  const [found, setFound] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set()); // "word#idx"
  const [justFound, setJustFound] = useState<{ word: string; k: number } | null>(null);
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

  /* letters of a word currently visible (found = all, hint = some) */
  const letterShown = useCallback((word: string, idx: number, isFound: boolean) => {
    if (isFound) return true;
    return revealed.has(`${word}#${idx}`);
  }, [revealed]);

  const markFound = useCallback((word: string, byPlayer: boolean) => {
    if (foundRef.current.has(word)) return;
    const next = new Set(foundRef.current);
    next.add(word);
    foundRef.current = next; /* immediate — guards double calls same tick */
    setFound(next);
    setJustFound({ word, k: (justFound?.k ?? 0) + 1 });
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
  }, [coinsBump, justFound]);

  /* words completed purely by hints → auto-found */
  useEffect(() => {
    for (const w of wordRows) {
      if (found.has(w)) continue;
      const ls = letters(w);
      let all = true;
      for (let i = 0; i < ls.length; i++) {
        if (!revealed.has(`${w}#${i}`)) { all = false; break; }
      }
      if (all) markFound(w, false);
    }
  }, [revealed, found, wordRows, markFound]);

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
      const t = setTimeout(() => setWon({ stars, coins: total }), 300);
      return () => clearTimeout(t);
    }
  }, [found, wordRows, won, ch, lv, coinsBump]);

  /* ------------ submit (from wheel release) ------------ */
  const submit = useCallback((str: string) => {
    if (!str || str.length < 2) return;
    if (wordRows.includes(str) && !foundRef.current.has(str)) {
      markFound(str, true);
      return;
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
      return;
    }
    mistakesRef.current += 1;
    Audio.sfxWrong();
    buzz(40, Save.data.settings.haptics);
    setShaking(true);
  }, [wordRows, level, ch, lv, coinsBump, show, markFound]);

  /* mid-drag auto-complete check — never counts a mistake */
  const checkAuto = useCallback((str: string): boolean => {
    if (str.length < 2) return false;
    if (wordRows.includes(str) && !foundRef.current.has(str)) {
      markFound(str, true);
      return true;
    }
    return false;
  }, [wordRows, markFound]);

  /* ------------ hint: reveal next letter of the first unfound word ------------ */
  const doHint = () => {
    if (won) return;
    const nextWord = wordRows.find((w) => !foundRef.current.has(w));
    if (!nextWord) return;
    const ls = letters(nextWord);
    for (let i = 0; i < ls.length; i++) {
      if (!revealed.has(`${nextWord}#${i}`) && !(foundRef.current.has(nextWord))) {
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
          <button type="button" aria-label="توقف" className="ib3" onClick={() => { Audio.sfxClick(); setPaused(true); }}>
            <Pause size={20} />
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
          onAuto={checkAuto}
          onRelease={submit}
        />
      </div>

      {/* helper row — like the reference: shuffle bottom-LEFT, hint bottom-RIGHT */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 18px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", position: "relative", zIndex: 20 }}>
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
        <button type="button" aria-label="بر زدن" className="ib3 green" onClick={doShuffle}>
          <Shuffle size={20} />
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
