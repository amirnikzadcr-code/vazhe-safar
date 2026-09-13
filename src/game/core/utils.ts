/* ------------------------------------------------------------------
 *  واژه‌سفر — Safar-e Vazhe  |  core/utils.ts
 *  Small utilities: DOM builder, seeded RNG, Persian helpers, math.
 * ------------------------------------------------------------------ */

/** DOM element builder — concise hyperscript helper */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | (() => void)> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (typeof v === "function") {
      (el as unknown as Record<string, () => void>)["on" + k] = v;
    } else if (k === "class") el.className = String(v);
    else if (k === "text") el.textContent = String(v);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

/** Deterministic 32-bit seeded RNG (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Convert Latin digits in a string/number to Persian digits */
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export function faNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** Split a word into letters (Persian letters are single BMP code points) */
export function letters(word: string): string[] {
  return Array.from(word.trim());
}

/** Multiset containment: can "word" be built from "pool" letters? */
export function canBuild(word: string, pool: string): boolean {
  const poolLetters = letters(pool);
  for (const ch of letters(word)) {
    const idx = poolLetters.indexOf(ch);
    if (idx === -1) return false;
    poolLetters.splice(idx, 1);
  }
  return true;
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** await next animation frame(s) */
export function nextFrames(n = 1): Promise<void> {
  return new Promise((r) => {
    const step = (left: number) =>
      left <= 0 ? r() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });
}

/** Haptic feedback (silently ignored when unsupported / disabled) */
export function buzz(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch { /* noop */ }
}

/** compact global event bus */
type Handler = (payload?: unknown) => void;
export class Bus {
  private map = new Map<string, Set<Handler>>();
  on(evt: string, fn: Handler): () => void {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt)!.add(fn);
    return () => this.map.get(evt)?.delete(fn);
  }
  emit(evt: string, payload?: unknown): void {
    this.map.get(evt)?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error("[bus]", evt, e); }
    });
  }
  clear(): void { this.map.clear(); }
}
