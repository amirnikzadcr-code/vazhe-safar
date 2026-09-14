/* ------------------------------------------------------------------
 *  واژه‌سفر — scripts/gen_levels.ts
 *  Regenerates all 100 levels (10 chapters × 10) from a curated
 *  real-Persian dictionary. Every target/bonus word is validated:
 *   • buildable from the level's wheel letters (multiset)
 *   • crossword layout must be compact & validated by the SAME
 *     generator used at runtime (src/game/crossword.ts)
 *  HARD RULES (user demand):
 *   • NO main word may ever repeat across the whole game (100 levels)
 *   • progressive difficulty: word count + wheel size ramp ch1 → ch10
 *  Also emits src/game/data/dictionary.ts used at runtime so any
 *  real dictionary word assembled from the wheel counts as bonus.
 *  Run: bun scripts/gen_levels.ts
 * ------------------------------------------------------------------ */
import { letters, canBuild, rng, shuffle } from "../src/game/core/utils";
import { makeCrossword } from "../src/game/crossword";
import { writeFileSync, mkdirSync, readFileSync } from "fs";

/* ==================================================================
 *  Curated dictionary — common, real Persian words (2..7 letters).
 *  Persian ی (U+06CC) / ک (U+06A9); no ZWNJ, no spaces, no diacritics.
 * ================================================================== */
/* ---- normalize + validate (moved to dict_source.ts, session O) ---- */
import { DICT } from "./dict_source";


