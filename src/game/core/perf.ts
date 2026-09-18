/* ------------------------------------------------------------------
 * واژه‌سفر — core/perf.ts  (v6 — «همون روانیِ نسخهٔ وب، روی موبایل»)
 * FPS GUARD + automatic LOW-POWER mode — as a SAFETY NET, not a wall.
 *
 * WHY v6? (user: «هر انیمیشنی و روانی که توی نسخه وب هست، روی موبایل
 * هم اعمال کن و بهینه باشه» + «تا مطمئن نشدی روی موبایل روان و نرم
 * نیست و انیمیشن‌ها درست کار نمی‌کنند دست از تلاش برنمیداری»)
 *
 * v5 forced the whole .lowfx shed-list on EVERY native APK — web kept
 * the full animated tier. Same phone, two different games: the browser
 * felt alive, the APK felt stripped/dead and the user kept reporting
 * the mismatch (map indicator static, page transitions gutted, home
 * ambience gone, win screen bare). The WebView on the very same phone
 * clearly keeps up with the browser — so the blanket shed was paying
 * cost in EXPerience without buying smoothness.
 *
 * v6 rules:
 *   1. FULL TIER EVERYWHERE — native APK and browsers run the exact
 *      same animations (web parity, user's explicit ask).
 *   2. REAL FPS PROBES as the safety net — the 150-frame boot probe
 *      (during the splash) plus 6× 150-frame gameplay probes sample
 *      ACTUAL frame times on EVERY platform now (v5 skipped them on
 *      native). If >25% of frames miss the ~30fps budget, lowfx turns
 *      on automatically for that session and the game never fights a
 *      genuinely weak device.
 *   3. QA overrides: ?lowfx=1 previews the shed tier, ?nofpsguard=1
 *      disables the probes (deterministic screenshots).
 *
 * lowfx still sheds ONLY decorative work — core gameplay rendering
 * stays untouched. See game.css `.lowfx` blocks.
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
    try { console.info("[perf] low-power mode enabled (fps guard)"); } catch { /* noop */ }
  }
}

function qaFlag(name: string): boolean {
  try { return new URLSearchParams(window.location.search).has(name); } catch { return false; }
}

/* eager self-init: perf.ts is imported by GameApp at module scope.
 * v6 — nobody is degraded at boot anymore; every platform starts at
 * the full animated tier and earns its keep through the probes. */
if (typeof document !== "undefined") {
  if (qaFlag("lowfx")) {
    enableLowFx();
    try { console.info("[perf] lowfx forced at boot (qa override)"); } catch { /* noop */ }
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
  /* fires the shed-list only when the device REALLY struggles:
   * >25% of sampled frames missed the 30fps budget */
  if (r.slow > r.total * 0.25) enableLowFx();
};

/**
 * v6 — the guard runs on EVERY platform (native included): the boot
 * probe samples the splash frames; gameplay probes re-check inside
 * real levels. One bad splash (cold decode) doesn't convict the phone:
 * the first probe result is advisory, sustained slowness is not.
 */
export function startFpsGuard(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (qaFlag("nofpsguard")) return;
  if (isLowFx()) return; /* qa-forced shed tier — nothing to learn */

  let native = false;
  try { native = Capacitor.isNativePlatform(); } catch { /* core not ready */ }

  /* boot probe — the splash is quiet, so this mostly measures the
   * device's base rendering budget */
  runProbe(150, (r) => {
    /* first evidence: require a HARD miss (>40%) on the quiet splash
     * to degrade immediately; gameplay probes use the 25% bar */
    if (r.slow > r.total * 0.4) enableLowFx();
  });

  /* gameplay probes are armed by PlayScreen/MapScreen via
   * armGameplayProbe() — 6 windows over the session, 25% bar */
  if (native) {
    /* WebView cold start can stutter once (JIT/disk); give the first
     * minutes the benefit of the doubt by arming from the first level,
     * which armGameplayProbe already does */
  }
}

/**
 * Gameplay probe — v6 runs on ALL platforms (v5 skipped native, which
 * left the shed-list permanently OFF-or-ON with no evidence). Capped
 * at 6 windows per session; each window starts 60ms after arm so the
 * mount frame itself isn't measured.
 */
export function armGameplayProbe(): void {
  if (typeof window === "undefined") return;
  if (isLowFx()) return;              /* already degraded — nothing to learn */
  if (qaFlag("nofpsguard")) return;
  if (gameplayArms >= 6) return;
  gameplayArms += 1;
  setTimeout(() => runProbe(150, onProbe), 60);
}
