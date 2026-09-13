/* find the biggest crossword grids across all 100 levels */
import { getLevel } from "../src/game/data/levelsIndex";
import { makeCrossword } from "../src/game/crossword";

let worst = { cells: 0, cols: 0, rows: 0, id: "" };
for (let ch = 1; ch <= 10; ch++) {
  for (let lv = 1; lv <= 10; lv++) {
    const level = getLevel(ch, lv);
    const layout = makeCrossword(level.words, level.id * 100 + ch);
    if (!layout) { console.log("FAILED", ch, lv); continue; }
    const cells = layout.cols * layout.rows;
    if (cells > worst.cells) worst = { cells, cols: layout.cols, rows: layout.rows, id: `${ch}:${lv}` };
  }
}
console.log("biggest grid:", worst);
