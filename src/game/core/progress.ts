/* ------------------------------------------------------------------
 *  واژه‌سفر — core/progress.ts   (v1.20, session U)
 *  IN-LEVEL progress persistence — the «وسط بازی بیام بیرون، دوباره
 *  برگردم تا همون‌جا باشم» fix.
 *
 *  The old memory-only Map survived a SHOP round-trip but died the
 *  moment the app process was closed/reloaded → the player re-entered
 *  the level and every guessed word was gone. This module keeps the
 *  live snapshot in memory AND mirrors it to localStorage immediately
 *  (the payload is tiny — a few hundred bytes per level), so progress
 *  survives app restarts, tab reloads and long absences.
 *
 *  Contract used by PlayScreen / GameApp:
 *   • getProgress(key)               → live snapshot or null
 *   • setProgress(key, snapshot)     → called on unmount / milestones
 *   • clearProgress(key)             → level won, or restart pressed
 *   • hasProgress(key)               → shop-return routing decision
 * ------------------------------------------------------------------ */

export interface LevelProgress {
  found: string[];
  revealed: string[]; // "word#idx"
  mistakes: number;
  earned: { words: number; bonus: number };
}

const MEM = new Map<string, LevelProgress>();
const LS_KEY = "vz_progress_v1";
const MAX_KEYS = 160; // 110 levels + headroom — each entry is tiny

let disk: Record<string, LevelProgress> | null = null;

function loadDisk(): Record<string, LevelProgress> {
  if (disk) return disk;
  disk = {};
  if (typeof localStorage === "undefined") return disk;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, LevelProgress>;
      if (parsed && typeof parsed === "object") disk = parsed;
    }
  } catch {
    disk = {};
  }
  return disk;
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function flushDisk(): void {
  if (typeof localStorage === "undefined" || !disk) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(disk));
  } catch {
    /* quota / private mode — memory copy still serves this session */
  }
}
function scheduleFlush(): void {
  if (writeTimer != null) return;
  writeTimer = setTimeout(() => { writeTimer = null; flushDisk(); }, 400);
}
/* never lose in-level progress: hard flush when the app hides/closes */
if (typeof window !== "undefined") {
  const onHide = () => { if (document.hidden) flushDisk(); };
  window.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flushDisk);
  window.addEventListener("beforeunload", flushDisk);
}

function sanitize(p: unknown): LevelProgress | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Partial<LevelProgress>;
  if (!Array.isArray(o.found) || !Array.isArray(o.revealed)) return null;
  return {
    found: o.found.filter((w) => typeof w === "string"),
    revealed: o.revealed.filter((w) => typeof w === "string"),
    mistakes: typeof o.mistakes === "number" ? o.mistakes : 0,
    earned: {
      words: typeof o.earned?.words === "number" ? o.earned.words : 0,
      bonus: typeof o.earned?.bonus === "number" ? o.earned.bonus : 0,
    },
  };
}

export function getProgress(key: string): LevelProgress | null {
  const m = MEM.get(key);
  if (m) return m;
  const d = sanitize(loadDisk()[key]);
  if (d) MEM.set(key, d); /* promote to memory for the session */
  return d;
}

export function hasProgress(key: string): boolean {
  return getProgress(key) != null;
}

export function setProgress(key: string, p: LevelProgress): void {
  MEM.set(key, p);
  const d = loadDisk();
  d[key] = p;
  /* keep storage bounded: drop the OLDEST entries beyond the cap */
  const keys = Object.keys(d);
  if (keys.length > MAX_KEYS) {
    for (const k of keys.slice(0, keys.length - MAX_KEYS)) delete d[k];
  }
  scheduleFlush();
}

export function clearProgress(key: string): void {
  if (MEM.delete(key)) scheduleFlush();
  const d = loadDisk();
  if (d[key] !== undefined) {
    delete d[key];
    scheduleFlush();
  }
}

/** wipe everything (Save.reset / full profile reset) */
export function clearAllProgress(): void {
  MEM.clear();
  disk = {};
  flushDisk();
}

/** called by GameApp when the app returns from background — the 400ms
 *  debounce may not have elapsed before Android froze the webview */
export function flushProgress(): void {
  if (writeTimer != null) { clearTimeout(writeTimer); writeTimer = null; }
  flushDisk();
}
