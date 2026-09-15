"use client";
/* ------------------------------------------------------------------
 * PlayScreen — reference layout (like the mockup photo):
 *   top: pause / مرحله chip / progress chip
 *   board: CREAM panel — every word is its OWN separate row of small
 *          parchment tiles (never overlaps: measured auto-fit)
 *   wheel: wooden ring with letter tiles, tap or drag to spell
 *   bottom: shuffle LEFT, hint RIGHT (with coin cost)
 *
 * WORD TIMING (v2.1 — user: «خیلی دیر توی کادر اعمال میشه»):
 *   1. word completed → SHORT wheel celebration (golden burst, ring
 *      shock, tile glow cascade, +۵ سکه float, chime) for 0.55 s
 *   2. then the word lands on the board with a rich gold landing
 *      (staggered pop + shine sweep + sparkles + wooden resolve)
 *   3. last word → win modal shortly after. Queue-safe: pending words
 *      are guarded, restart/unmount cancels the timers.
 *
 * v2.0 COMMIT-ON-RELEASE (user request: «تا وقتی رها نمرکرده کلمه
 * اعمال نشه»): nothing applies while the finger is down — the stroke
 * is judged ONLY on pointer-up. No more mid-drag auto-commit.
 *
 * v2.0 SHOP ROUND-TRIP: opening the shop mid-level (hint with no
 * coins) and coming back used to wipe the board — the level is now
 * snapshotted and RESUMED exactly as it was.
 * ------------------------------------------------------------------ */
import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";
import { Sheet, useToast, ToastHost, PlayerHud } from "@/components/game/ui/kit";
import { StarGold } from "@/components/game/icons";
import { getLevel, isRealWord, globalLevel, lvPerCh } from "@/game/data/levelsIndex";
import { letters, faNum, canBuild, buzz } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { Save, COSTS, REWARDS } from "@/game/core/save";
import { WinModal } from "@/components/game/modals/WinModal";
import { CHAPTERS } from "@/game/data/chapters";
import { PauseModal } from "@/components/game/modals/Overlays";
import { armGameplayProbe } from "@/game/core/perf";

/* celebration duration BEFORE the word applies to the board (ms).
 * v2.1: was 1150 — the player read it as “the word applies too late”.
 * 550 keeps a juicy beat but feels instant. */
const CELEBRATE_MS = 550;
/* the complete-word banner («جملهٔ کاملش زیبا ظاهر شه بعد محو شه»):
 * golden ribbon with the FULL word, pops in → holds → fades away. */
const BANNER_MS = 1500;

/* ---- in-progress level snapshots (shop round-trip) ----
 * Leaving a level to visit the shop unmounts PlayScreen; this cache
 * lets us restore found/revealed/mistakes exactly when the player
 * comes back. Memory-only → a fresh app start starts clean. */
const progressCache = new Map<string, {
  found: string[];
  revealed: string[];
  mistakes: number;
  earned: { words: number; bonus: number };
}>();

