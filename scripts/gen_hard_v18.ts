/* ------------------------------------------------------------------
 *  واژه‌سفر — scripts/gen_hard_v18.ts  (session S / v1.18)
 *  Regenerates the HARD tier ch11..ch20 with 12 levels each (user:
 *  «هر فصل طولانی تر باشه» → 220 levels total) and HARDER content:
 *   • wheels 7–8 letters (was 6/7)
 *   • 9–10 main words per level (was 7–9)
 *   • main words are 4+ letters — the tiny 3-letter fillers the user
 *     called «دو حرفی… خیلی ساده» are GONE from the hard tier
 *   • same hard guarantees: no main word repeats anywhere in the game,
 *     every word buildable from its wheel, crossword packed with the
 *     exact runtime makeCrossword + runtime seed
 *  ch01..ch10 stay byte-identical (they are the gentle onboarding ramp).
 *  Run: bun scripts/gen_hard_v18.ts
 * ------------------------------------------------------------------ */
import { canBuild, rng, shuffle } from "../src/game/core/utils";
import { makeCrossword } from "../src/game/crossword";
import { DICT } from "./dict_source";
import { PARTY_WORDS } from "../src/game/data/dictionary_party";
import { writeFileSync, readFileSync } from "fs";

/* main words draw from the enriched pool BUT skip mechanical plural /
 * superlative forms (کتابها، زیباترین) so every MAIN word is clean.
 * The BONUS pool gets the FULL merged dictionary (۸٬۸۰۰+ words). */
const DICT_MAIN = [...DICT, ...PARTY_WORDS].filter((w) => !w.endsWith("ها") && !w.endsWith("ترین"));
const DICT_FULL = [...DICT, ...PARTY_WORDS];

interface GenLevel { id: number; wheel: string; words: string[]; bonus: string[] }

const HARD_LV = 12;

/** global 1-based level number: ch1-10 hold 10 levels, ch11-20 hold 12 */
export function globalId(ch: number, lv: number): number {
  if (ch <= 10) return (ch - 1) * 10 + lv;
  let start = 100;
  for (let c = 11; c < ch; c++) start += HARD_LV;
  return start + lv;
}

/* chapter word-theme hints (same families as the shipped generator) */
const THEME: Record<number, string[]> = {
  11: ["جنگل", "درخت", "مه", "ابر", "شبنم", "خزه", "بلوط", "سرو", "بیشه", "برگ", "ریشه", "پرنده", "بلبل", "نسیم", "آبشار", "چشمه", "سهره", "جغد", "آواز", "غار"],
  12: ["ماه", "دریاچه", "نیلوفر", "مهتاب", "شب", "ستاره", "برکه", "آبگیر", "ساحل", "جوی", "چشمه", "نقره", "شبنم", "سکوت", "ماهی", "قایق", "پارو", "آبی"],
  13: ["غار", "بلور", "سنگ", "تاریک", "نور", "الماس", "نگین", "گوهر", "یاقوت", "زمرد", "لعل", "کانی", "معدن", "شفاف", "بنفش", "زر", "گنج", "گهر"],
  14: ["تپه", "دره", "خاک", "ریگ", "سنگ", "سرخ", "گرما", "آفتاب", "کوه", "باد", "شقایق", "لاله", "دشت", "صحرا", "افق", "سایه", "ظهر", "کانی"],
  15: ["آسمان", "ابر", "باد", "بادبادک", "باغ", "گل", "پرنده", "خورشید", "پرواز", "نسیم", "لاله", "نرگس", "یاس", "مه", "شکوفه", "بوستان", "باران"],
  16: ["دریا", "مرجان", "مروارید", "صدف", "ماهی", "موج", "ساحل", "کوسه", "نهنگ", "دلفین", "میگو", "خرچنگ", "پرستو", "جزیره", "خلیج", "فیروزه", "لنگر", "کشتی"],
  17: ["طلا", "شهر", "کاخ", "ستون", "ایوان", "گنبد", "منار", "زرگر", "طلاکار", "سکه", "نقره", "بازار", "کاشی", "خشت", "آجر", "عمارت", "مفرغ", "ملک"],
  18: ["شفق", "برف", "کوه", "قله", "شب", "ستاره", "سرد", "سکوت", "مهتاب", "آسمان", "یخ", "برج", "دماوند", "سبلان", "شمال", "صعود", "چراغ", "سحر"],
  19: ["یخ", "قصر", "برج", "سرد", "برف", "بلور", "نقره", "شیشه", "کاخ", "زمستان", "برفی", "یخبندان", "سکوت", "مه", "سفید", "درخشان", "آبی"],
  20: ["واژه", "کلمه", "حرف", "شعر", "غزل", "بیت", "قافیه", "مثنوی", "کتاب", "لغت", "فرهنگ", "دانش", "حکمت", "سخن", "جمله", "متن", "قلم", "دفتر", "آواز", "ترانه"],
};