/* chapter word-theme hints (anchors preferred from these when possible) */
const THEME: Record<number, string[]> = {
  1: ["باغ", "گل", "لاله", "نرگس", "یاس", "بنفشه", "شکوفه", "بهار", "سبزه", "پروانه", "بلبل", "آفتاب", "چشمه", "بوستان", "قطره", "غنچه", "گلزار", "نسیم", "چمن", "علف"],
  2: ["بازار", "چراغ", "قالی", "فرش", "کاشی", "سکه", "طلا", "نقره", "فانوس", "زرگر", "بقال", "نانوا", "تابلو", "گلیم", "ترمه", "کوزه", "سکه", "بازار"],
  3: ["کویر", "نخل", "کاروان", "شتر", "غروب", "ماه", "ستاره", "آفتاب", "گرما", "چادر", "خیمه", "ریگ", "تپه", "غار", "صحرا", "دشت"],
  4: ["جنگل", "درخت", "باران", "برگ", "ریشه", "سرو", "چنار", "بید", "شبنم", "پروانه", "سهره", "آبشار", "بیشه", "بلوط", "خزه"],
  5: ["کوه", "قلعه", "برج", "دماوند", "الوند", "سبلان", "زاگرس", "برف", "عقاب", "سپاه", "شمال", "سرد", "پلکان", "دژ", "قله"],
  6: ["باد", "خانه", "حمام", "آبگرم", "گل", "سفال", "کوزه", "آجر", "شهر", "کوچه", "سایه", "دیوار", "بادگیر", "گرمابه", "خشت"],
  7: ["دریا", "ساحل", "موج", "کشتی", "قایق", "لنج", "بادبان", "پارو", "لنگر", "ماهی", "مرجان", "صدف", "خزر", "بندر", "نهنگ", "دلفین", "مروارید"],
  8: ["روستا", "پلکان", "خانه", "کوه", "چراغ", "پنجره", "شب", "ستاره", "مهتاب", "چنار", "گردو", "سیب", "خرما", "برکه", "دهقان"],
  9: ["ستاره", "مهتاب", "کهکشان", "شهاب", "سکوت", "آسمان", "تلسکوپ", "کیهان", "شب", "سحر", "شفق", "خیال", "ماه", "سیاره", "رصد"],
  10: ["جشن", "شادی", "آتش", "نوروز", "یلدا", "انار", "هندوانه", "شعر", "غزل", "موسیقی", "ترانه", "رقص", "گل", "لاله", "بادام", "گردو", "آواز"],
  /* hard tier themes (session O) */
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

/* ---- difficulty ramp: ch1 easy → ch10 hard → ch11-20 VERY hard ---- */
function wheelLenFor(i: number): number {
  const ch = Math.floor(i / 10) + 1;             // 1..20
  const pos = i % 10;                             // 0..9 within chapter
  const base = [4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8][ch - 1];
  // +1 wheel letter in the last third of a chapter (capped at 8)
  return pos >= 7 && base < 8 ? base + 1 : base;
}
function wantWordsFor(i: number): number {
  const ch = Math.floor(i / 10) + 1;
  const pos = i % 10;
  const base = [4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9][ch - 1];
  // in-chapter +1 ramp only for ch1-16 (late hard tier keeps pools healthy)
  // gentle in-chapter ramp: +1 word on the last third
  return pos >= 7 && ch <= 16 ? base + 1 : base;
}
/** min main-word length per chapter (2-letter fillers only in ch1-3, max 1) */
function minLenFor(ch: number): number {
  return ch <= 3 ? 2 : 3;
}

interface GenLevel { id: number; wheel: string; words: string[]; bonus: string[] }

const byLen = new Map<number, string[]>();
for (const w of DICT) {
  const L = w.length;
  if (!byLen.has(L)) byLen.set(L, []);
  byLen.get(L)!.push(w);
}
for (const [k, v] of byLen) v.sort();

/** all dictionary words buildable from a letter multiset */
function buildable(wheel: string): string[] {
  return DICT.filter((w) => canBuild(w, wheel));
}

/** count connected components of a layout grid */
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

/** ch01..ch10 stay EXACTLY as shipped (byte-identical files); only the
 *  hard tier ch11..ch20 is generated fresh. usedWords is seeded with
 *  every main word of ch1-10 so NO main word can ever repeat. */
function loadExisting(): GenLevel[] {
  const out: GenLevel[] = [];
  for (let ch = 1; ch <= 10; ch++) {
    const file = `src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
    const arr = JSON.parse(readFileSync(file, "utf8")) as GenLevel[];
    out.push(...arr);
  }
  return out;
}

function genHardTier(usedWords: Set<string>): GenLevel[] {
  const rand = rng(20260915);
  let decays = 0;

  /* v2.4 — generate the HIGHEST-DEMAND chapters FIRST (while the word
   * pool is at its richest) and let the lighter ones weave through the
   * leftovers; results are sorted by id at the end. Keeping sequential
   * order starved ch16-20 («بازی سخت باید سخت بماند»). */
  const ORDER = [17, 14, 11, 18, 15, 12, 19, 16, 13, 20];
  const byOrder: GenLevel[] = [];
  for (let pos = 0; pos < 10; pos++) {
    for (const ch of ORDER) {
    const i = (ch - 1) * 10 + pos;
    const id = i + 1;
    const prefWl = wheelLenFor(i);
    const prefWant = wantWordsFor(i);
    const minLen = minLenFor(ch);
    const theme = THEME[ch] ?? [];
    const hard = ch >= 11;

    let done: GenLevel | null = null;

    // adaptive difficulty decay: preferred (wheelLen, wordCount) first,
    // then relax step-by-step — never below 4 words / 4 letters.
    outer: for (const decay of [0, 1, 2, 3, 4]) {
      const wl = Math.max(hard ? 5 : 4, prefWl - decay);
      const want = Math.max(hard ? (decay >= 4 ? 5 : 6) : 4, prefWant - (decay >= 2 ? 1 : 0) - (decay >= 3 ? 1 : 0));
      const pool = byLen.get(wl) ?? [];
      if (process.env.DBG_ID && Number(process.env.DBG_ID) === id)
        console.log(`[dbg ${id}] decay=${decay} wl=${wl} want=${want} pool=${pool.length} avail=${pool.filter((w) => !usedWords.has(w)).length}`);
      const themed = pool.filter((w) => theme.includes(w));
      const others = pool.filter((w) => !theme.includes(w));
      const scored = [...themed, ...others]
        .filter((w) => !usedWords.has(w))
        .map((a) => ({ a, rich: buildable(a).filter((w) => !usedWords.has(w) && w.length >= minLen).length }))
        .sort((x, y) => y.rich - x.rich);
      /* final decay: widen the net to every remaining anchor */
      const topPool = scored.slice(0, decay >= 4 ? scored.length : Math.max(12, Math.ceil(scored.length * 0.6)));
      /* v2.4 BEST-FIRST candidates: try the richest anchors before the
       * poorer ones (shuffled within equal richness). The old pure
       * shuffle burned high-rich anchors early and starved ch19-20. */
      const candidates: string[] = [];
      for (const r of [...new Set(topPool.map((s) => s.rich))].sort((a, b) => b - a)) {
        candidates.push(...shuffle(topPool.filter((s) => s.rich === r).map((s) => s.a), rand));
      }

      for (const anchor of candidates) {
        if (usedWords.has(anchor)) continue;
        const rich = buildable(anchor).filter((w) => !usedWords.has(w) && w.length >= minLen);
        if (process.env.DBG_ID && Number(process.env.DBG_ID) === id && decay >= 2) {
          const r2 = buildable(anchor).filter((w) => !usedWords.has(w) && w.length >= minLen);
          if (candidates.indexOf(anchor) < 6) console.log(`[dbg ${id}] d=${decay} anchor=${anchor} rich=${r2.length}`);
        }
        const sortedT = [...rich.filter((w) => w !== anchor)].sort((a, b) => b.length - a.length);
        if (sortedT.length < 3) continue;

        // diverse targets: 1 long, 1 mid, optional short (ch<=3), then fill
        const picked: string[] = [];
        const longs = sortedT.filter((w) => w.length >= 4);
        if (longs.length) picked.push(longs[Math.floor(rand() * Math.min(3, longs.length))]);
        const mids = sortedT.filter((w) => w.length === 3);
        if (mids.length) picked.push(mids[Math.floor(rand() * mids.length)]);
        if (minLen === 2) {
          const shorts = sortedT.filter((w) => w.length === 2);
          if (shorts.length && rand() < 0.8)
            picked.push(shorts[Math.floor(rand() * shorts.length)]);
        }
        for (const w of shuffle(sortedT, rand)) {
          if (picked.length >= Math.max(3, want - 1)) break;
          if (!picked.includes(w)) picked.push(w);
        }

        // richest word-count first, then shrink (crossword gets easier)
        for (const n of [want - 1, want - 2, want - 3, 4]) {
          const t = Math.min(n, picked.length);
          if (t < 3) continue;
          const words = [anchor, ...picked.slice(0, t)];
          if (new Set(words).size !== words.length) continue;
          if (process.env.DBG_ID && Number(process.env.DBG_ID) === id && decay >= 3 && candidates.indexOf(anchor) < 4)
            console.log(`[dbg ${id}] try ${words.join(' ')}`);
          // MUST succeed with the exact runtime seed so the board is
          // guaranteed reproducible in the game (same makeCrossword code)
          const layout = makeCrossword(words, id * 100 + ch);
          if (!layout) continue;
          const cells = layout.grid.flat().filter(Boolean).length;
          const area = layout.rows * layout.cols;
          const islands = countIslands(layout.grid);
          /* hard tier: roomy boards (big wheels, many words). The runtime
           * board renders words as SEPARATE rows, so the crossword-grid
           * aesthetics only need loose sanity bounds here. */
          const areaFactor = hard ? (words.length >= 8 ? 3.0 : 2.8) : (words.length >= 6 ? 2.4 : 2.25);
          const maxGrid = hard ? 10 : 8;
          if (islands > (hard ? 3 : 2) || area > cells * areaFactor || layout.cols > maxGrid || layout.rows > maxGrid) continue;
          if (layout.cols < 3) continue;
          const bonus = buildable(anchor)
            .filter((w) => !words.includes(w) && !usedWords.has(w))
            .sort();
          done = { id, wheel: anchor, words, bonus };
          words.forEach((w) => usedWords.add(w));
          if (decay > 0 || words.length < prefWant) decays++;
          break outer;
        }
      }
    }

    if (!done) throw new Error(`could not generate level ${id} (pref wheel ${prefWl})`);
    byOrder.push(done);
    }
  }
  const ordered = byOrder.slice().sort((a, b) => a.id - b.id);
  console.log(`decays used: ${decays}`);
  return ordered;
}

/* ---------------- emit ---------------- */
const existing = loadExisting();
const hardLevels = genHardTier(new Set(existing.flatMap((l) => l.words)));
const levels = [...existing, ...hardLevels];

/* HARD assertion: zero duplicated main words across all 200 levels */
{
  const freq = new Map<string, number>();
  for (const l of levels) for (const w of l.words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const dups = [...freq.entries()].filter(([, n]) => n > 1);
  if (dups.length) {
    console.error("DUPLICATED MAIN WORDS:", dups.sort((a, b) => b[1] - a[1]).slice(0, 30));
    throw new Error(`no-repeat violated: ${dups.length} duplicated words`);
  }
  const totalSlots = levels.reduce((s, l) => s + l.words.length, 0);
  console.log(`no-repeat OK — ${totalSlots} main-word slots, ${freq.size} unique`);
}

mkdirSync("src/game/data/levels", { recursive: true });
for (let ch = 11; ch <= 20; ch++) {
  const chunk = levels.filter((l) => l.id > (ch - 1) * 10 && l.id <= ch * 10);
  const file = `src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
  writeFileSync(file, JSON.stringify(chunk, null, 1) + "\n");
  const avgW = (chunk.reduce((s, l) => s + l.words.length, 0) / chunk.length).toFixed(1);
  const avgLen = (chunk.reduce((s, l) => s + l.wheel.length, 0) / chunk.length).toFixed(1);
  console.log(`ch${String(ch).padStart(2, "0")}: ${chunk.length} levels, avg words ${avgW}, avg wheel ${avgLen}`);
}

const dictTs = `/* ------------------------------------------------------------------
 *  واژه‌سفر — data/dictionary.ts (AUTO-GENERATED by scripts/gen_levels.ts)
 *  Real Persian words used for bonus-word validation at runtime.
 * ------------------------------------------------------------------ */
export const DICT_WORDS: string[] = [
${chunkArray(DICT, 12).map((row) => "  " + row.map((w) => `"${w}"`).join(", ")).join(",\n")},
];

export const DICT: Set<string> = new Set(DICT_WORDS);
`;
writeFileSync("src/game/data/dictionary.ts", dictTs);

function chunkArray<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

console.log(`\nDONE — ${levels.length} levels (100 shipped + ${hardLevels.length} new hard), dictionary ${DICT.length} words`);
