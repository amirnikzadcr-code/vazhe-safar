/* EE — kill the 9 game-wide repeated MAIN words (user: «مراقب باش کلا
 * چ هر فصل باشه چ مرحله کاربر تکراری وارد نکنه»). For each pair the
 * LATER level gets the word swapped for a real dictionary word that:
 *   • is buildable from the SAME wheel (canBuild multiset),
 *   • is not used anywhere else in the game (no new duplicates),
 *   • prefers the SAME letter count (row width unchanged),
 *   • never collides with the level's own words/bonus.
 * Run: bun scripts/fix_dup_mains.ts && bun scripts/check_dupes.ts
 */
import { LEVELS, FULL_DICT, globalLevel } from "../src/game/data/levelsIndex";
import { canBuild, letters } from "../src/game/core/utils";
import { readFileSync, writeFileSync } from "fs";

/* word → [levelIds] reported by check_dupes (patch the LATER level) */
const FIXES: Array<{ word: string; laterId: number }> = [
  { word: "ماهی", laterId: 72 },
  { word: "ماه", laterId: 30 },
  { word: "رو", laterId: 21 },
  { word: "دریا", laterId: 66 },
  { word: "داری", laterId: 154 },
  { word: "برد", laterId: 33 },
  { word: "دار", laterId: 18 },
  { word: "دوست", laterId: 108 },
  { word: "دو", laterId: 15 },
];

/* global usage of every main word (for candidate vetting, read-only) */
const used = new Map<string, Set<number>>();
for (const ch of LEVELS) for (const lv of ch) {
  for (const w of lv.words) {
    if (!used.has(w)) used.set(w, new Set());
    used.get(w)!.add(lv.id);
  }
}

/* global id → chapter file */
function chFileOf(globalId: number): string {
  for (let ch = 1; ch <= 20; ch++) {
    const list = LEVELS[ch - 1];
    if (list.some((l) => l.id === globalId)) return `src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
  }
  throw new Error(`no chapter for level ${globalId}`);
}

const changed = new Set<string>();
let patched = 0;

for (const { word, laterId } of FIXES) {
  const lvMeta = LEVELS.flat().find((l) => l.id === laterId);
  if (!lvMeta || !lvMeta.words.includes(word)) { console.log(`skip ${word}@${laterId}: not present`); continue; }
  const len = letters(word).length;
  const banned = new Set<string>([
    ...lvMeta.words, ...lvMeta.bonus,
    ...[...used.entries()].filter(([, ids]) => ids.size > 1).flatMap(([w]) => [w]),
  ]);
  const cands: string[] = [];
  for (const w of FULL_DICT) {
    if (used.has(w)) continue;               /* keep the game 100% dup-free */
    if (banned.has(w)) continue;
    if (!canBuild(w, lvMeta.wheel)) continue;
    const L = letters(w).length;
    if (L < 2 || L > 8) continue;
    cands.push(w);
  }
  cands.sort((a, b) => {
    const da = Math.abs(letters(a).length - len), db = Math.abs(letters(b).length - len);
    if (da !== db) return da - db;           /* same length first */
    return a < b ? -1 : 1;
  });
  if (cands.length === 0) { console.log(`!! no candidate for ${word}@${laterId} (wheel ${lvMeta.wheel})`); continue; }
  const pick = cands[0];
  console.log(`L${laterId} wheel=${lvMeta.wheel}: ${word} → ${pick} (${letters(pick).length} letters, was ${len})`);

  /* patch the FILE (not the imported object) */
  const file = chFileOf(laterId);
  const data = JSON.parse(readFileSync(file, "utf-8"));
  const node = data.find((l: { id: number }) => l.id === laterId);
  if (!node) { console.log(`!! node ${laterId} missing in ${file}`); continue; }
  node.words = node.words.map((w: string) => (w === word ? pick : w));
  writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
  changed.add(file);
  patched++;
}

console.log(`patched ${patched} levels in ${changed.size} files; verify: bun scripts/check_dupes.ts`);
void globalLevel;
