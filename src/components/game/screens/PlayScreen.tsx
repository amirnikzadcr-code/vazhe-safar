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
import { getProgress, setProgress, clearProgress } from "@/game/core/progress";
import { WinModal } from "@/components/game/modals/WinModal";
import { CHAPTERS } from "@/game/data/chapters";
import { PauseModal } from "@/components/game/modals/Overlays";
import { armGameplayProbe, isLowFx } from "@/game/core/perf";
import { stageZoom } from "@/game/core/stage";

/* v5 PERF/COMPAT — Element.getAnimations() needs Chrome 84+; old
 * Android System WebViews (minSdk 22 era) throw on it. Every cancel
 * pass is best-effort: a stale overlapping animation is harmless, a
 * crash inside the guess frame is not. */
function cancelAnims(...els: (Element | null | undefined)[]): void {
  for (const el of els) {
    try { el?.getAnimations?.().forEach((a) => a.cancel()); } catch { /* old WebView */ }
  }
}

/* HH — SELF-RELEASING FX (user: «وقتی کلمه حدس میزنی یخورده لگ میزنه»):
 * every one-shot WAAPI replay used to stay ALIVE forever with
 * fill:"both" — ~24 dead animations + their reserved compositor
 * layers piled up on EVERY guess and the WebView slowed progressively
 * across a level. Every FX in this file ends at opacity:0 / scale(1)
 * — exactly its base style — so cancelling on finish is visually a
 * no-op while the GPU layer is freed immediately. The rejection path
 * (a newer replay already cancelled us) is a harmless noop. */
function replayFX(
  el: Element | null | undefined,
  kf: Keyframe[] | PropertyIndexedKeyframes,
  opts: KeyframeAnimationOptions,
): void {
  if (!el || typeof el.animate !== "function") return;
  let a: Animation;
  try { a = el.animate(kf, opts); } catch { return; }
  if (a.finished?.then) {
    a.finished.then(() => { a.cancel(); }).catch(() => { /* superseded */ });
  }
}

/* celebration duration BEFORE the word applies to the board (ms).
 * v2.1: was 1150 — the player read it as “the word applies too late”.
 * 550 keeps a juicy beat but feels instant. v1.20: 480 + the wheel no
 * longer HARD-LOCKS input during the beat (a fresh drag force-ends
 * the fx) — user: «یه لگ ریز داره وقتی حدس میزنی، نرم روان بکن». */
const CELEBRATE_MS = 300;
/* the complete-word banner («جملهٔ کاملش زیبا ظاهر شه بعد محو شه»):
 * golden ribbon with the FULL word, pops in → holds → fades away.
 * v1.22 (user: «کلمه یهو ظاهر میشه سریع ناپدید میشه — حداقل ۲ ثانیه
 * بمونه»): a SMOOTH pop-in (~340ms), then the word stays fully
 * readable ≈2s before it fades.
 * X-FIX (user: «با تاخیر زیاد واژه حدس زده شده وارد کادر میشه»): the
 * board entry used to WAIT for the whole banner (۲.۴s!) — now the
 * banner AND the letter entry run CONCURRENTLY: the first letter
 * lands ~0.8s after release (feels instant) while the ribbon still
 * holds ≈2s on screen. Both requests satisfied at once. */
const BANNER_MS = 2800;
/* v1.21 — LETTER-BY-LETTER BOARD ENTRY («بعدش خیلی خوشگل دونه دونه
 * با افکت وارد کادر بشه»): after the banner hold, the found row's
 * letters fly into their tiles ONE BY ONE (staggered, springy arc).
 * LETTER_T0 = when the first letter starts (relative to the word
 * landing), LETTER_STEP = gap between letters. The win modal waits
 * for the last letter + a breather before it pops over the board. */
const LETTER_T0 = 800;
const LETTER_STEP = 110;
const WIN_EXTRA_MS = 620;

/* SESSION Z — chapter-1 ONBOARDING (user: «اگر کلمه درست حدس زد
 * تشویق شه بعد ی توضیحاتی بهش داده بشه»): every player-found word in
 * chapter 1 pops a warm عمو دانا bubble — a CHEER for the guess
 * followed by a short explanation of what just happened / what to
 * try next. The lines rotate so the teaching never feels stuck. */
const CH_CHEERS = [
  "آفرین! دقیقاً همین‌طور! 🌟",
  "عالی بود! ادامه بده! 🎉",
  "چه واژه‌ی قشنگی ساختی! ⭐",
  "ایول! تو یک واژه‌باز واقعی هستی! 🏆",
  "درست حدس زدی! باز هم! ✨",
];
const CH_TEACH = [
  "واژه‌ات الان داخل کادرِ جملات نشست — بقیهٔ واژه‌ها را هم پیدا کن!",
  "واژه‌های بلندتر سکهٔ بیشتری می‌دهند؛ دنبال واژه‌های طولانی بگرد!",
  "گاهی واژه‌های پنهان هم قایم شده‌اند — پیدایشان کنی سکهٔ اضافه می‌گیری!",
  "اگر گیر کردی: لامپ یک حرف را آشکار می‌کند و «بُر بزن» جای حرف‌ها را عوض می‌کند.",
  "حرف‌ها را روی چرخ بکش و رها کن؛ واژهٔ درست خودش می‌نشیند!",
];