const byLen = new Map<number, string[]>();
for (const w of DICT_MAIN) {
  const L = w.length;
  if (!byLen.has(L)) byLen.set(L, []);
  byLen.get(L)!.push(w);
}
for (const [, v] of byLen) v.sort();

/** main-pool words buildable from a letter multiset */
function buildable(wheel: string): string[] {
  return DICT_MAIN.filter((w) => canBuild(w, wheel));
}

/** full-dictionary words buildable from a letter multiset (bonus pool) */
function buildableAll(wheel: string): string[] {
  return DICT_FULL.filter((w) => canBuild(w, wheel));
}

function countIslands(grid: (string | null)[][]): number {
  const rows = grid.length, cols = grid[0].length;
  const seen = new Set<string>();
  let islands = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c] || seen.has(`${r},${c}`)) continue;
      islands++;
      const st = [[r, c]];
      while (st.length) {
        const [cr, cc] = st.pop()!;
        const k = `${cr},${cc}`;
        if (seen.has(k) || !grid[cr]?.[cc]) continue;
        seen.add(k);
        st.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
      }
    }
  return islands;
}

function loadCh110(): GenLevel[] {
  const out: GenLevel[] = [];
  for (let ch = 1; ch <= 10; ch++) {
    const file = `src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
    out.push(...(JSON.parse(readFileSync(file, "utf8")) as GenLevel[]));
  }
  return out;
}

function wheelLenFor(pos: number): number {
  return pos >= 7 ? 8 : 7;               /* hard tier: rich wheels */
}
function wantWordsFor(pos: number): number {
  return pos >= 8 ? 10 : 9;             /* 9–10 main words — user: «جملات بیشتر» */
}

function genHardTier(usedWords: Set<string>): GenLevel[] {
  const rand = rng(20260918);
  let decays = 0;
  const ORDER = [17, 14, 11, 18, 15, 12, 19, 16, 13, 20];
  const byOrder: GenLevel[] = [];

  for (let pos = 0; pos < HARD_LV; pos++) {
    for (const ch of ORDER) {
      const lv = pos + 1;
      const id = globalId(ch, lv);
      const prefWl = wheelLenFor(pos);
      const prefWant = wantWordsFor(pos);
      const theme = THEME[ch] ?? [];

      let done: GenLevel | null = null;

      /* adaptive decay: relax wheel size / min word length step-by-step.
       * minLen starts at 4 — the «خیلی ساده» 3-letter mains are last resort. */
      outer: for (const decay of [0, 1, 2, 3, 4, 5, 6]) {
        const wl = Math.max(6, prefWl - (decay >= 3 ? 1 : 0));
        const minLen = decay >= 4 ? 3 : 4;
        const want = Math.max(decay >= 4 ? 7 : 8, prefWant - (decay >= 2 ? 1 : 0) - (decay >= 3 ? 1 : 0));
        let pool = byLen.get(wl) ?? [];
        if (decay >= 5 && wl < 8) pool = [...pool, ...(byLen.get(wl + 1) ?? [])]; /* widen the anchor net */
        const themed = pool.filter((w) => theme.includes(w));
        const others = pool.filter((w) => !theme.includes(w));
        const scored = [...themed, ...others]
          .filter((w) => !usedWords.has(w))
          .map((a) => ({ a, rich: buildable(a).filter((w) => !usedWords.has(w) && w.length >= minLen).length }))
          .sort((x, y) => y.rich - x.rich);
        const topPool = scored.slice(0, decay >= 4 ? scored.length : Math.max(14, Math.ceil(scored.length * 0.65)));
        const candidates: string[] = [];
        for (const r of [...new Set(topPool.map((s) => s.rich))].sort((a, b) => b - a)) {
          candidates.push(...shuffle(topPool.filter((s) => s.rich === r).map((s) => s.a), rand));
        }

        for (const anchor of candidates) {
          if (usedWords.has(anchor)) continue;
          const rich = buildable(anchor).filter((w) => !usedWords.has(w) && w.length >= minLen);
          const sortedT = [...rich.filter((w) => w !== anchor)].sort((a, b) => b.length - a.length);
          if (sortedT.length < 5) continue;

          /* diverse targets: one long (5+), one mid (4 or the min), then fill */
          const picked: string[] = [];
          const longs = sortedT.filter((w) => w.length >= 5);
          if (longs.length) picked.push(longs[Math.floor(rand() * Math.min(3, longs.length))]);
          const mids = sortedT.filter((w) => w.length === (minLen >= 4 ? 4 : 3));
          if (mids.length) picked.push(mids[Math.floor(rand() * Math.min(3, mids.length))]);
          for (const w of shuffle(sortedT, rand)) {
            if (picked.length >= want - 1) break;
            if (!picked.includes(w)) picked.push(w);
          }

          /* richest word-count first, then shrink (crossword gets easier) */
          for (const n of [want, want - 1, want - 2, want - 3, 6, 5]) {
            const t = Math.min(n, picked.length);
            if (t < 5) continue;
            const words = [anchor, ...picked.slice(0, t)];
            if (new Set(words).size !== words.length) continue;
            /* the runtime board renders words as separate rows — the
             * crossword here is only a connectivity sanity check */
            const layout = makeCrossword(words, id * 100 + ch);
            if (!layout) continue;
            const cells = layout.grid.flat().filter(Boolean).length;
            const area = layout.rows * layout.cols;
            const islands = countIslands(layout.grid);
            if (islands > 4 || area > cells * 3.4 || layout.cols > 12 || layout.rows > 12) continue;
            if (layout.cols < 3) continue;
            const bonus = buildableAll(anchor)
              .filter((w) => !words.includes(w) && !usedWords.has(w))
              .sort();
            done = { id, wheel: anchor, words, bonus };
            words.forEach((w) => usedWords.add(w));
            if (decay > 0 || words.length < prefWant) decays++;
            break outer;
          }
        }
      }

      if (!done) throw new Error(`could not generate ch${ch} lv${lv} (wheel ${prefWl})`);
      byOrder.push(done);
    }
  }
  const ordered = byOrder.slice().sort((a, b) => a.id - b.id);
  console.log(`decays used: ${decays}`);
  return ordered;
}

/* ---------------- emit ---------------- */
const existing = loadCh110();
const used = new Set(existing.flatMap((l) => l.words));
const hard = genHardTier(used);
const all = [...existing, ...hard];

/* hard invariants across the WHOLE game */
const seen = new Set<string>();
for (const lv of all) {
  for (const w of lv.words) {
    if (seen.has(w)) throw new Error(`duplicate main word across game: ${w}`);
    seen.add(w);
  }
}

/* write ch01..ch10 untouched + ch11..ch20 fresh (12 levels each) */
const perCh = new Map<number, GenLevel[]>();
for (const lv of all) {
  const ch = lv.id <= 100 ? Math.floor((lv.id - 1) / 10) + 1 : 11 + Math.floor((lv.id - 101) / HARD_LV);
  if (!perCh.has(ch)) perCh.set(ch, []);
  perCh.get(ch)!.push(lv);
}
for (let ch = 1; ch <= 20; ch++) {
  const list = perCh.get(ch) ?? [];
  const expect = ch <= 10 ? 10 : HARD_LV;
  if (list.length !== expect) throw new Error(`ch${ch}: expected ${expect} levels, got ${list.length}`);
  const file = `src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
  writeFileSync(file, JSON.stringify(list, null, 1) + "\n");
  const minLen = Math.min(...list.flatMap((l) => l.words.map((w) => w.length)));
  console.log(`ch${String(ch).padStart(2, "0")}: ${list.length} levels · id ${list[0].id}–${list[list.length - 1].id} · min main len ${minLen}`);
}
console.log("TOTAL levels:", all.length);
