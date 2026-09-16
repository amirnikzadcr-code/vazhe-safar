/* Validate all 100 levels: letters ⊆ wheel, no dupes, crossword solvable. Run: bun scripts/validate_words.ts */
import { letters, canBuild, rng, shuffle } from "../src/game/core/utils";
import { makeCrossword } from "../src/game/crossword";

const CH = 20;
let errors = 0, warnings = 0;

/** chapter size — MUST match src/game/data/levelsIndex.lvPerCh */
const lvPerCh = (ch: number) => (ch >= 11 ? 12 : 10);
const levelsBefore = (ch: number) => {
  let n = 0;
  for (let c = 1; c < ch; c++) n += lvPerCh(c);
  return n;
};

for (let ch = 1; ch <= CH; ch++) {
  const file = `../src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
  const levels: { id: number; wheel: string; words: string[]; bonus: string[] }[] = (await import(file)).default;
  const LV = lvPerCh(ch);
  if (levels.length !== LV) { console.log(`✗ ch${ch}: expected ${LV} levels, got ${levels.length}`); errors++; }

  for (const lv of levels) {
    const tag = `ch${ch} lv${lv.id}`;
    // id continuity — ONE global number across the whole journey
    const expectedId = levelsBefore(ch) + (levels.indexOf(lv) + 1);
    if (lv.id !== expectedId) { console.log(`✗ ${tag}: id ${lv.id} ≠ expected ${expectedId}`); errors++; }
    // duplicate letters in the wheel are allowed (shown as separate buttons)
    const wheelLs = letters(lv.wheel);
    if (wheelLs.length < 3) { console.log(`✗ ${tag}: wheel too short`); errors++; }
    // longest word should use all wheel letters (classic word-cookies rule)
    const longest = lv.words.reduce((a, b) => (b.length > a.length ? b : a), "");
    if (letters(longest).length !== wheelLs.length) {
      console.log(`⚠ ${tag}: longest word "${longest}" (${longest.length}) ≠ wheel "${lv.wheel}" (${wheelLs.length})`);
      warnings++;
    }
    // all words buildable + no dupes
    const seen = new Set<string>();
    for (const w of [...lv.words, ...lv.bonus]) {
      if (seen.has(w)) { console.log(`✗ ${tag}: duplicate word "${w}"`); errors++; }
      seen.add(w);
      if (!canBuild(w, lv.wheel)) { console.log(`✗ ${tag}: word "${w}" NOT buildable from "${lv.wheel}"`); errors++; }
      if (Array.from(w).length < 2) { console.log(`✗ ${tag}: word "${w}" too short`); errors++; }
    }
    // main words count
    if (lv.words.length < 2) { console.log(`✗ ${tag}: only ${lv.words.length} main words`); errors++; }
    // crossword solvability (deterministic, same code as runtime)
    const t0 = Date.now();
    const layout = makeCrossword(lv.words, lv.id * 100 + ch);
    const ms = Date.now() - t0;
    if (!layout) { console.log(`✗ ${tag}: crossword layout FAILED`); errors++; continue; }
    const cells = layout.grid.flat().filter(Boolean).length;
    const area = layout.rows * layout.cols;
    /* session O: thresholds match the generator — ch11-20 boards are
     * roomier (hard tier); the runtime board renders words as separate
     * rows, so grid density is an aesthetic bound only. */
    const hard = ch >= 11;
    /* session AA: session Z deliberately made ch1-3 EASY (2-3 word
     * levels like «باران/انار» → tiny cell counts, airy crosswords).
     * The runtime board renders one row per word, so density stays an
     * aesthetic bound — widen it for small early boards. */
    const easy = ch < 11 && lv.words.length <= 3;
    const areaFactor = hard ? 3.4 : (lv.words.length >= 6 ? 2.4 : (easy ? 2.7 : 2.25));
    if (area > cells * areaFactor) {
      console.log(`✗ ${tag}: scattered layout ${layout.cols}x${layout.rows} (area ${area} vs ${cells} cells)`);
      errors++;
    }
    if (ms > 1500) { console.log(`⚠ ${tag}: slow layout ${ms}ms`); warnings++; }
  }
}

// extra stress: try alternate seeds for any failures already counted; summary:
console.log(`\n=== validation done: ${errors} errors, ${warnings} warnings ===`);
if (errors > 0) process.exit(1);
