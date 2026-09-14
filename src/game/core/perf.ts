/* ------------------------------------------------------------------
 *  واژه‌سفر — core/perf.ts  (v3)
 *  FPS GUARD + automatic LOW-POWER mode
 *  (user: «بازی ب شدت کند و لگ داره … گوشی داغ میکنه … یک دیباگ قوی بکن»)
 *
 *  Weak phones get an automatic degraded-effects tier:
 *   • the first ~2.5 s after boot we count "slow frames" (>34 ms);
 *   • if more than 25 % of frames were slow → <html class="lowfx"> is
 *     set ONCE and stays for the session;
 *   • game.css ships a .lowfx block that disables every remaining
 *     decorative animation (floats, pulses, sheens) and trims FX
 *     particle counts via `display:none` on extras.
 *  Compositor-only core gameplay (drag/wheel/board) is untouched —
 *  the guard only sheds NON-essential work.
 * ------------------------------------------------------------------ */

let started = false;

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

/**
 * Watch the first frames after boot; flip to low-power on slow devices.
 * Fire-and-forget; safe to call multiple times (only the first wins).
 */
export function startFpsGuard(): void {
  if (started || typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
  started = true;

  /* instant heuristic: very little RAM → degrade immediately, no wait */
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 2) {
    enableLowFx();
    return;
  }

  let last = performance.now();
  let total = 0;
  let slow = 0;
  const SAMPLE = 150; /* ~2.5 s at 60 fps */
  const tick = (t: number) => {
    const dt = t - last;
    last = t;
    total++;
    if (dt > 34) slow++; /* frame took longer than ~30 fps budget */
    if (total < SAMPLE) {
      requestAnimationFrame(tick);
    } else if (slow > total * 0.25) {
      enableLowFx();
    }
  };
  requestAnimationFrame(tick);
}