export function PlayScreen({
  ch, lv, resume, onExit, onNext, onSettings, onShop, onProfile,
}: {
  ch: number;
  lv: number;
  resume?: boolean; /* true → restore the in-progress snapshot (shop round-trip) */
  onExit: () => void;
  onNext: () => void;
  onSettings: () => void;
  onShop: () => void;
  onProfile?: () => void;
}) {
  /* v3 PERF: no `coins` prop / no `coinsBump` — the HUD coin pill is a
   * self-subscribing live component, so a balance change NEVER re-renders
   * this screen (this was the word-guess lag). */
  const level = useMemo(() => getLevel(ch, lv), [ch, lv]);
  /* each word displayed separately, longest first (stable, pretty rows) */
  const wordRows = useMemo(
    () => [...level.words].sort((a, b) => letters(b).length - letters(a).length || (a < b ? -1 : 1)),
    [level],
  );
  const wheelLetters = useMemo(() => letters(level.wheel), [level]);

  /* -------- resume support (shop round-trip) -------- */
  const progressKey = `${ch}:${lv}`;
  const resumeSnap = useMemo(
    () => (resume ? progressCache.get(progressKey) : undefined),
    [resume, progressKey],
  );
  const wasCompleted = useMemo(() => !!Save.data.levels[progressKey], [progressKey]);
  const resumedDoneRef = useRef(resume === true && wasCompleted && !resumeSnap);

  const [found, setFound] = useState<Set<string>>(
    () => new Set(resumeSnap?.found ?? (resume && wasCompleted ? wordRows : [])),
  );
  const [revealed, setRevealed] = useState<Set<string>>(
    () => new Set(resumeSnap?.revealed ?? []), // "word#idx"
  );
  /* v5 PERF — the word-guess hitch (user: «هنوز قیمتی کلمه حدس میزنی
   * یهو یکم لگ میزنه توی موبایل») came from ONE frame doing ALL of:
   * wheel-fx unmount + board re-render + banner DOM mount + audio.
   * Fixes applied:
   *   1. the banner is PRE-MOUNTED (display:none) and replayed with a
   *      class toggle — guess-time does ZERO DOM creation for it;
   *   2. board rows are memo'd (only the found row re-renders);
   *   3. the wheel burst is pre-mounted too (same class-replay trick).
   *  → the celebration frame is a handful of classList toggles. */
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const bannerWordRef = useRef<HTMLElement | null>(null);
  const bannerRafRef = useRef(0);
  /* v6 PERF — FINAL kill of the word-guess hitch (user 3×: «وقتی کلمه
   * حدس میزنی یهو لگ میزنه… کامل برطرفش بکن»). What still janked in v5:
   *   1. `void el.offsetWidth` forced-layout RESTARTS for the banner /
   *      burst / coin → a synchronous style+layout pass of the whole
   *      page TWO times per guess, exactly on the input frame;
   *   2. `setWheelFx` re-rendered PlayScreen + the whole Wheel subtree
   *      on every guess (React render on the release frame);
   *   3. `setEarned` added a second state write on the same frame.
   * v6 removes ALL three:
   *   • every celebration effect is replayed with the Web Animations
   *     API (el.animate) — zero forced reflow, zero class juggling,
   *     transform/opacity only (compositor); pre-mounted DOM reused;
   *   • the Wheel is driven IMPERATIVELY via a ref handle — the guess
   *     frame causes ZERO React re-renders of PlayScreen/Wheel;
   *   • `earned` is a plain ref (read once by the win modal). */
  const wheelRef = useRef<WheelHandle | null>(null);
  const [shaking, setShaking] = useState(false);
  const [won, setWon] = useState<{ stars: number; coins: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [tutorial, setTutorial] = useState(() => !Save.data.tutorialDone && ch === 1 && lv === 1);
  const [tutFading, setTutFading] = useState(false);
  const tutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earnedRef = useRef(resumeSnap?.earned ?? { words: 0, bonus: 0 });
  const mistakesRef = useRef(resumeSnap?.mistakes ?? 0);
  const foundRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* keep refs in sync (effects only — never during render) */
  useEffect(() => { foundRef.current = found; }, [found]);
  const wonRef = useRef(false);
  const revealedRef = useRef(revealed);
  useEffect(() => { wonRef.current = !!won; }, [won]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  /* fresh plays always start from a clean slate (kills stale snapshots) */
  useEffect(() => { if (!resume) progressCache.delete(progressKey); }, [resume, progressKey]);

  /* leaving the level mid-progress → snapshot it for the shop round-trip.
   * v2.1 BUGFIX (user: hint letters vanished after the shop): the old
   * guard only kept the snapshot when a word had been FOUND — a hint
   * pressed before the first word (found=0, revealed>0) threw the
   * snapshot away. Keep it whenever ANY progress exists. */
  useEffect(() => () => {
    if (wonRef.current) { progressCache.delete(progressKey); return; }
    const f = foundRef.current;
    const r = revealedRef.current;
    const e = earnedRef.current;
    if (f.size === 0 && r.size === 0 && e.words === 0 && e.bonus === 0) {
      progressCache.delete(progressKey);
      return;
    }
    progressCache.set(progressKey, {
      found: [...f],
      revealed: [...r],
      mistakes: mistakesRef.current,
      earned: { ...e },
    });
  }, [progressKey]);

  const { toast, show } = useToast();

  /* v4 PERF — probe DURING real gameplay on the first screens; weak
   * phones get the lowfx tier shed automatically (the boot probe ran
   * on an idle splash and missed them). */
  useEffect(() => { armGameplayProbe(); }, []);

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
    wheelRef.current?.endCelebrate();
  }, []);
  useEffect(() => () => clearPending(), [clearPending]);

  /* stage 2: the word actually lands on the board + the FULL word
   * banner blooms over the screen, then fades (user request).
   * v6 PERF: the board update renders in THIS task; the banner replay
   * is deferred to the NEXT frame and is a pure WAAPI replay of the
   * pre-mounted ribbon (no display toggle, no forced reflow) — the
   * landing frame stays light on weak phones. */
  const commitFound = useCallback((word: string) => {
    pendingRef.current.delete(word);
    const next = new Set(foundRef.current);
    next.add(word);
    foundRef.current = next;
    setFound(next);
    Audio.sfxSettle();
    bannerRafRef.current = requestAnimationFrame(() => {
      bannerRafRef.current = 0;
      const el = bannerRef.current;
      if (!el) return;
      if (bannerWordRef.current) bannerWordRef.current.textContent = word;
      replayWordBanner(el);
    });
  }, []);
  useEffect(() => () => {
    if (bannerRafRef.current) cancelAnimationFrame(bannerRafRef.current);
  }, []);

  /* stage 1: reward + wheel celebration (100% imperative — no React
   * state writes on the release frame), then apply to the board. */
  const celebrate = useCallback((word: string, byPlayer: boolean) => {
    if (foundRef.current.has(word) || pendingRef.current.has(word)) return;
    pendingRef.current.add(word);
    Save.countWord();
    Save.addCoins(REWARDS.perWord);
    earnedRef.current = { ...earnedRef.current, words: earnedRef.current.words + 1 };
    Audio.sfxWordFound(foundRef.current.size + pendingRef.current.size);
    buzz([18, 30, 18], Save.data.settings.haptics);
    if (byPlayer) dismissTutorial();
    wheelRef.current?.celebrate(word);
    const t = setTimeout(() => {
      wheelRef.current?.endCelebrate();
      commitFound(word);
    }, CELEBRATE_MS);
    timersRef.current.push(t);
  }, [commitFound, dismissTutorial]);

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

  /* all words done → finish. Resumed-already-complete levels (shop
   * visited from the win modal) re-show the modal WITHOUT re-awarding */
  useEffect(() => {
    if (won || wordRows.length === 0) return;
    if (found.size >= wordRows.length) {
      const stars = mistakesRef.current === 0 ? 3 : mistakesRef.current <= 2 ? 2 : 1;
      if (!resumedDoneRef.current) {
        const total = REWARDS.perStar * stars;
        Save.addCoins(total);
        Save.completeLevel(ch, lv, stars, mistakesRef.current);
        Audio.sfxLevelComplete(stars);
        progressCache.delete(progressKey);
      }
      const t = setTimeout(() => setWon({ stars, coins: REWARDS.perStar * stars }), 340);
      return () => clearTimeout(t);
    }
  }, [found, wordRows, won, ch, lv, progressKey]);

  /* ------------ submit — called ONLY on pointer release (v2.0:
   * «اول باید بکشه و رها کنه تا ست بشه») ------------
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
        earnedRef.current = { ...earnedRef.current, bonus: earnedRef.current.bonus + 1 };
        Audio.sfxBonus();
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
  }, [wordRows, level, ch, lv, show, celebrate]);

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

  return (
    <Sheet bg={CHAPTERS[ch - 1]?.bg ?? "/assets/bg/play3.webp"} bgDim={0.1}>
      {/* top bar — reference HUD (avatar+plate / coins+BLUE gear)
          the blue gear opens the pause menu (resume/restart/settings/exit) */}
      <PlayerHud gear="blue" onGear={() => setPaused(true)} onPlus={onShop} onProfile={onProfile} />

      {/* level banner — wooden plaque with blossom pins. Shows the ONE
          continuous journey number (user: «هر مرحله یک رقم برو») */}
      <div className="lvl-banner-row">
        <div className="lvl-banner">مرحله {faNum(globalLevel(ch, lv))}</div>
      </div>

      {/* board — every word its OWN row; v1.18: per-CHAPTER skin
          (user: «یکم به تابلو کلمات طرح بده، هر فصل طرحش فرق کنه») */}
      <div
        className={`board-box ${shaking ? "shake" : ""}`}
        data-skin={ch}
        onAnimationEnd={() => setShaking(false)}
        style={{ flex: "1 1 auto", margin: "4px 14px 0", maxHeight: "44%", minHeight: 130 }}
      >
        <WordBoard
          words={wordRows}
          found={found}
          revealed={revealed}
        />
      </div>

      {/* wheel — v6: driven imperatively through the ref; celebrations
          never re-render PlayScreen or the Wheel */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 0 2px" }}>
        <Wheel
          ref={wheelRef}
          letters={wheelLetters}
          shuffleKey={shuffleKey}
          reward={REWARDS.perWord}
          onRelease={submit}
          onFirstDrag={dismissTutorial}
        />
      </div>

      {/* helper bar — shuffle bottom-LEFT, hint bottom-RIGHT (reference).
          v6 — hint lamp rebuilt: crisp inline-SVG bulb (golden glass +
          warm rays + filament) inside a perfectly ROUND button — the old
          86×66 img button looked stretched (user: «دکمه لامپ پهن شده…
          ابعادش درست کن») */}
      <div className="helper-bar">
        <button type="button" aria-label="راهنما" className="fab-hint" onClick={doHint}>
          <BulbSvg />
          <span className="cost">
            <span className="coin-ic" />
            {faNum(COSTS.hint)}
          </span>
        </button>
        <button type="button" aria-label="بر زدن" className="fab-shuffle" onClick={doShuffle}>
          <img src="/assets/img/swap.webp" alt="" draggable={false} />
          <b>بُر بزن</b>
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

      {/* COMPLETE-WORD BANNER — pre-mounted once; idle = transparent,
          replays via WAAPI (replayWordBanner) — zero DOM creation and
          zero forced reflow inside the landing frame */}
      <div ref={bannerRef} className="word-banner" aria-hidden>
        <span className="wb-ribbon">
          <i className="wb-star l" />
          <b className="wb-word" ref={bannerWordRef} />
          <i className="wb-star r" />
        </span>
        <span className="wb-dust">
          {Array.from({ length: 8 }, (_, s) => (
            <i key={s} style={{ ["--dx" as string]: `${Math.cos((s / 8) * Math.PI * 2) * 90}px`, ["--dy" as string]: `${Math.sin((s / 8) * Math.PI * 2) * 46 - 20}px`, ["--dd" as string]: `${s * 40}ms` }} />
          ))}
        </span>
      </div>

      {paused && (
        <PauseModal
          onResume={() => setPaused(false)}
          onRestart={() => {
            clearPending();
            progressCache.delete(progressKey);
            setPaused(false);
            setFound(new Set());
            setRevealed(new Set());
            mistakesRef.current = 0;
            earnedRef.current = { words: 0, bonus: 0 };
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
          words={earnedRef.current.words}
          bonus={earnedRef.current.bonus}
          isLast={lv >= lvPerCh(ch)}
          onContinue={onNext}
          onShop={onShop}
        />
      )}

      <ToastHost toast={toast} />
    </Sheet>
  );
}

/* (MenuLines removed — the reference pause entry is the blue HUD gear) */

/* ================= WordBoard — each word = its own separate row.
   Uniform tile size measured from the longest word → smaller tiles,
   mathematically guaranteed to fit: overlap is impossible.
   v5 PERF (mobile word-guess hitch): each ROW is a memo component with
   primitive props — when a word is found only THAT row re-renders;
   the other rows bail out of reconciliation entirely. ================= */
const WordBoard = memo(function WordBoard({
  words, found, revealed,
}: {
  words: string[];
  found: Set<string>;
  revealed: Set<string>;
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
        const isF = found.has(w);
        /* shown-mask: "1" → letter visible (found rows show everything) */
        const mask = isF
          ? LETTER_MASKS[letters(w).length] ?? "1".repeat(letters(w).length)
          : maskOf(w, revealed);
        return <WordRow key={w} word={w} isF={isF} mask={mask} tile={tile} />;
      })}
    </div>
  );
});

