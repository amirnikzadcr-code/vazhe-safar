/* ------------------------------------------------------------------
 *  واژه‌سفر — core/perf.ts  (v4)
 *  FPS GUARD + automatic LOW-POWER mode
 *  (user: «توی موبایل همش لگه … یک دیباگ کامل بکن برای موبایل»)
 *
 *  WHY v4? The v3 probe ran only during the SPLASH — the splash is an
 *  idle screen, so even genuinely weak phones passed it and then
 *  lagged during real gameplay. Also `deviceMemory <= 2` almost never
 *  matches on Android (WebViews report 8 regardless of real RAM).
 *
 *  v4 gets weak phones into lowfx RELIABLY:
 *   • deviceMemory ≤ 4 → degrade immediately;
 *   • splash probe (150 frames) — kept, catches very slow boots;
 *   • GAMEPLAY probe (armGameplayProbe) — runs through the first level
 *     entries + interactions (where the real bottleneck lives) and
 *     flips lowfx if >30% of frames miss the 30fps budget;
 *   • re-armed after each navigation for the first few screens — a
 *     phone that stutters across screens gets degraded even if a
 *     single sample window happened to look OK.
 *
 *  lowfx sheds ONLY decorative work (floats, pulses, sheens, extra
 *  particles) — core gameplay rendering stays untouched.
 * ------------------------------------------------------------------ */

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

/* quick static sniff — cheap cores / old renderer → don't even wait
 * for a probe to fail before shedding decorative work */
function staticWeak(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 4) return true;
  if ((nav.hardwareConcurrency ?? 8) <= 3) return true;
  return false;
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
 * Watch the first frames after boot; flip to low-power on slow devices.
 * Fire-and-forget; safe to call multiple times (only the first wins).
 */
export function startFpsGuard(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (staticWeak()) { enableLowFx(); return; }
  runProbe(150, onProbe);
}

/**
 * v4 — probe DURING REAL GAMEPLAY. PlayScreen calls this on mount for
 * the first few sessions' screens; the window intentionally covers the
 * heaviest moments (board + wheel + FX + audio all live at once).
 * Armed up to 6 times per session; each arm samples ~2.5s.
 */
export function armGameplayProbe(): void {
  if (typeof window === "undefined") return;
  if (isLowFx()) return;              /* already degraded — nothing to learn */
  if (gameplayArms >= 6) return;
  gameplayArms += 1;
  /* slight delay so the mount itself (layout+paint of the screen) is
   * inside the window — that IS the cost phones feel */
  setTimeout(() => runProbe(150, onProbe), 60);
}
