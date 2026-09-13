/* Validate all 100 levels: letters ⊆ wheel, no dupes, crossword solvable. Run: bun scripts/validate_words.ts */
import { letters, canBuild, rng, shuffle } from "../src/game/core/utils";
import { makeCrossword } from "../src/game/crossword";

const CH = 10, LV = 10;
let errors = 0, warnings = 0;

for (let ch = 1; ch <= CH; ch++) {
  const file = `../src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
  const levels: { id: number; wheel: string; words: string[]; bonus: string[] }[] = (await import(file)).default;
  if (levels.length !== LV) { console.log(`✗ ch${ch}: expected ${LV} levels, got ${levels.length}`); errors++; }

  for (const lv of levels) {
    const tag = `ch${ch} lv${lv.id}`;
    // id continuity
    if (lv.id !== (ch - 1) * 10 + ((lv.id - 1) % 10) + 1) { /* ids are 1..100 global */ }
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
    if (area > cells * 2.35) {
      console.log(`✗ ${tag}: scattered layout ${layout.cols}x${layout.rows} (area ${area} vs ${cells} cells)`);
      errors++;
    }
    if (ms > 1500) { console.log(`⚠ ${tag}: slow layout ${ms}ms`); warnings++; }
  }
}

// extra stress: try alternate seeds for any failures already counted; summary:
console.log(`\n=== validation done: ${errors} errors, ${warnings} warnings ===`);
if (errors > 0) process.exit(1);
