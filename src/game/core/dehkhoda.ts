/* ------------------------------------------------------------------
 * dehkhoda.ts — v1.22 «لغت‌نامهٔ دهخدا» برای دورهمی
 * (user: «لغت نامه دهخدا وارد بکن اونجا تا هر جمله ایی ساختن تأیید
 *  بشه»)
 *
 * The party mode first checks its fast LOCAL dictionary (~۸٬۸۰۰
 * words). A word that misses locally is then verified against the
 * REAL Dehkhoda dictionary online (abadis.ir mirror) through
 * CORS-friendly proxies, so every built word gets an authoritative
 * verdict — «هر جمله‌ای ساختن تأیید بشه».
 *
 * DESIGN RULES (mobile reality):
 *  • best-effort: 5s timeout per attempt, two proxy routes;
 *  • ANY network failure → "offline" → the caller falls back to the
 *    local verdict (the game NEVER blocks on the network);
 *  • verdicts (yes AND no) are cached in localStorage so repeats are
 *    instant and data usage stays tiny;
 *  • Persian text is normalized (ي→ی, ك→ک, ZWNJ stripped) before
 *    lookup and cache-keying.
 * ------------------------------------------------------------------ */

export type DkResult = "yes" | "no" | "offline";

const CACHE_KEY = "vz_dehkhoda_v1";
const TIMEOUT_MS = 5000;

/* 1 = Dehkhoda knows it, 0 = Dehkhoda has no such entry */
type Verdict = 1 | 0;
let cache: Record<string, Verdict> | null = null;

function loadCache(): Record<string, Verdict> {
  if (cache) return cache;
  cache = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) cache = JSON.parse(raw) as Record<string, Verdict>;
  } catch { /* private mode / corrupted → empty cache */ }
  return cache!;
}

function storeCache(): void {
  try {
    /* keep the cache bounded — 4k entries is plenty for pass-and-play */
    const c = loadCache();
    const keys = Object.keys(c);
    if (keys.length > 4000) {
      for (const k of keys.slice(0, keys.length - 4000)) delete c[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* quota — ignore, cache stays memory-only */ }
}

/** normalize Persian orthography before lookup / caching */
export function dkNorm(w: string): string {
  return w
    .replace(/\u200c/g, "")   /* ZWNJ */
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/أ/g, "ا")
    .replace(/إ/g, "ا")
    .replace(/ؤ/g, "و")
    .trim();
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/* markers the Dehkhoda (abadis) result page uses when the entry is absent */
const NOT_FOUND_MARKERS = [
  "یافت نشد",
  "يافت نشد",
  "چنین مدخلی",
  "موردی یافت نشد",
  "موردي يافت نشد",
];

/**
 * Ask the real Dehkhoda dictionary about a word.
 * "yes"     → Dehkhoda has an entry for it
 * "no"      → Dehkhoda answered and has NO such entry
 * "offline" → the network check could not run — caller falls back
 */
export async function dehkhodaLookup(rawWord: string): Promise<DkResult> {
  const w = dkNorm(rawWord);
  if (Array.from(w).length < 2) return "no";

  const c = loadCache();
  if (w in c) return c[w] === 1 ? "yes" : "no";

  const enc = encodeURIComponent(w);
  const targets = [
    `https://dictionary.abadis.ir/?f2=dehkhoda&word=${enc}`,
    `https://dictionary.abadis.ir/Dictionary.aspx?f2=dehkhoda&word=${enc}`,
  ];
  const proxies: ((u: string) => string)[] = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];

  for (const target of targets) {
    for (const px of proxies) {
      const body = await fetchText(px(target));
      if (body == null || body.length < 400) continue; /* route dead → next */
      const notFound = NOT_FOUND_MARKERS.some((m) => body.includes(m));
      const verdict: Verdict = notFound ? 0 : 1;
      c[w] = verdict;
      storeCache();
      return verdict === 1 ? "yes" : "no";
    }
  }
  return "offline";
}
