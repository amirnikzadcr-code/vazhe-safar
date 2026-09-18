/* one-off: L108 wheel=ارتودنسی got اردو (now also in L154) → re-pick */
import { LEVELS, FULL_DICT } from "../src/game/data/levelsIndex";
import { canBuild, letters } from "../src/game/core/utils";
import { readFileSync, writeFileSync } from "fs";

const used = new Map<string, Set<number>>();
for (const ch of LEVELS) for (const lv of ch) {
  for (const w of lv.words) { if (!used.has(w)) used.set(w, new Set()); used.get(w)!.add(lv.id); }
}
const lvMeta = LEVELS.flat().find((l) => l.id === 108)!;
const cands: string[] = [];
for (const w of FULL_DICT) {
  if (used.has(w) || w === "اردو" || lvMeta.words.includes(w) || lvMeta.bonus.includes(w)) continue;
  if (!canBuild(w, lvMeta.wheel)) continue;
  const L = letters(w).length;
  if (L < 3 || L > 6) continue;
  cands.push(w);
}
cands.sort((a, b) => (letters(a).length - letters(b).length) || (a < b ? -1 : 1));
const pick = cands[0];
console.log("pick for L108:", pick);
const file = "src/game/data/levels/ch11.json";
const data = JSON.parse(readFileSync(file, "utf-8"));
const node = data.find((l: { id: number }) => l.id === 108);
node.words = node.words.map((w: string) => (w === "اتو" ? pick : w));
writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
console.log("done");
