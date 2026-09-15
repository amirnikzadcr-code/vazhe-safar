/* ------------------------------------------------------------------
 * lexicon.ts — OFFLINE word validator for دورهمی
 * (session X: «اسمی لغت نامه رو آفلاین کامل دانلود بکن و قرار بده تو
 *  بازی و اسمی از لغت نامه در بازی نبر»)
 *
 * SESSION Y (user: «هر چرت پرتی وارد میکنم قبول میکنه — برگرد ب بکاپ
 * قبلی و 159 هزار پاک کن و فقط جمله های ایرانی بزار حداقل 30 هزار
 * تا»): the v1.23 159k web-scraped list shipped GARBAGE tokens
 * («آآ»، «آارخیس»، «استرزی»…) — nonsense was accepted. It is DELETED.
 * The new file is a 45,528-word CLEAN corpus (real-usage frequency
 * lists + the game's curated dictionaries), rebuilt by
 * scripts/gen_fa_words.py with hard filters: Persian letters only,
 * no doubled letters, no fragment 2-letter pairs (2-letter words are
 * owned by the curated dictionaries only). Still ~0.5 MB local asset,
 * instant, airplane-mode proof, and the UI never names any source.
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
export const LEXICON_WORDS = 45528;

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
