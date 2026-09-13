import { LEVELS } from "../src/game/data/levelsIndex";
const seen = new Map<string, number[]>();
for (const ch of LEVELS) for (const lv of ch) {
  const arr = seen.get(lv.wheel) ?? []; arr.push(lv.id); seen.set(lv.wheel, arr);
}
const rep = [...seen.entries()].filter(([, ids]) => ids.length > 1);
console.log(rep.length ? `repeated wheels: ${rep.length}` : "all wheels unique ✔");
for (const [w, ids] of rep) console.log(`  ${w} → ${ids.join(", ")}`);
