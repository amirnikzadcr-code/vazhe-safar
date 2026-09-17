/* ------------------------------------------------------------------
 *  واژه‌سفر — core/perf.ts  (v5 — "APK همیشه روان")
 *  FPS GUARD + automatic LOW-POWER mode
 *  (user v5: «توی موبایل apk خیلی کنده … ی راهی پیدا بکن خیلی خیلی
 *   روی موبایل بهینه کنی نرم روان»)
 *
 *  WHY v5? v4's static sniff could never fire inside the Android APK
 *  (WebViews report deviceMemory=8 and >=4 cores regardless of real
 *  hardware), so the whole .lowfx shed-list was effectively DEAD on
 *  the exact device the user plays on — every blur/shadow/particle
 *  layer ran at full strength inside the WebView and the game felt
 *  "افتضاح کنده".
 *
 *  v5 rules, in order:
 *   1. NATIVE (Capacitor APK) → lowfx IMMEDIATELY at module load.
 *      The WebView is a constrained environment: 1 rendering thread,
 *      shared GPU with the system, no devtools profilers. The dress
 *      (ambience/sun/clouds/petals, blur shadows, transition fades,
 *      confetti storms) is the first thing a weak phone pays for —
 *      so the APK always runs the shed-list and keeps gameplay at
 *      60fps. Smoothness beats decoration (user's explicit ask).
 *   2. Desktop / mobile-browser keeps the v4 behaviour: static sniff
 *      (tiny RAM/cores — user reported the browser build feels
 *      smooth, so phones in a real browser keep the full tier and
 *      rely on probes) plus the 150-frame splash probe and the 6×
 *      gameplay probes.
 *
 *  lowfx sheds ONLY decorative work — core gameplay rendering stays
 *  untouched. See game.css `.lowfx` blocks (v5 adds a harder tier-2).
 * ------------------------------------------------------------------ */
import { Capacitor } from "@capacitor/core";

let started = false;
let gameplayArms = 0;

export function isLowFx(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("lowfx");
}

export function enableLowFx(): void {
  if (typeof document === "undefined") return;
  if (!document.documentElement.classList.contains("lowfx")) {
    document.documentElement.classList.add("lowfx");
    try { console.info("[perf] low-power mode enabled"); } catch { /* noop */ }
  }
}

/* v5 — decide the tier BEFORE the first paint. Synchronous, safe to
 * call from module scope: Capacitor.isNativePlatform() reads a build
 *-time bridge flag (no async init needed). */
function decideTier(): "native" | "browser" {
  try {
    if (Capacitor.isNativePlatform()) return "native";
  } catch { /* core not ready — fall through to UA sniffing */ }
  return "browser";
}

/* eager self-init: perf.ts is imported by GameApp at module scope, so
 * this runs before the splash paints — the APK NEVER sees the heavy
 * tier at all. Browsers (desktop AND phone) keep the v4 probe path:
 * the user explicitly reported the web build feels smooth, so we do
 * not strip decoration there. */
if (typeof document !== "undefined") {
  /* QA override: ?lowfx=1 previews the APK tier in a plain browser */
  let qaLow = false;
  try { qaLow = new URLSearchParams(window.location.search).has("lowfx"); } catch { /* noop */ }
  if (decideTier() === "native" || qaLow) {
    enableLowFx();
    try { console.info("[perf] lowfx forced at boot:", qaLow ? "qa" : "native APK"); } catch { /* noop */ }
  }
}

interface ProbeResult { total: number; slow: number }

/**
 * Sample frames and return the ratio of slow frames (>34ms).
 * Runs `frames` rAF ticks; never schedules anything afterwards.
 */
function runProbe(frames: number, onDone: (r: ProbeResult) => void): void {
  if (typeof requestAnimationFrame !== "function") return;
  let last = performance.now();
  let total = 0;
  let slow = 0;
  const tick = (t: number) => {
    const dt = t - last;
    last = t;
    total++;
    if (dt > 34) slow++; /* frame missed the ~30fps budget */
    if (total < frames) requestAnimationFrame(tick);
    else onDone({ total, slow });
  };
  requestAnimationFrame(tick);
}

const onProbe = (r: ProbeResult) => {
  if (r.slow > r.total * 0.25) enableLowFx();
};

/**
 * Kept for API compatibility (GameApp calls it on boot). v5: native
 * and mobile-web were already degraded at module load; only a DESKTOP
 * browser runs the probes now.
 */
export function startFpsGuard(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (isLowFx()) return; /* already forced at boot — nothing to learn */
  runProbe(150, onProbe);
}

/**
 * Gameplay probe — desktop-only now (v5). Native/mobile already run
 * the shed-list, and the probe window itself costs frames there.
 */
export function armGameplayProbe(): void {
  if (typeof window === "undefined") return;
  if (isLowFx()) return;              /* already degraded — nothing to learn */
  if (gameplayArms >= 6) return;
  gameplayArms += 1;
  setTimeout(() => runProbe(150, onProbe), 60);
}
