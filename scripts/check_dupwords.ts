/* session V QA — verify no duplicate words within a level (a duplicate
 * would make found.size (a Set) never reach wordRows.length) */
import { LEVELS } from "../src/game/data/levelsIndex";
import { letters } from "../src/game/core/utils";

let dups = 0;
for (let c = 0; c < LEVELS.length; c++) {
  for (let l = 0; l < LEVELS[c].length; l++) {
    const w = LEVELS[c][l].words;
    if (new Set(w.map((x) => letters(x))).size !== w.length) {
      console.log("DUP", c + 1, l + 1, w.join("،"));
      dups++;
    }
  }
}
console.log("dup levels:", dups, "| chapters:", LEVELS.length, "| ch1 levels:", LEVELS[0].length);
