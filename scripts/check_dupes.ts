/* Scan all 100 levels for duplicate words:
 *  1. duplicates INSIDE a level (wheel words + bonus)
 *  2. the same main word appearing in SEVERAL levels (game-wide repeats)
 * Run: bun scripts/check_dupes.ts
 */
import { LEVELS } from "../src/game/data/levelsIndex";

let problems = 0;

for (const ch of LEVELS) {
  for (const lv of ch) {
    const main = lv.words;
    const dupInMain = main.filter((w, i) => main.indexOf(w) !== i);
    const dupBonus = lv.bonus.filter((w, i) => lv.bonus.indexOf(w) !== i);
    const overlap = main.filter((w) => lv.bonus.includes(w));
    if (dupInMain.length || dupBonus.length || overlap.length) {
      problems++;
      console.log(`L${lv.id}: main-dup=[${dupInMain}] bonus-dup=[${dupBonus}] overlap=[${overlap}]`);
    }
  }
}

/* game-wide: word → level ids */
const seen = new Map<string, number[]>();
for (const ch of LEVELS) {
  for (const lv of ch) {
    for (const w of lv.words) {
      const arr = seen.get(w) ?? [];
      arr.push(lv.id);
      seen.set(w, arr);
    }
  }
}
const repeats = [...seen.entries()].filter(([, ids]) => ids.length > 1);
if (repeats.length) {
  console.log(`\n— game-wide repeated MAIN words: ${repeats.length}`);
  for (const [w, ids] of repeats) console.log(`  ${w} → levels ${ids.join(", ")}`);
  problems += repeats.length;
} else {
  console.log("\n— game-wide main words: all unique ✔");
}

console.log(problems === 0 ? "\nOK — no duplicate words ✔" : `\nFOUND ${problems} problem(s)`);