/* pre-built masks for found rows (avoids a repeat() on every render) */
const LETTER_MASKS: Record<number, string> = {};
for (let i = 0; i <= 12; i++) LETTER_MASKS[i] = "1".repeat(i);

function maskOf(word: string, revealed: Set<string>): string {
  let m = "";
  for (let i = 0; i < letters(word).length; i++) m += revealed.has(`${word}#${i}`) ? "1" : "0";
  return m;
}

const WordRow = memo(function WordRow({
  word, isF, mask, tile,
}: {
  word: string;
  isF: boolean;
  mask: string;
  tile: number;
}) {
  const ls = letters(word);
  return (
    <div className={`wrow ${isF ? "done" : ""}`}>
      {ls.map((ch, i) => {
        const shown = isF || mask[i] === "1";
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
});

/* ================= WAAPI celebration keyframes (v6 PERF) — every FX is
   replayed with el.animate(): NO forced reflow (the old
   `void el.offsetWidth` restart janked weak phones), NO class juggling,
   transform/opacity only → fully compositor-accelerated. */
const EASE_POP = "cubic-bezier(.2,1.5,.4,1)";
const KF_RING: Keyframe[] = [
  { transform: "scale(.4)", opacity: 0.95 },
  { transform: "scale(2.6)", opacity: 0 },
];
const KF_FLASH: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const KF_SPARK = (dx: string, dy: string): Keyframe[] => [
  { transform: "translate(0,0) scale(1)", opacity: 1 },
  { transform: `translate(${dx},${dy}) scale(.2)`, opacity: 0 },
];
const KF_COIN: Keyframe[] = [
  { transform: "translate(-50%, 16px) scale(.6)", opacity: 0 },
  { transform: "translate(-50%, 0) scale(1.08)", opacity: 1, offset: 0.25 },
  { transform: "translate(-50%, -14px) scale(1)", opacity: 1, offset: 0.75 },
  { transform: "translate(-50%, -30px) scale(.9)", opacity: 0 },
];
const KF_RIBBON: Keyframe[] = [
  { transform: "scale(.3) translateY(26px)", opacity: 0, offset: 0 },
  { transform: "scale(1.1) translateY(0)", opacity: 1, offset: 0.16 },
  { transform: "scale(1)", offset: 0.26 },
  { transform: "scale(1)", opacity: 1, offset: 0.72 },
  { transform: "scale(.94) translateY(-34px)", opacity: 0 },
];
const KF_STAR_L: Keyframe[] = [
  { transform: "rotate(-160deg) scale(0)" },
  { transform: "rotate(20deg) scale(1.25)", offset: 0.55 },
  { transform: "rotate(0deg) scale(1)" },
];
const KF_STAR_R: Keyframe[] = [
  { transform: "rotate(160deg) scale(0)" },
  { transform: "rotate(-20deg) scale(1.25)", offset: 0.55 },
  { transform: "rotate(0deg) scale(1)" },
];
const KF_DUST = (dx: string, dy: string): Keyframe[] => [
  { transform: "translate(0,0) scale(.4) rotate(0deg)", opacity: 0 },
  { opacity: 1, offset: 0.14 },
  { transform: `translate(${dx},${dy}) scale(1) rotate(200deg)`, opacity: 0 },
];

/** restart-safe replay of the pre-mounted complete-word banner */
function replayWordBanner(root: HTMLElement): void {
  if (typeof root.animate !== "function") return;
  const ribbon = root.querySelector<HTMLElement>(".wb-ribbon");
  const starL = root.querySelector<HTMLElement>(".wb-star.l");
  const starR = root.querySelector<HTMLElement>(".wb-star.r");
  for (const el of [ribbon, starL, starR]) el?.getAnimations().forEach((a) => a.cancel());
  ribbon?.animate(KF_RIBBON, { duration: BANNER_MS, easing: EASE_POP, fill: "both" });
  starL?.animate(KF_STAR_L, { duration: BANNER_MS, easing: "ease", fill: "both" });
  starR?.animate(KF_STAR_R, { duration: BANNER_MS, easing: "ease", fill: "both" });
  root.querySelectorAll<HTMLElement>(".wb-dust i").forEach((el, i) => {
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      KF_DUST(el.style.getPropertyValue("--dx"), el.style.getPropertyValue("--dy")),
      { duration: 1150, delay: i * 40, easing: "ease-out", fill: "both" },
    );
  });
}

/* ================= Wheel — owns its own selection state.
   v2.0 COMMIT-ON-RELEASE: the stroke is judged ONLY in up() (pointer
   release) — dragging through a word never applies it early, and
   longer words stay reachable because strokes never end mid-drag.
   While a celebration is live the selection polyline stays visible,
   tiles glow in a cascade and new drags are blocked.
   v2.0 JUICY STROKE: 3 layered polylines (soft aura + gold core +
   bright shine) + a glowing bead that rides under the finger —
   all painted by direct DOM writes, still zero re-renders.
   v2.1 FLIP SHUFFLE (user: «کلمات با افکت جا ب جا بشن»): tiles are
   mounted ONCE — when the ring turns, every tile GLIDES from its old
   seat to the new one (WAAPI staggered spring + wobble), no more
   remount pop.
   v6 IMPERATIVE (user: «کامل برطرفش بکن» — the mobile word-guess
   hitch): PlayScreen drives celebrations through a ref handle, so a
   guess causes ZERO React re-renders of this subtree, and the burst /
   coin FX replay via WAAPI with no forced reflow. ================= */
export interface WheelHandle {
  celebrate(word: string): void;
  endCelebrate(): void;
}

const Wheel = memo(forwardRef(function Wheel({
  letters: ls, shuffleKey, reward, onRelease, onFirstDrag,
}: {
  letters: string[];
  shuffleKey: number;
  reward: number;
  onRelease: (str: string) => "new" | "known" | false;
  onFirstDrag?: () => void;
}, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<SVGPolylineElement | null>(null);
  const coreRef = useRef<SVGPolylineElement | null>(null);
  const shineRef = useRef<SVGPolylineElement | null>(null);
  const beadRef = useRef<SVGGElement | null>(null);
  /* v5 PERF — celebration FX pre-mounted ONCE and replayed with a class
   * toggle: the guess frame does classList work, not DOM creation */
  const burstRef = useRef<HTMLDivElement | null>(null);
  const coinFxRef = useRef<HTMLSpanElement | null>(null);
  const selRef = useRef<number[]>([]);
  const dragRef = useRef(false);
  const firstDragRef = useRef(false);
  const centersRef = useRef<{ idx: number; x: number; y: number }[]>([]);
  const tipTargetRef = useRef<{ x: number; y: number } | null>(null);
  const tipCurRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const rRef = useRef(46); /* hit radius in px, measured per stroke */
  /* tile elements for DOM-driven .sel painting (idx → element) */
  const tileElsRef = useRef<Map<number, HTMLElement> | null>(null);
  /* v3 PERF: rect cached once per stroke — pointermove used to call
   * getBoundingClientRect() (a forced layout read) on EVERY move event,
   * which janks the wheel on weak phones during fast drags. */
  const rectRef = useRef<DOMRect | null>(null);

  const positions = useMemo(() => {
    const n = ls.length;
    /* varied, deterministic rotation per shuffle (feels hand-shuffled) */
    const rot = shuffleKey === 0 ? 0 : 1 + ((shuffleKey * 5) % (n - 1));
    return ls.map((_, i) => {
      const idx = (i + rot) % n;
      const ang = -90 + (360 / n) * i;
      const rad = (ang * Math.PI) / 180;
      return { idx, x: 50 + 37 * Math.cos(rad), y: 50 + 37 * Math.sin(rad) };
    });
  }, [ls, shuffleKey]);

  /* ---- FLIP SHUFFLE ---- tiles glide from old seat → new seat.
   * Pure transform/opacity (WAAPI) → fully composited, no jank. */
  const seatPxRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const firstMountRef = useRef(true);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const next = new Map<number, { x: number; y: number }>();
    for (const p of positions) next.set(p.idx, { x: (p.x / 100) * r.width, y: (p.y / 100) * r.height });
    if (!firstMountRef.current) {
      let d = 0;
      next.forEach((np, idx) => {
        const op = seatPxRef.current.get(idx);
        if (!op) return;
        const dx = op.x - np.x, dy = op.y - np.y;
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        const el = wrap.querySelector<HTMLElement>(`[data-tile="${idx}"]`);
        if (!el || typeof el.animate !== "function") return;
        const wob = ((idx % 2 ? 1 : -1) * (11 + (idx % 3) * 5)).toFixed(1);
        el.animate(
          [
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(1)` },
            { transform: `translate(calc(-50% + ${(dx * 0.16).toFixed(1)}px), calc(-50% + ${(dy * 0.16).toFixed(1)}px)) rotate(${wob}deg) scale(1.12)`, offset: 0.55 },
            { transform: "translate(-50%, -50%) rotate(0deg) scale(1)" },
          ],
          { duration: 470, delay: d * 26, easing: "cubic-bezier(.22,1.3,.36,1)" },
        );
        d++;
      });
    }
    firstMountRef.current = false;
    seatPxRef.current = next;
  }, [positions]);

  /* selection lives ONLY in refs — tiles + line are painted by direct
   * DOM writes. A drag causes ZERO React re-renders. */
  const paintTiles = () => {
    const els = tileElsRef.current;
    if (!els) return;
    const cur = selRef.current;
    els.forEach((el, idx) => { el.classList.toggle("sel", cur.includes(idx)); });
  };
  const applySel = (next: number[]) => {
    selRef.current = next;
    paintTiles();
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
    const pts = selRef.current
      .map((i) => centersRef.current.find((c) => c.idx === i))
      .filter(Boolean)
      .map((c) => `${c!.x},${c!.y}`);
    const tip = tipCurRef.current;
    if (tip) pts.push(`${tip.x},${tip.y}`);
    const s = pts.join(" ");
    auraRef.current?.setAttribute("points", s);
    coreRef.current?.setAttribute("points", s);
    shineRef.current?.setAttribute("points", s);
    const bead = beadRef.current;
    if (bead) {
      if (tip) {
        bead.setAttribute("transform", `translate(${tip.x} ${tip.y})`);
        bead.setAttribute("opacity", "1");
      } else {
        bead.setAttribute("opacity", "0");
      }
    }
  };

  const tick = () => {
    const tipT = tipTargetRef.current;
    const tipC = tipCurRef.current;
    if (tipT && tipC) {
      tipC.x += (tipT.x - tipC.x) * 0.38;
      tipC.y += (tipT.y - tipC.y) * 0.38;
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

  /* cache tile centers in PIXELS once per stroke (1 layout read) +
   * collect tile elements for DOM class painting */
  const measure = () => {
    const r = wrapRef.current!.getBoundingClientRect();
    rectRef.current = r;
    centersRef.current = positions.map((p) => ({
      idx: p.idx,
      x: (p.x / 100) * r.width,
      y: (p.y / 100) * r.height,
    }));
    rRef.current = Math.max(30, r.width * 0.15);
    if (!tileElsRef.current) {
      const m = new Map<number, HTMLElement>();
      wrapRef.current!.querySelectorAll<HTMLElement>("[data-tile]").forEach((el) => {
        m.set(Number(el.dataset.tile), el);
      });
      tileElsRef.current = m;
    }
    return r;
  };
  /* tiles remount on shuffle → drop the cached elements */
  useEffect(() => { tileElsRef.current = null; }, [shuffleKey]);

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

  /* fx set → celebrate (class derived from fx, no state needed);
   * fx cleared (word landed) → release the selection, DOM-only.
   * v6: imperative handle — PlayScreen calls celebrate()/endCelebrate();
   * burst + coin replay via WAAPI (no reflow, no React state). */
  const lockRef = useRef(false);
  const celebrate = useCallback((_: string) => {
    lockRef.current = true;
    wrapRef.current?.classList.add("fx");
    const b = burstRef.current;
    if (b && typeof b.animate === "function") {
      const ring = b.querySelector<HTMLElement>(".wb-ring");
      const flash = b.querySelector<HTMLElement>(".wb-flash");
      ring?.getAnimations().forEach((a) => a.cancel());
      flash?.getAnimations().forEach((a) => a.cancel());
      ring?.animate(KF_RING, { duration: 580, easing: "ease-out", fill: "both" });
      flash?.animate(KF_FLASH, { duration: 400, easing: "ease-out", fill: "both" });
      b.querySelectorAll<HTMLElement>("i").forEach((el, i) => {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate(
          KF_SPARK(el.style.getPropertyValue("--dx"), el.style.getPropertyValue("--dy")),
          { duration: 600, delay: i * 24, easing: "ease-out", fill: "both" },
        );
      });
    }
    const c = coinFxRef.current;
    if (c && typeof c.animate === "function") {
      c.getAnimations().forEach((a) => a.cancel());
      c.animate(KF_COIN, { duration: 620, easing: "ease-out", fill: "both" });
    }
  }, []);
  const endCelebrate = useCallback(() => {
    lockRef.current = false;
    wrapRef.current?.classList.remove("fx");
    selRef.current = [];
    tipTargetRef.current = null;
    tipCurRef.current = null;
    paintTiles();
    paintLine();
  }, []);
  useImperativeHandle(ref, () => ({ celebrate, endCelebrate }), [celebrate, endCelebrate]);

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
    if (lockRef.current) return; /* celebrating → inputs locked for the moment */
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
    const r = rectRef.current;
    if (!r) return;
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    tipTargetRef.current = { x: lx, y: ly };
    const i = hitTile(lx, ly);
    const cur = selRef.current;
    if (i !== null && !cur.includes(i)) {
      const next = [...cur, i];
      Audio.sfxLetter(next.length);
      applySel(next);
      /* tail snaps to the newly caught tile — then keeps chasing.
       * NO auto-commit here anymore (v2.0): the word is judged on release */
      const c = centersRef.current.find((c) => c.idx === i)!;
      tipCurRef.current = { x: c.x, y: c.y };
    }
    ensureRaf();
  };

  const up = () => {
    if (!dragRef.current) return;
    const cur = selRef.current;
    if (cur.length >= 2) {
      /* v2.0: the ONLY moment a word can apply — finger released */
      const r = onRelease(cur.map((k) => ls[k]).join(""));
      if (r === "new") { endStroke(true); return; } /* keep line during fx */
    }
    endStroke(false);
  };

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
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden>
        {/* 3-layer juicy stroke: soft aura → gold core → bright shine */}
        <polyline ref={auraRef} points="" fill="none" stroke="rgba(255,187,56,.32)" strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" />
        <polyline ref={coreRef} points="" fill="none" stroke="#ffc93c" strokeWidth={10.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
        <polyline ref={shineRef} points="" fill="none" stroke="rgba(255,252,232,.9)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        {/* glowing bead riding under the finger (Wordscapes-style) */}
        <g ref={beadRef} opacity="0">
          <circle r={11} fill="rgba(255,220,110,.30)" />
          <circle r={5.2} fill="#fff6d8" stroke="#ffb302" strokeWidth="2" />
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0 }}>
        {positions.map(({ idx, x, y }, pi) => (
          <span
            key={idx}
            data-tile={idx}
            className="tile tile-in"
            style={{ left: `${x}%`, top: `${y}%`, ["--i" as string]: pi }}
            aria-label={ls[idx]}
          >
            {ls[idx]}
          </span>
        ))}
      </div>

      {/* ---- CELEBRATION FX (pure CSS, bounded, 60fps) — pre-mounted
           ONCE, replayed with a class toggle (v5 PERF: zero DOM
           creation inside the guess frame on weak phones) ---- */}
      <div ref={burstRef} className="wheel-burst" aria-hidden>
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
      <span ref={coinFxRef} className="fx-coin" aria-hidden>
        <span className="coin-ic" style={{ width: 18, height: 18 }} />
        +{faNum(reward)}
      </span>
    </div>
  );
}));

/* v6 hint lamp — crisp vector bulb (golden glass, filament, warm rays).
 * Inline SVG = perfectly sharp on every density, zero extra request,
 * drawn once, never re-rendered (no props/state). */
function BulbSvg() {
  return (
    <svg className="bulb-svg" width="46" height="46" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <radialGradient id="bulbGlass" cx="0.42" cy="0.3" r="0.95">
          <stop offset="0" stopColor="#fffdf2" />
          <stop offset="0.55" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#ffc94d" />
        </radialGradient>
        <radialGradient id="bulbHalo">
          <stop offset="0" stopColor="rgba(255,214,90,.6)" />
          <stop offset="1" stopColor="rgba(255,214,90,0)" />
        </radialGradient>
      </defs>
      {/* warm halo behind the glass */}
      <circle cx="24" cy="21" r="15" fill="url(#bulbHalo)" />
      {/* rays */}
      <g stroke="#ffb302" strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 1.6v3.6" />
        <path d="M9.6 6.8l2.5 2.5" />
        <path d="M38.4 6.8l-2.5 2.5" />
        <path d="M4.8 21h3.4" />
        <path d="M43.2 21h-3.4" />
      </g>
      {/* glass bulb */}
      <path
        d="M24 5.6c-7.3 0-12.6 5.3-12.6 12.2 0 4.7 2.5 7.5 4.6 9.7 1.3 1.4 2.2 2.6 2.6 4.1h10.8c.4-1.5 1.3-2.7 2.6-4.1 2.1-2.2 4.6-5 4.6-9.7 0-6.9-5.3-12.2-12.6-12.2z"
        fill="url(#bulbGlass)" stroke="#c98d1e" strokeWidth="2.2" strokeLinejoin="round"
      />
      {/* filament */}
      <path d="M19.4 27l2.3-2.9 2.3 2.9 2.3-2.9 2.3 2.9" fill="none" stroke="#b47708" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      {/* screw base */}
      <rect x="18.6" y="33.6" width="10.8" height="3.2" rx="1.6" fill="#8a5a1e" />
      <rect x="19.6" y="37.6" width="8.8" height="3.4" rx="1.7" fill="#6e451a" />
    </svg>
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
