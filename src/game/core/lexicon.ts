/* ------------------------------------------------------------------
 * lexicon.ts — OFFLINE word validator for دورهمی
 * (session X: «اسمی لغت نامه رو آفلاین کامل دانلود بکن و قرار بده تو
 *  بازی و اسمی از لغت نامه در بازی نبر»)
 *
 * v1.22 used a live ONLINE lookup (abadis/Dehkhoda through CORS
 * proxies) — slow on phones, dead without data, and it printed the
 * dictionary's NAME in the UI. The whole thing is gone.
 *
 * NOW: a 159,455-word Persian lexicon ships INSIDE the app
 * (public/assets/dict/fa_words.txt — ~1 MB, a local asset in the APK,
 * so validation is instant and works in airplane mode). It is merged
 * with the game's own curated dictionaries, normalized the same way
 * the wheel builds words (ZWNJ stripped, ي→ی, ك→ک…), and loaded once
 * lazily the first time a party word needs it. The UI never names any
 * source — just «در حال بررسی واژه…» / «واژه تأیید شد!».
 * ------------------------------------------------------------------ */
import { FULL_DICT } from "@/game/data/levelsIndex";

/** normalize Persian orthography (same rules the game's words use) */
export function normWord(w: string): string {
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

/* the big offline set — module-level, parsed ONCE per session */
let big: Set<string> | null = null;
let loading: Promise<void> | null = null;

/** word count of the shipped lexicon file (regenerate together with
 * public/assets/dict/fa_words.txt — used only for the friendly
 * «بیش از … واژه» claim on the setup card) */
export const LEXICON_WORDS = 159455;

async function loadLexicon(): Promise<void> {
  const set = new Set<string>(FULL_DICT);
  try {
    const r = await fetch("/assets/dict/fa_words.txt");
    if (r.ok) {
      const text = await r.text();
      for (const w of text.split("\n")) {
        const t = w.trim();
        if (t) set.add(t);
      }
    }
  } catch { /* asset missing (old bundle?) → the curated FULL_DICT
             * still answers — the game never blocks */ }
  big = set;
}

/** make sure the big lexicon is resident (no-op after the first call) */
export function ensureLexicon(): Promise<void> {
  if (big) return Promise.resolve();
  if (!loading) loading = loadLexicon();
  return loading;
}

/**
 * Offline verdict for a word built in دورهمی.
 * Instant for the curated game dictionary; the big file answers on the
 * first miss (local asset in the APK → a few ms, no network ever).
 */
export async function validateWord(rawWord: string): Promise<boolean> {
  const w = normWord(rawWord);
  if (Array.from(w).length < 2) return false;
  if (FULL_DICT.has(w)) return true;
  await ensureLexicon();
  return big ? big.has(w) : false;
}