/* ---- in-progress level snapshots (v1.20 session U) ----
 * OLD: a memory-only Map — a shop round-trip survived, but closing the
 * app mid-level wiped every guessed word (user: «وقتی کاربر وسط بازی
 * میاد بیرون و دوباره میره بازی تا اونجایی کلمه حدس زده میپره»).
 * NEW: src/game/core/progress.ts keeps the snapshot in memory AND
 * localStorage, so re-entering a level resumes EXACTLY where the
 * player left off — across app restarts, not just shop visits. */

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

  /* -------- resume support (v1.20: ALWAYS restores — app restarts
   * included, not just the shop round-trip) -------- */
  const progressKey = `${ch}:${lv}`;
  const resumeSnap = useMemo(() => getProgress(progressKey), [progressKey]);
  const wasCompleted = useMemo(() => !!Save.data.levels[progressKey], [progressKey]);
  const resumedDoneRef = useRef(resume === true && wasCompleted && !resumeSnap);
  /* v1.21 — REPLAY = entering an ALREADY-COMPLETED level again (from
   * the map, or resuming a half-played replay). The user: «اگر شخص
   * مرحله‌ای رو انجام داده بعد دوباره میاد انجام میده بابت حدس سکه
   * نده — فقط یکبار سکه بگیره». On a replay the level still plays in
   * full (words, hints, fun) but NOTHING pays out: no per-word coins,
   * no per-bonus coins (the bonusAll ledger already refuses repeats),
   * no star coins — and the win modal shows a gentle replay note
   * instead of the +coins chip. */
  const replayRef = useRef(wasCompleted);

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
  /* v1.20 — GUESS STRIP: the dedicated «کادر ساخت واژه» — a fixed slot
   * between the board and the wheel where the word being dragged is
   * spelled out live (user: «ی کادر درست بکن بدون تداخل جمله… کلمه‌ای
   * که کاربر می‌سازه دیده بشه»). Written IMPERATIVELY by the Wheel
   * (zero re-renders during drags — same pattern as the stroke). */
  const guessRef = useRef<HTMLDivElement | null>(null);
  /* EE — DUPLICATE NOTICE (user: «اون متن تکراری بودن رو جایگاه و
   * انیمیشنش رو بهتر بکن»): instead of the generic bottom toast, a
   * golden chip blooms EXACTLY above the guess strip (where the word
   * was built) carrying the word + a short line. One state write per
   * duplicate submit — duplicates are rare, so this never janks. */
  const [dup, setDup] = useState<{ word: string; msg: string; k: number } | null>(null);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dupKRef = useRef(0);
  useEffect(() => () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); }, []);
  const shuffleBtnRef = useRef<HTMLButtonElement | null>(null);
  /* v1.21 — the row currently playing its letter-by-letter entry */
  const [justFound, setJustFound] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [won, setWon] = useState<{ stars: number; coins: number } | null>(null);
  /* v1.21 — the win modal waits for the completing word's letter entry */
  const winDelayRef = useRef(340);
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
  /* Z — chapter-1 coach bubble (cheer + explanation after each find) */
  const [coach, setCoach] = useState<{ cheer: string; tip: string; k: number } | null>(null);
  const coachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheerIdxRef = useRef(0);
  const teachIdxRef = useRef(0);

  /* keep refs in sync (effects only — never during render) */
  useEffect(() => { foundRef.current = found; }, [found]);
  const wonRef = useRef(false);
  const revealedRef = useRef(revealed);
  useEffect(() => { wonRef.current = !!won; }, [won]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  /* leaving the level mid-progress → snapshot it for the next visit
   * (shop round-trip, pause-exit AND full app restart — all covered).
   * Winning or an empty board clears the snapshot. */
  useEffect(() => () => {
    if (wonRef.current) { clearProgress(progressKey); return; }
    const f = foundRef.current;
    const r = revealedRef.current;
    const e = earnedRef.current;
    if (f.size === 0 && r.size === 0 && e.words === 0 && e.bonus === 0) {
      clearProgress(progressKey);
      return;
    }
    setProgress(progressKey, {
      found: [...f],
      revealed: [...r],
      mistakes: mistakesRef.current,
      earned: { ...e },
    });
  }, [progressKey]);

  const { toast, show } = useToast();

  /* EE — the duplicate notice host (see the .dup-toast CSS) */
  const showDup = useCallback((word: string, msg: string) => {
    dupKRef.current += 1;
    setDup({ word, msg, k: dupKRef.current });
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(() => setDup(null), 1950);
  }, []);

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
  useEffect(() => () => { if (coachTimerRef.current) clearTimeout(coachTimerRef.current); }, []);

  /* Z — the chapter-1 coach: CHEER first (user: «اگر کلمه درست حدس
   * زد تشویق شه»), then a short TEACHING line («بعد ی توضیحاتی بهش
   * داده بشه»). Auto-hides; the pop is WAAPI (compositor only). */
  const showCoach = useCallback((word: string) => {
    const cheer = CH_CHEERS[cheerIdxRef.current % CH_CHEERS.length];
    const tip = CH_TEACH[teachIdxRef.current % CH_TEACH.length]
      .replace("واژه‌ات", `«${word}»`);
    cheerIdxRef.current += 1;
    teachIdxRef.current += 1;
    setCoach({ cheer, tip, k: cheerIdxRef.current + teachIdxRef.current });
    if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
    coachTimerRef.current = setTimeout(() => setCoach(null), 4200);
    Audio.sfxPraise();
  }, []);

  const clearPending = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    pendingRef.current.clear();
    wheelRef.current?.endCelebrate();
  }, []);
  useEffect(() => () => clearPending(), [clearPending]);

  /* stage 2: the word actually lands on the board + the FULL word
   * banner blooms over the screen, then fades (user request).
   * v1.21 TIMING (user: «کلمه ۲ ثانیه با افکت نمایش داده بشه بعد
   * دونه دونه وارد کادر بشه»): the banner holds ~2s while the row's
   * letters fly in one-by-one starting at LETTER_T0. If THIS word
   * completes the level, the win modal holds back until the last
   * letter has landed (winDelayRef) so nothing covers the entry. */
  const commitFound = useCallback((word: string) => {
    pendingRef.current.delete(word);
    const next = new Set(foundRef.current);
    next.add(word);
    foundRef.current = next;
    setFound(next);
    setJustFound(word);
    Audio.sfxSettle();
    /* EE — GLOBAL MAIN-WORD LEDGER (user: «مراقب باش کلا چ هر فصل باشه
     * چ مرحله کاربر تکراری وارد نکنه»): every main word ever built —
     * ANY chapter, ANY level — is remembered forever. The hidden-word
     * check refuses to re-award it as a bonus in a later level. */
    Save.noteMainWord(word);
    if (wordRows.length > 0 && next.size >= wordRows.length) {
      winDelayRef.current = LETTER_T0 + letters(word).length * LETTER_STEP + WIN_EXTRA_MS;
    }
    bannerRafRef.current = requestAnimationFrame(() => {
      bannerRafRef.current = 0;
      const el = bannerRef.current;
      if (!el) return;
      if (bannerWordRef.current) bannerWordRef.current.textContent = word;
      replayWordBanner(el);
    });
  }, [wordRows.length]);
  useEffect(() => () => {
    if (bannerRafRef.current) cancelAnimationFrame(bannerRafRef.current);
  }, []);

  /* stage 1: reward + wheel celebration (100% imperative — no React
   * state writes on the release frame), then apply to the board.
   * v1.21 — REPLAYS PAY NOTHING (user: «فقط یکبار سکه بگیره»): the
   * word still counts and the celebration still plays, but the +۵
   * coin award and its fx are skipped on replays. */
  const celebrate = useCallback((word: string, byPlayer: boolean) => {
    if (foundRef.current.has(word) || pendingRef.current.has(word)) return;
    pendingRef.current.add(word);
    Save.countWord();
    const pays = !replayRef.current;
    if (pays) Save.addCoins(REWARDS.perWord);
    earnedRef.current = { ...earnedRef.current, words: earnedRef.current.words + 1 };
    Audio.sfxWordFound(foundRef.current.size + pendingRef.current.size);
    buzz([18, 30, 18], Save.data.settings.haptics);
    if (byPlayer) {
      dismissTutorial();
      if (ch === 1) showCoach(word); /* Z — chapter-1 encouragement */
    }
    wheelRef.current?.celebrate(word, pays);
    const t = setTimeout(() => {
      wheelRef.current?.endCelebrate();
      commitFound(word);
    }, CELEBRATE_MS);
    timersRef.current.push(t);
  }, [commitFound, dismissTutorial, showCoach, ch]);

  /* Z — HIDDEN-WORD VICTORY LAP (user: «اگر واژه پنهان پیدا شد یک
   * انیمیشن نرم روان ایجاد بشه اون کلمه ریخته بشه بره بالا تو
   * پروفایل خیلی خوشگل»): the word MELTS out of the guess strip and
   * glides up into the player's profile plate (a golden chip on a
   * curved path), then the plate does a happy little pulse.
   * Pure WAAPI on a detached node — zero React re-renders. */
  const flyHiddenWord = useCallback((word: string) => {
    const strip = guessRef.current;
    const plate = document.querySelector<HTMLElement>(".hud-prof-btn");
    if (!strip || !plate || typeof strip.animate !== "function") return;
    /* v7 — the chip is position:fixed and placed with real-px coords,
     * but it lives inside the zoomed .vz-phone stage: Chrome multiplies
     * its local px by the stage zoom → divide by stageZoom() to land on
     * the intended real-px spot on every phone. */
    const z = stageZoom() || 1;
    const s = strip.getBoundingClientRect();
    const t = plate.getBoundingClientRect();
    const chip = document.createElement("div");
    chip.className = "fly-word-chip";
    chip.textContent = word;
    chip.style.left = `${(s.left + s.width / 2) / z}px`;
    chip.style.top = `${(s.top + s.height / 2) / z}px`;
    document.body.appendChild(chip);
    Audio.sfxFlyUp();
    const dx = (t.left + t.width / 2 - (s.left + s.width / 2)) / z;
    const dy = (t.top + t.height / 2 - (s.top + s.height / 2)) / z;
    const anim = chip.animate(
      [
        { transform: "translate(-50%,-50%) scale(.5) rotate(0deg)", opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.3 - 26}px)) scale(1.22) rotate(-3deg)`, opacity: 1, offset: 0.32 },
        { transform: `translate(calc(-50% + ${dx * 0.78}px), calc(-50% + ${dy * 0.78 - 8}px)) scale(0.95) rotate(2deg)`, opacity: 0.95, offset: 0.72, easing: "ease-in" },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0 },
      ],
      { duration: 1250, easing: "cubic-bezier(.3,.6,.35,1)", fill: "both" },
    );
    const done = () => {
      chip.remove();
      replayFX(plate, [
        { transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" },
      ], { duration: 460, easing: "cubic-bezier(.2,1.6,.4,1)" });
      Audio.sfxCoin();
    };
    if (typeof anim.finished?.then === "function") void anim.finished.then(done, done);
    else setTimeout(done, 1250);
  }, []);

  /* Z — REPEAT-WORD HIGHLIGHT (user: «اگر شخص یک کلمه حدس زده بود
   * از قبل ی هایلاتی بخوره ب کادر جمله و گرافیگی»): submitting an
   * already-found word no longer lands silently — the word's row on
   * the board gets a golden GLOW PULSE so the player sees exactly
   * which sentence they had already built. One-shot WAAPI, no
   * re-render, no forced reflow.
   * v5 PERF: the old keyframes animated `filter` + `boxShadow` — both
   * are PAINT-heavy inside the Android WebView and this fires exactly
   * on an input frame. Transform-only scale pop now: same readability,
   * pure compositor work. */
  const flashKnown = useCallback((word: string) => {
    const groups = document.querySelectorAll<HTMLElement>(".wboard .wgroup.done");
    for (const el of groups) {
      if (el.textContent !== word || typeof el.animate !== "function") continue;
      /* EE — a friendlier gold pulse: pop + a tiny happy tilt so the
       * row visibly «greetings» the repeated guess (compositor only,
       * HH: self-releasing — no dead animation left behind) */
      replayFX(el, [
        { transform: "scale(1) rotate(0deg)" },
        { transform: "scale(1.07) rotate(-1.2deg)", offset: 0.3 },
        { transform: "scale(1.03) rotate(1deg)", offset: 0.62 },
        { transform: "scale(1) rotate(0deg)" },
      ], { duration: 640, easing: "cubic-bezier(.3,1.4,.4,1)" });
      break;
    }
    showDup(word, "قبلاً ساختی!");
  }, [showDup]);

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
   * visited from the win modal) re-show the modal WITHOUT re-awarding.
   * v1.21: replays award ZERO star coins, and the modal waits for the
   * letter-by-letter entry of the completing word (winDelayRef) so the
   * last word is fully SEEN before the modal covers the board. */
  useEffect(() => {
    if (won || wordRows.length === 0) return;
    if (found.size >= wordRows.length) {
      const stars = mistakesRef.current === 0 ? 3 : mistakesRef.current <= 2 ? 2 : 1;
      const pays = !replayRef.current;
      if (!resumedDoneRef.current) {
        if (pays) Save.addCoins(REWARDS.perStar * stars);
        Save.completeLevel(ch, lv, stars, mistakesRef.current);
        Audio.sfxLevelComplete(stars);
        clearProgress(progressKey);
      }
      const delay = winDelayRef.current;
      winDelayRef.current = 340;
      const t = setTimeout(() => setWon({ stars, coins: pays ? REWARDS.perStar * stars : 0 }), delay);
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
      flashKnown(str); /* Z — golden highlight on the already-solved row */
      return "known";
    }
    const uniq = new Set(wordRows);
    if (!uniq.has(str) && isRealWord(str) && canBuild(str, level.wheel)) {
      /* EE — NO DUPLICATES ANYWHERE (user: «مراقب باش کلا چ هر فصل باشه
       * چ مرحله کاربر تکراری وارد نکنه»): a word that was EVER a main
       * answer (any chapter / any level — mainAll ledger) or EVER a
       * hidden word (bonusAll ledger) is never re-awarded — the golden
       * duplicate chip explains it right above the guess strip. */
      if (Save.data.mainAll.includes(str) || !Save.addBonusWord(ch, lv, str)) {
        showDup(str, "این واژهٔ پنهان را قبلاً یافتی!");
      } else {
        Save.countBonus();
        Save.addCoins(REWARDS.perBonus);
        earnedRef.current = { ...earnedRef.current, bonus: earnedRef.current.bonus + 1 };
        Audio.sfxBonus();
        flyHiddenWord(str); /* Z — the word melts up into the profile */
        show(`واژه پنهان! +${faNum(REWARDS.perBonus)} سکه`);
      }
      return false;
    }
    mistakesRef.current += 1;
    Audio.sfxWrong();
    buzz(40, Save.data.settings.haptics);
    setShaking(true);
    return false;
  }, [wordRows, level, ch, lv, show, celebrate, flashKnown, flyHiddenWord, showDup]);

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
    /* v1.21 — the new vector icon does a full graceful spin per press */
    shuffleBtnRef.current?.querySelector(".shuffle-svg")?.animate?.(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 440, easing: "cubic-bezier(.3,.6,.3,1)" },
    );
  };

  /* Z — the chapter-1 TEACHING DEMO: a beautiful hand GLIDES across
   * the REAL wheel seats of the level's first word, spelling it into
   * the guess strip letter-by-letter while each tile glows under the
   * fingertip (user: «یک انیمیشن دست بیاد قشنگ یاد بده»). It loops
   * calmly until the player's own first drag fades it away. */
  const tutHandRef = useRef<HTMLSpanElement | null>(null);
  const demoWord = wordRows[0] ?? "";
  useEffect(() => {
    if (!tutorial || tutFading) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(t);
    };
    const ls = letters(demoWord);
    const runCycle = () => {
      const wrap = document.querySelector<HTMLElement>(".wheel-wrap");
      const hand = tutHandRef.current;
      const g = guessRef.current;
      if (!wrap || !hand || !g || ls.length < 2) return;
      /* letter → seat (page coords). Duplicate letters consume seats
       * one-by-one so «باران»'s two alefs land on two tiles. */
      const tiles = Array.from(wrap.querySelectorAll<HTMLElement>(".tile"));
      const seatFor = (ch: string): { x: number; y: number } | null => {
        const i = tiles.findIndex((t) => t.getAttribute("aria-label") === ch);
        if (i === -1) return null;
        const el = tiles.splice(i, 1)[0];
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 - 34 };
      };
      const pts = ls.map(seatFor);
      if (pts.some((p) => p === null)) return;
      const P = pts as { x: number; y: number }[];
      /* v7 — the hand is position:fixed inside the zoomed stage: its
       * local px are multiplied by the stage zoom → divide the real-px
       * targets by stageZoom() so the fingertip lands ON the seats. */
      const z = stageZoom() || 1;
      const setT = (p: { x: number; y: number }) => { hand.style.transform = `translate(${p.x / z}px, ${p.y / z}px)`; };
      setT(P[0]);
      if (g.textContent !== "") { g.textContent = ""; g.parentElement?.classList.remove("live"); }
      const HOP = 340;
      P.forEach((p, i) => {
        if (i === 0) return;
        later(() => {
          if (typeof hand.animate === "function") {
            hand.animate(
              [{ transform: `translate(${P[i - 1].x / z}px, ${P[i - 1].y / z}px)` }, { transform: `translate(${p.x / z}px, ${p.y / z}px)` }],
              { duration: HOP, easing: "cubic-bezier(.4,.1,.4,1)", fill: "both" },
            );
          } else setT(p);
          g.textContent = ls.slice(0, i + 1).join("");
          g.parentElement?.classList.add("live");
          const tile = Array.from(wrap.querySelectorAll<HTMLElement>(".tile")).find((t) => t.getAttribute("aria-label") === ls[i]);
          /* glow WITHOUT transform — scaling the tile itself would
           * shift the measured geometry mid-demo (audit + layout truth
           * live in the rect).
           * v5 PERF: the old keyframes animated `filter` + `boxShadow`
           * per letter every ~380 ms — a repaint storm inside the
           * WebView during the tutorial. A pure OPACITY blink now
           * (compositor-only), skipped entirely under .lowfx. */
          if (tile && !isLowFx() && typeof tile.animate === "function") {
            tile.animate(
              [
                { opacity: 1 },
                { opacity: 0.35, offset: 0.45 },
                { opacity: 1 },
              ],
              { duration: 320, easing: "ease-out" },
            );
          }
          Audio.sfxLetter(Math.min(i, 5));
        }, 380 + i * HOP);
      });
      /* hold the finished word, then melt it away and loop */
      const total = 380 + P.length * HOP + 900;
      later(() => {
        if (g.textContent !== "") { g.textContent = ""; g.parentElement?.classList.remove("live"); }
      }, total);
      later(runCycle, total + 750);
    };
    later(runCycle, 650);
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      const g = guessRef.current;
      if (g) { g.textContent = ""; g.parentElement?.classList.remove("live"); }
    };
  }, [tutorial, tutFading, demoWord]);

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

      {/* board — X-FIX: the roomy branch emits one row PER WORD and the
          panel claims a COMPACT budget (rows*42+22, capped 32%/36%) —
          the solver shrinks tiles to whatever the panel really gets, so
          nothing ever scrolls/overflows and the WHEEL keeps real space
          (user: «هنوز دایره کلمات کوچیکه… بزرگ باشه و فاصله دار»).
          Tile cap 36 = still standard-large. */}
      <div
        className={`board-box ${shaking ? "shake" : ""}`}
        data-skin={ch}
        onAnimationEnd={() => setShaking(false)}
        style={{
          flex: "1 1 auto",
          flexBasis: `min(${Math.ceil(wordRows.length / (wordRows.length >= 7 ? 2 : 1)) * 42 + 22}px, ${wordRows.length >= 7 ? 36 : 32}%)`,
          maxHeight: `min(${Math.ceil(wordRows.length / (wordRows.length >= 7 ? 2 : 1)) * 42 + 22}px, ${wordRows.length >= 7 ? 36 : 32}%)`,
          minHeight: 96,
          margin: "4px 10px 0",
        }}
      >
        <WordBoard
          words={wordRows}
          found={found}
          revealed={revealed}
          justFound={justFound}
        />
      </div>

      {/* GUESS STRIP (v1.20) — the live word-builder box; a FIXED flex
          slot so it can never collide with the board or the wheel.
          X-FIX — the COMPLETE-WORD banner now lives INSIDE this slot:
          it used to float over the SHEET CENTER and physically COVER
          the board's last rows for its 2.8s hold (user: «کادر جملات
          تداخل داره و از کادر خارج شده»). The strip is idle exactly
          while the banner plays — the built word graduates in the box
          where it was built. */}
      <div className="guess-strip">
        <div ref={guessRef} className="guess-inner" aria-hidden />
        <span className="guess-hint" aria-hidden>واژه‌ات را اینجا بساز…</span>
        {/* EE — duplicate notice: blooms right above the strip, where the
            word was built (user: «جایگاه و انیمیشنش رو بهتر بکن») */}
        {dup && (
          <div key={dup.k} className="dup-toast" role="status">
            <span className="dup-ic" aria-hidden>!</span>
            <b className="dup-word" aria-hidden>{dup.word}</b>
            <span className="dup-msg">{dup.msg}</span>
          </div>
        )}
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
      </div>

      {/* wheel — v6: driven imperatively through the ref; celebrations
          never re-render PlayScreen or the Wheel. v1.20: seed makes the
          letter seats GENUINELY RANDOM per level (user: «کلمات باید
          رندوم باشن» — the old ring seated letters in wheel order). */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0 2px" }}>
        <Wheel
          ref={wheelRef}
          letters={wheelLetters}
          seed={globalLevel(ch, lv)}
          shuffleKey={shuffleKey}
          reward={REWARDS.perWord}
          guessRef={guessRef}
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
        <button ref={shuffleBtnRef} type="button" aria-label="بر زدن" className="fab-shuffle" onClick={doShuffle}>
          <ShuffleSvg />
          <b>بُر بزن</b>
        </button>
      </div>

      {/* Z — chapter-1 coach: cheer + explanation after each find */}
      {coach && (
        <div key={coach.k} className="pcoach rise-in" role="status">
          <img src="/assets/char/thumb.webp" alt="عمو دانا" draggable={false} />
          <div className="pcoach-body">
            <b>{coach.cheer}</b>
            <span>{coach.tip}</span>
          </div>
        </div>
      )}

      {/* Z — the chapter-1 tutorial: veil + teaching card + a hand that
          really DEMONSTRATES the drag on the actual wheel seats.
          pointer-events none → the wheel stays fully playable and the
          first real drag fades everything away. */}
      {tutorial && (
        <div className={`tut-veil fade-in ${tutFading ? "tut-out" : ""}`} aria-hidden>
          <span ref={tutHandRef} className="tut-hand-fly">
            <HandSvg />
          </span>
          <div className="tut-card rise-in">
            <img src="/assets/char/thumb.webp" alt="" draggable={false} />
            <div className="tut-card-txt">
              <b>با انگشتت حرف‌ها را بکش!</b>
              <span>مثل دستِ من، حرف‌ها را روی چرخ به هم وصل کن تا واژهٔ «{demoWord}» ساخته شود…</span>
            </div>
          </div>
        </div>
      )}

      {/* (the complete-word banner moved into the guess strip — X-FIX) */}

      {paused && (
        <PauseModal
          onResume={() => setPaused(false)}
          onRestart={() => {
            clearPending();
            clearProgress(progressKey);
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
          replay={replayRef.current}
          onContinue={onNext}
          onShop={onShop}
        />
      )}

      <ToastHost toast={toast} />
    </Sheet>
  );
}

/* (MenuLines removed — the reference pause entry is the blue HUD gear) */

/* ================= WordBoard — v1.22: ADAPTIVE ROW PACKING.
   The user's idea: «کادرهاشون تقسیم کن ب سمت چپ و راست اینطوری مشکل
   تداخل پیش نمیاد و همشون جا میشن ولی بزرگشون کن استاندارد بشن».
   For crowded levels (۸–۱۰ جمله) the board now PACKS rows:
   • a long word that can't pair at a standard size gets its own
     full-width hero row,
   • shorter words pair up LEFT+RIGHT in one row (uniform tile size
     inside the row, mathematically guaranteed to fit — no overlap),
   • every row keeps the biggest STANDARD tile (≥26px) possible;
   quiet levels (≤5 words / roomy fits) keep the classic uniform
   single column, just bigger (tiles up to 40px).
   v5 PERF: each row/group is a memo component with primitive props.
   v1.22 ENTRY FIX (user: «کادرها غیب میشن بعد کلمات وارد میشن»): the
   tile BOXES never vanish — only the LETTER GLYPH (<b.wl>) flies into
   its already-visible box. Restored snapshots never replay it. ================= */
interface PackRow { items: string[]; tile: number }

const WordBoard = memo(function WordBoard({
  words, found, revealed, justFound,
}: {
  words: string[];
  found: Set<string>;
  revealed: Set<string>;
  justFound: string | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<PackRow[]>(() => [{ items: words, tile: 32 }]);
  const lens = useMemo(() => words.map((w) => letters(w).length), [words]);
  const lensKey = useMemo(() => lens.join(","), [lens]);

  /* X-SETTLE — box-model arithmetic can be off by a few px (borders,
   * % max-height resolution) → the board scrolls a few px and hides a
   * word. Instead of chasing constants, this self-corrects: if the
   * rendered board overflows its clamp by >2px, shave 1px off every
   * row's tile per frame until it fits (converges in a few frames,
   * never oscillates — it only shrinks). */
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || rows.length === 0) return;
    if (el.scrollHeight - el.clientHeight > 2 && rows.some((r) => r.tile > 14)) {
      const t = requestAnimationFrame(() => {
        setRows((prev) => prev.map((r) => ({ ...r, tile: Math.max(14, r.tile - 1) })));
      });
      return () => cancelAnimationFrame(t);
    }
  }, [rows]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    /* v1.22 — measure the PANEL (parent), not this content element:
     * .wboard shrinks to its content, so measuring itself creates a
     * shrink feedback loop that spiralled tiles down to the 18px floor. */
    const host = el.parentElement;
    if (!host) return;
    /* X-FIX — the constants below MUST mirror game.css exactly:
     *   .wboard   column gap = 0.26 × tile      (was 0.24 → drift)
     *   .wrow     pair gap    = 10px fixed       (was 8 → drift)
     *   .wgroup   letter gap  = 4px
     *   .wboard   padding 2px 4px + .board-box padding 12px 10px →
     *             vertical reserve 28, horizontal reserve 8.
     * v1.22 regression FIXED (user: «کادر جملات حدس زده شده تداخل داره
     * و از کادر خارج شده»): the roomy branch used to return ONE PackRow
     * holding ALL words → BoardRow laid them out side-by-side in a
     * single flex line that overflowed the panel. Uniform mode now
     * emits ONE ROW PER WORD (the classic column), and every solved
     * tile is FLOORED (never rounded up past its fit). */
    const calc = () => {
      const cw = el.clientWidth;
      if (cw <= 0) return;
      const W = cw - 8;               /* .wboard inner padding */
      /* .wboard is absolutely positioned (inset 12px) → its clientHeight
       * IS the exact playbox; -4 = its own 2px vertical padding pair.
       * (Before the inset change the % max-height resolved oddly and
       * every level scrolled exactly 6px — the X-audit's finding.) */
      const H = Math.max(120, el.clientHeight - 4);
      const PAD = 8, CGAP = 10, GAP = 4, TH = 26, CAP = 36, GAPF = 0.26;
      const soloT = (l: number) => (W - PAD - GAP * (l - 1)) / l;
      const pairT = (l1: number, l2: number) =>
        (W - PAD - CGAP - GAP * (l1 - 1) - GAP * (l2 - 1)) / (l1 + l2);
      const sorted = [...words].sort(
        (a, b) => letters(b).length - letters(a).length || (a < b ? -1 : 1),
      );
      const n = sorted.length;
      const longest = n ? letters(sorted[0]).length : 3;
      const hfAll = H / (n + GAPF * (n - 1));
      const uni = Math.min(soloT(longest), hfAll, CAP);
      let next: PackRow[];
      if (uni >= TH) {
        /* classic uniform column — one row PER WORD, biggest standard tile */
        const t = Math.max(20, Math.floor(uni));
        next = sorted.map((w) => ({ items: [w], tile: Math.min(t, Math.floor(soloT(letters(w).length))) }));
      } else {
        /* adaptive packing: hero rows + left/right pairs */
        const unplaced = [...sorted];
        const built: PackRow[] = [];
        while (unplaced.length > 0) {
          const w = unplaced.shift()!;
          const lw = letters(w).length;
          let bestJ = -1, bestT = 0;
          for (let j = 0; j < unplaced.length; j++) {
            const t = Math.min(pairT(lw, letters(unplaced[j]).length), CAP);
            if (t >= TH && t > bestT) { bestT = t; bestJ = j; }
          }
          if (bestJ >= 0) built.push({ items: [w, unplaced.splice(bestJ, 1)[0]], tile: Math.floor(bestT) });
          else built.push({ items: [w], tile: Math.floor(Math.min(soloT(lw), CAP)) });
        }
        /* height guard: shrink proportionally if the packed rows overflow
         * (shrinking never breaks the width fit — smaller is narrower) */
        const total = built.reduce((s, r) => s + r.tile * (1 + GAPF), 0);
        if (total > H) {
          const f = H / total;
          for (const r of built) r.tile = Math.max(15, Math.floor(r.tile * f));
        }
        next = built;
      }
      setRows((prev) =>
        prev.length === next.length &&
        prev.every((r, i) => r.items.join("|") === next[i].items.join("|") && r.tile === next[i].tile)
          ? prev : next,
      );
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(host);
    return () => ro.disconnect();
  }, [words, lensKey]);

  return (
    <div ref={boxRef} className="wboard" style={{ ["--wt" as string]: `${rows.length ? Math.min(...rows.map((r) => r.tile)) : 32}px` }}>
      {rows.map((r) => (
        <BoardRow key={r.items.join("|")} items={r.items} tile={r.tile} found={found} revealed={revealed} justFound={justFound} />
      ))}
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

/* one BOARD ROW = one or two words sharing the row (left/right pair).
   The row owns its own --wt so letter gaps always match its tile size;
   the row-wide shine sweep + the letter-stagger are driven by --ld. */
const BoardRow = memo(function BoardRow({
  items, tile, found, revealed, justFound,
}: {
  items: string[];
  tile: number;
  found: Set<string>;
  revealed: Set<string>;
  justFound: string | null;
}) {
  const newWord = justFound !== null && items.includes(justFound) ? justFound : null;
  const tailMs = newWord ? LETTER_T0 + letters(newWord).length * LETTER_STEP : 0;
  return (
    <div
      className={`wrow ${newWord ? "new" : ""}`}
      style={{ ["--wt" as string]: `${tile}px`, ...(newWord ? { ["--ld" as string]: `${tailMs}ms` } : {}) }}
    >
      {items.map((w) => {
        const isF = found.has(w);
        /* shown-mask: "1" → letter visible (found words show everything) */
        const mask = isF
          ? LETTER_MASKS[letters(w).length] ?? "1".repeat(letters(w).length)
          : maskOf(w, revealed);
        return <WordGroup key={w} word={w} isF={isF} isNew={w === newWord} mask={mask} tile={tile} />;
      })}
    </div>
  );
});

/* one WORD inside a row: its parchment boxes + letter glyphs.
   v1.22 — NEWLY-found word: the tile BOXES render instantly (a found
   parchment slot waiting for its letter) and each LETTER GLYPH sits in
   an inner <b class=wl> that flies in one-by-one on its inline delay —
   the box never disappears anymore (user: «کادرها غیب میشن بعد کلمات
   وارد میشن»). Sparkles + shine sweep fire after the LAST letter. */
const WordGroup = memo(function WordGroup({
  word, isF, isNew, mask, tile,
}: {
  word: string;
  isF: boolean;
  isNew: boolean;
  mask: string;
  tile: number;
}) {
  const ls = letters(word);
  const tailMs = LETTER_T0 + ls.length * LETTER_STEP;
  return (
    <div className={`wgroup ${isF ? "done" : ""} ${isNew ? "new" : ""}`}>
      {ls.map((ch, i) => {
        const shown = isF || mask[i] === "1";
        return (
          <span
            key={i}
            className={`wtile ${isF ? "fill" : shown ? "reveal" : "empty"}`}
            style={{
              animationDelay: !isNew && isF ? `${i * 45}ms` : undefined,
              fontSize: Math.round(tile * 0.62),
            }}
          >
            <b className="wl" style={isNew ? { animationDelay: `${LETTER_T0 + i * LETTER_STEP}ms` } : undefined}>
              {shown ? ch : ""}
            </b>
          </span>
        );
      })}
      {isF && (
        <span className="wsparkles" aria-hidden>
          {Array.from({ length: 6 }, (_, s) => (
            <i key={s} style={{
              ["--dx" as string]: `${(s - 2.5) * 26}px`,
              ["--dy" as string]: `${-18 - (s % 3) * 14}px`,
              ["--dd" as string]: isNew ? `${tailMs + s * 55}ms` : `${s * 45}ms`,
            }} />
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
/* v1.22 — smooth pop (≈340ms) → FULL hold ≈2s → graceful fade: the
   word is never a flash anymore (user: «حداقل ۲ ثانیه بمونه»).
   ⚠ TWO WAAPI rules learned the hard way:
   1. a keyframe that OMITS a property gets the element's UNDERLYING
      value (idle ribbon = opacity 0 → a hidden dip mid-hold) — every
      keyframe states opacity explicitly;
   2. an OVERSHOOT bezier (y₁>1) as the TOP-LEVEL easing warps the
      whole timeline (eased time reaches 1 at ~35% → the track jumps to
      its final keyframe and HOLDS it = the «یهو ظاهر میشه سریع ناپدید
      میشه» flash). Overshoot curves are only safe PER-KEYFRAME as
      value easing — the spring lives on the pop segment only. */
const KF_RIBBON: Keyframe[] = [
  { transform: "scale(.5) translateY(30px)", opacity: 0, offset: 0, easing: "cubic-bezier(.2,1.2,.4,1)" },
  { transform: "scale(1.06) translateY(0)", opacity: 1, offset: 0.12, easing: "ease-out" },
  { transform: "scale(1)", opacity: 1, offset: 0.2, easing: "linear" },
  { transform: "scale(1)", opacity: 1, offset: 0.82, easing: "ease-in" },
  { transform: "scale(.95) translateY(-26px)", opacity: 0, offset: 1 },
];
const KF_STAR_L: Keyframe[] = [
  { transform: "rotate(-160deg) scale(0)", opacity: 0, offset: 0, easing: "cubic-bezier(.2,1.3,.4,1)" },
  { transform: "rotate(20deg) scale(1.25)", opacity: 1, offset: 0.55, easing: "ease-out" },
  { transform: "rotate(0deg) scale(1)", opacity: 1, offset: 1 },
];
const KF_STAR_R: Keyframe[] = [
  { transform: "rotate(160deg) scale(0)", opacity: 0, offset: 0, easing: "cubic-bezier(.2,1.3,.4,1)" },
  { transform: "rotate(-20deg) scale(1.25)", opacity: 1, offset: 0.55, easing: "ease-out" },
  { transform: "rotate(0deg) scale(1)", opacity: 1, offset: 1 },
];
const KF_DUST = (dx: string, dy: string): Keyframe[] => [
  { transform: "translate(0,0) scale(.4) rotate(0deg)", opacity: 0, offset: 0 },
  { transform: `translate(${parseFloat(dx) * 0.45}px, ${parseFloat(dy) * 0.45}px) scale(.8) rotate(90deg)`, opacity: 1, offset: 0.14 },
  { transform: `translate(${dx},${dy}) scale(1) rotate(200deg)`, opacity: 0, offset: 1 },
];

/** restart-safe replay of the pre-mounted complete-word banner */
function replayWordBanner(root: HTMLElement): void {
  if (typeof root.animate !== "function") return;
  const ribbon = root.querySelector<HTMLElement>(".wb-ribbon");
  const starL = root.querySelector<HTMLElement>(".wb-star.l");
  const starR = root.querySelector<HTMLElement>(".wb-star.r");
  for (const el of [ribbon, starL, starR]) cancelAnims(el);
  replayFX(ribbon, KF_RIBBON, { duration: BANNER_MS, fill: "both" });
  replayFX(starL, KF_STAR_L, { duration: BANNER_MS, fill: "both" });
  replayFX(starR, KF_STAR_R, { duration: BANNER_MS, fill: "both" });
  root.querySelectorAll<HTMLElement>(".wb-dust i").forEach((el, i) => {
    cancelAnims(el);
    replayFX(
      el,
      KF_DUST(el.style.getPropertyValue("--dx"), el.style.getPropertyValue("--dy")),
      { duration: 1500, delay: i * 55, easing: "ease-out", fill: "both" },
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
  celebrate(word: string, showCoin?: boolean): void;
  endCelebrate(): void;
}

/* v1.20 — deterministic PRNG (mulberry32): the seat shuffle must be
 * random for the PLAYER but stable across re-renders (no SSR flicker,
 * no double-render divergence). Seeded per (level, shuffleKey). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Wheel = memo(forwardRef(function Wheel({
  letters: ls, seed, shuffleKey, reward, guessRef, onRelease, onFirstDrag,
}: {
  letters: string[];
  seed: number;
  shuffleKey: number;
  reward: number;
  guessRef?: React.RefObject<HTMLDivElement | null>;
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
  const rRef = useRef(46); /* TAP radius in px (pointer-down), measured per stroke */
  const catchRRef = useRef(30); /* Y — PASS-THROUGH catch threshold (segment distance) */
  /* Y — coalesced-drag state: pointermove ONLY records the finger; the
   * single rAF tick does the catch + ribbon paint exactly once per
   * frame. The catch is SEGMENT-based: a tile is caught when the
   * finger's path (prev → current) passes within catchR of its CENTER
   * — not when the finger merely comes close. A straight stroke that
   * SKIPS a seat passes ~R×(1−cosθ) from the skipped tile (the probe:
   * 47px on a 7-seat wheel) — catchR is clamped BELOW that clearance,
   * so skipped seats can never be grazed (that was the «stray letter
   * in my word» bug + the e2e mistakes). */
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const prevPtRef = useRef<{ x: number; y: number } | null>(null);
  /* v7 — the FULL coalesced pointer trail: Android delivers one event
   * per frame with several merged samples; recording ALL of them lets
   * the catch follow the finger's true (possibly curved) path, so fast
   * strokes never cut a corner and skip a tile. */
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const lineStrRef = useRef("");
  /* tile elements for DOM-driven .sel painting (idx → element) */
  const tileElsRef = useRef<Map<number, HTMLElement> | null>(null);
  /* v3 PERF: rect cached once per stroke — pointermove used to call
   * getBoundingClientRect() (a forced layout read) on EVERY move event,
   * which janks the wheel on weak phones during fast drags. */
  const rectRef = useRef<DOMRect | null>(null);

  /* v1.22 — ADAPTIVE SEAT GEOMETRY (set by the fit() layout effect
   * below): tile px + seat radius %, solved per (size, letter-count). */
  const [geom, setGeom] = useState({ tile: 0, wr: 37 });

  const positions = useMemo(() => {
    const n = ls.length;
    /* v1.20 RANDOM SEATS (user: «اولین حروف دقیقا از سمت راست حلقه…
     * کلمات باید رندوم باشن» + «بر زدنش ب ترتیب قاطی میکنه»):
     * the OLD ring seated letters in wheel order (rotationally shifted),
     * so the answer was readable around the circle and every shuffle
     * press just rotated the ring — with 6-letter wheels the shift was
     * ALWAYS exactly one seat (5 % (6-1) = 0), so repeated letters made
     * it look like the shuffle did nothing at all.
     * NEW: seeded Fisher–Yates — every level starts genuinely random
     * and every shuffle press is a FULL re-mix.
     * v1.22 — the seat radius comes from the measured geometry (wr)
     * so crowded wheels (۹–۱۲ حرف) spread WIDER apart instead of
     * crushing together (user: «دایره کشیدن کلمات تنگ کوچیک میشه»). */
    const rnd = mulberry32((seed + 1) * 0x9e3779b1 ^ (shuffleKey + 1) * 0x85ebca6b);
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    const wr = geom.wr;
    return perm.map((idx, i) => {
      const ang = -90 + (360 / n) * i;
      const rad = (ang * Math.PI) / 180;
      return { idx, x: 50 + wr * Math.cos(rad), y: 50 + wr * Math.sin(rad) };
    });
  }, [ls, seed, shuffleKey, geom.wr]);

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
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(1)`, easing: "cubic-bezier(.22,1.3,.36,1)" },
            { transform: `translate(calc(-50% + ${(dx * 0.16).toFixed(1)}px), calc(-50% + ${(dy * 0.16).toFixed(1)}px)) rotate(${wob}deg) scale(1.12)`, offset: 0.55, easing: "ease-out" },
            { transform: "translate(-50%, -50%) rotate(0deg) scale(1)" },
          ],
          { duration: 470, delay: d * 26 },
        );
        d++;
      });
    }
    firstMountRef.current = false;
    seatPxRef.current = next;
  }, [positions]);

  /* selection lives ONLY in refs — tiles + line are painted by direct
   * DOM writes. A drag causes ZERO React re-renders. */
  /* v1.21 — the GUESS STRIP writer, CONNECTED («رو جدا جدا نمایش میده
   * من میخام جمله ساخته بشه چسبیده و درست و دقیق»): the word is one
   * single text node so the Persian letters JOIN properly (separate
   * <b> tiles broke the cursive joining between letters). Direct DOM
   * (tiny) — drags still never re-render React. */
  const paintGuess = () => {
    const g = guessRef?.current;
    if (!g) return;
    const sel = selRef.current;
    if (sel.length === 0) {
      if (g.textContent !== "") g.textContent = "";
      g.parentElement?.classList.remove("live");
      return;
    }
    const word = sel.map((i) => ls[i]).join("");
    if (g.textContent !== word) {
      g.textContent = word;
      /* tiny pulse on every caught letter — compositor only */
      if (typeof g.animate === "function") {
        g.animate(
          [{ transform: "scale(1.08)" }, { transform: "scale(1)" }],
          { duration: 140, easing: "cubic-bezier(.2,1.6,.4,1)" },
        );
      }
    }
    g.parentElement?.classList.add("live");
  };

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
    paintGuess();
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
    /* Y — skip-unchanged guard: idle/caught-up frames write NOTHING
     * (setAttribute on 3 polylines forced SVG repaints every frame) */
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

  /* v7 — CATCH THE WHOLE STROKE (user: «کلمات به سختی کشیده میشه و
   * درست حسابی وصل نمیشن ب هم سخته»): the old catch registered AT MOST
   * ONE tile per frame, so a fast stroke skipped seats and words came
   * out wrong or felt «hard to drag». Now the segment prev→finger is
   * walked REPEATEDLY: every pass grabs the nearest uncaught tile
   * within the catch radius and restarts the segment FROM that tile —
   * one frame can register a whole run of tiles IN ORDER, exactly the
   * seats the finger passed through (Word-Cookies behaviour). */
  const catchUpTo = (pt: { x: number; y: number } | null) => {
    if (!dragRef.current || !pt) return;
    const T = catchRRef.current * catchRRef.current;
    let played = false;
    for (let guard = 0; guard < 14; guard++) {
      const cur = selRef.current;
      const from = prevPtRef.current ?? pt;
      let best: number | null = null;
      let bestD = T;
      for (const c of centersRef.current) {
        if (cur.includes(c.idx)) continue;
        const d = distToSeg(c.x, c.y, from.x, from.y, pt.x, pt.y);
        if (d * d < bestD) { bestD = d * d; best = c.idx; }
      }
      if (best === null) break;
      const next = [...cur, best];
      if (!played) { Audio.sfxLetter(next.length); played = true; } /* one blip per frame max */
      applySel(next);
      /* tail snaps to the newly caught tile — then keeps chasing.
       * NO auto-commit here anymore (v2.0): the word is judged on release */
      const c = centersRef.current.find((c) => c.idx === best)!;
      tipCurRef.current = { x: c.x, y: c.y };
      prevPtRef.current = { x: c.x, y: c.y }; /* next pass starts from the caught tile */
      /* v1.21 — juicy CATCH POP on the tile + a soft ring pulse
       * («یکم نرم‌تر و گرافیکی‌تر»): WAAPI, compositor-only. */
      const el = tileElsRef.current?.get(best);
      if (el && typeof el.animate === "function") {
        el.animate(
          [
            { transform: "translate(-50%,-50%) scale(1.28)" },
            { transform: "translate(-50%,-50%) scale(1.1)" },
          ],
          { duration: 200, easing: "cubic-bezier(.2,1.6,.4,1)" },
        );
      }
      if (Math.abs(pt.x - c.x) < 1 && Math.abs(pt.y - c.y) < 1) break;
    }
    prevPtRef.current = pt; /* the next frame's segment starts at the finger */
  };

  const tick = () => {
    /* v7 — consume the recorded trail: every pointer sample since the
     * last frame is caught IN ORDER (fast strokes register every seat) */
    const trail = trailRef.current;
    if (trail.length > 0) {
      if (dragRef.current) for (const pt of trail) catchUpTo(pt);
      trail.length = 0;
    }
    const tipT = tipTargetRef.current;
    const tipC = tipCurRef.current;
    if (tipT && tipC) {
      /* v7 — 0.3→0.42: the tail follows the finger visibly faster
       * (the old 0.3 read as «ب سختی کشیده میشه» lag) while the lerp
       * still rounds the corners pleasantly */
      tipC.x += (tipT.x - tipC.x) * 0.42;
      tipC.y += (tipT.y - tipC.y) * 0.42;
      if (Math.abs(tipT.x - tipC.x) < 0.5 && Math.abs(tipT.y - tipC.y) < 0.5) {
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
    /* generous TAP radius (a press is deliberate) */
    rRef.current = Math.max(34, r.width * 0.18);
    /* v7 — SEGMENT catch radius, zoom-aware and roomier (user: catch
     * felt tight/hard): clamped below the skip-seat clearance
     * R×(1−cos(2π/n)) so a straight stroke between two seats still can
     * NEVER graze the seat between them. geom.tile is authored in
     * design-px — multiply by the stage zoom to compare against real
     * pointer coordinates. */
    const ringR = (geom.wr / 100) * r.width;
    const n = Math.max(3, centersRef.current.length);
    const clear = ringR * (1 - Math.cos((2 * Math.PI) / n));
    const tilePx = geom.tile * stageZoom();
    catchRRef.current = Math.max(18, Math.min(tilePx * 0.52, clear * 0.92));
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

  /* v1.20 — SHUFFLE FX (user: «گرافیگ و افکت بده بهش»): the wooden ring
   * physically SPINS while the tiles glide to their new seats (FLIP
   * above). Class-on/class-off — compositor-only, no React re-render. */
  useEffect(() => {
    if (shuffleKey === 0) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.classList.add("shuffling");
    const t = setTimeout(() => wrap.classList.remove("shuffling"), 700);
    return () => { clearTimeout(t); wrap.classList.remove("shuffling"); };
  }, [shuffleKey]);

  /* v1.20 — HEIGHT-AWARE WHEEL SIZE: the wrap used to be a FIXED
   * min(76vw, 330px) square; on short screens the flex column overflowed
   * and the board slid UNDER the wheel (user: «جمله‌ها از کادر خارج
   * میشه میره زیر دایره»). Now the wrap fits BOTH axes of its flex
   * container — one ResizeObserver, zero per-frame work.
   * v1.22 — ADAPTIVE SEAT GEOMETRY: tile + seat radius solved per
   * (size, letter-count).
   * SESSION Y (user: «این دکمه های کلمه روی دایره زیادی بزرگن — یکم
   * کوچیک تر بکن، از هم دیگ فاصله داشته باشن، اما خود دایره بزرگ
   * بمونه»): the tile cap drops 29%→23% of the wheel, the neighbor
   * gap doubles 10→18px, the glyph ratio rises (0.32→0.35) so the
   * letters stay big inside the smaller discs — and the WHEEL ITSELF
   * keeps its exact size (floor 188 / cap 364 untouched). */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const host = wrap?.parentElement;
    if (!wrap || !host) return;
    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w <= 0 || h <= 0) return;
      /* v1.22 — 170px→188px FLOOR kept: the wheel stays BIG (user). */
      const s = Math.max(188, Math.floor(Math.min(w - 8, h - 4, 364)));
      const n = Math.max(1, ls.length);
      const tCap = 0.23 * s;                       /* Y: was 0.29 */
      const tFit = ((2 * Math.PI * (s / 2 - 5)) / n - 18) / (1 + Math.PI / n); /* Y: gap 10→18 */
      const tile = Math.max(26, Math.min(tCap, tFit));
      const wr = Math.min(43, ((s / 2 - tile / 2 - 4) / s) * 100);
      wrap.style.width = `${s}px`;
      wrap.style.height = `${s}px`;
      wrap.style.setProperty("--tile", `${Math.round(tile)}px`);
      setGeom((g) => (Math.abs(g.tile - tile) < 1 && Math.abs(g.wr - wr) < 0.25 ? g : { tile, wr }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [ls.length]);

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
   * burst + coin replay via WAAPI (no reflow, no React state).
   * v1.21 — showCoin=false on REPLAYS (no +۵ chip for a level that
   * already paid out once). */
  const lockRef = useRef(false);
  const celebrate = useCallback((_: string, showCoin = true) => {
    lockRef.current = true;
    wrapRef.current?.classList.add("fx");
    const b = burstRef.current;
    if (b && typeof b.animate === "function") {
      const ring = b.querySelector<HTMLElement>(".wb-ring");
      const flash = b.querySelector<HTMLElement>(".wb-flash");
      cancelAnims(ring, flash);
      replayFX(ring, KF_RING, { duration: 580, easing: "ease-out", fill: "both" });
      replayFX(flash, KF_FLASH, { duration: 400, easing: "ease-out", fill: "both" });
      b.querySelectorAll<HTMLElement>("i").forEach((el, i) => {
        cancelAnims(el);
        replayFX(
          el,
          KF_SPARK(el.style.getPropertyValue("--dx"), el.style.getPropertyValue("--dy")),
          { duration: 600, delay: i * 24, easing: "ease-out", fill: "both" },
        );
      });
    }
    const c = coinFxRef.current;
    if (c && showCoin && typeof c.animate === "function") {
      cancelAnims(c);
      replayFX(c, KF_COIN, { duration: 620, easing: "ease-out", fill: "both" });
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
    paintGuess(); /* v1.20 — clear the guess strip with the selection */
  }, []);
  useImperativeHandle(ref, () => ({ celebrate, endCelebrate }), [celebrate, endCelebrate]);

  const endStroke = (keepLineDuringFx: boolean) => {
    dragRef.current = false;
    wrapRef.current?.classList.remove("dragging");
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
    /* v1.20 — input NEVER dead (user: «یه لگ ریز داره وقتی حدس میزنی»):
     * during the 480ms celebration the wheel used to IGNORE touches —
     * an immediate next drag felt frozen. Now the fx force-ends and the
     * new stroke starts instantly (the pending word still lands). */
    if (lockRef.current) endCelebrate();
    const r = measure();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    const i = hitTile(lx, ly);
    if (i === null) return;
    if (!firstDragRef.current) { firstDragRef.current = true; onFirstDrag?.(); }
    dragRef.current = true;
    /* Y — promote the wheel to its OWN compositor layer for the whole
     * stroke (ribbon repaints stop invalidating the page = no more
     * drag jank on weak GPUs) */
    wrapRef.current?.classList.add("dragging");
    try { wrapRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    applySel([i]);
    const c = centersRef.current.find((c) => c.idx === i)!;
    tipCurRef.current = { x: c.x, y: c.y };
    prevPtRef.current = { x: c.x, y: c.y }; /* catch segments start from the pressed tile */
    tipTargetRef.current = { x: lx, y: ly };
    lastPtRef.current = { x: lx, y: ly };
    ensureRaf();
    Audio.sfxLetter(0);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const r = rectRef.current;
    if (!r) return;
    /* v7 — record the FULL coalesced trail (see trailRef); the rAF tick
     * catches along every sample — pointermove itself stays a cheap
     * recorder (zero React re-renders, zero layout reads). */
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

  const up = () => {
    if (!dragRef.current) return;
    /* v7 — flush the whole trail BEFORE judging the release (a fast
     * stroke that ended between two rAF ticks still registers every
     * seat it passed through) */
    const trail = trailRef.current;
    if (trail.length > 0) {
      for (const pt of trail) catchUpTo(pt);
      trail.length = 0;
    }
    catchUpTo(lastPtRef.current);
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
        {/* 3-layer juicy stroke: soft aura → gold core → bright shine
            (v1.21 — slightly fatter + softer for a silkier feel) */}
        <polyline ref={auraRef} points="" fill="none" stroke="rgba(255,187,56,.30)" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />
        <polyline ref={coreRef} points="" fill="none" stroke="#ffc93c" strokeWidth={11.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
        <polyline ref={shineRef} points="" fill="none" stroke="rgba(255,252,232,.9)" strokeWidth={3.8} strokeLinecap="round" strokeLinejoin="round" />
        {/* glowing bead riding under the finger (Wordscapes-style) */}
        <g ref={beadRef} opacity="0">
          <circle r={13} fill="rgba(255,220,110,.30)" />
          <circle r={6} fill="#fff6d8" stroke="#ffb302" strokeWidth="2" />
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

/* v1.21 — SHUFFLE ICON, redrawn as a crisp vector (user: «آیکون بر
 * زدن دقیق‌تر و یچی خوشگلتر بکن»): two curved arrows chasing each
 * other around the ring + a tiny sparkle, carved-wood gradient and a
 * white rim — pixel-perfect on every density, and it SPINS on press
 * (CSS .fab-shuffle:active svg). */
function ShuffleSvg() {
  return (
    <svg className="shuffle-svg" width="34" height="34" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="shfGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7dd" />
          <stop offset="0.55" stopColor="#ffd76e" />
          <stop offset="1" stopColor="#f0a92c" />
        </linearGradient>
      </defs>
      {/* soft halo behind the arrows */}
      <circle cx="24" cy="24" r="15.5" fill="rgba(255,236,170,.28)" />
      {/* two chasing arc arrows (top arc: cw → right, bottom arc: ccw → left) */}
      <g fill="none" stroke="url(#shfGold)" strokeWidth="4.6" strokeLinecap="round">
        <path d="M13.5 17.5 A 13.2 13.2 0 0 1 36.2 19.6" />
        <path d="M34.5 30.5 A 13.2 13.2 0 0 1 11.8 28.4" />
      </g>
      {/* arrowheads */}
      <path d="M36.9 12.9 L38 21.3 L29.9 19.4 Z" fill="#ffd76e" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11.1 35.1 L10 26.7 L18.1 28.6 Z" fill="#ffd76e" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      {/* center sparkle */}
      <path d="M24 19.4 L25.5 22.5 L28.6 24 L25.5 25.5 L24 28.6 L22.5 25.5 L19.4 24 L22.5 22.5 Z" fill="#fffdf4" stroke="#e8a52a" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

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
