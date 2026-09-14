/* debug why late hard levels fail — mirrors genHardTier logic with logging */
import { canBuild, rng, shuffle } from "/home/z/my-project/src/game/core/utils";
import { makeCrossword } from "/home/z/my-project/src/game/crossword";
import { DICT } from "/home/z/my-project/scripts/dict_source";
import { readFileSync } from "fs";

const used = new Set<string>();
for (let ch = 1; ch <= 10; ch++) {
  const arr = JSON.parse(readFileSync(`/home/z/my-project/src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`, "utf8"));
  for (const l of arr) l.words.forEach((w: string) => used.add(w));
}
for (let ch = 11; ch <= 18; ch++) {
  const arr = JSON.parse(readFileSync(`/home/z/my-project/src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`, "utf8"));
  for (const l of arr) l.words.forEach((w: string) => used.add(w));
}
console.log("used so far:", used.size);

const byLen = new Map<number, string[]>();
for (const w of DICT) { const L = w.length; if (!byLen.has(L)) byLen.set(L, []); byLen.get(L)!.push(w); }

const buildableCache = new Map<string, string[]>();
function buildable(wheel: string): string[] {
  let b = buildableCache.get(wheel);
  if (!b) { b = DICT.filter((w) => canBuild(w, wheel)); buildableCache.set(wheel, b); }
  return b;
}

const rand = rng(999);
const prefWl = 8, prefWant = 9, minLen = 3;
for (const decay of [0, 1, 2, 3]) {
  const wl = Math.max(5, prefWl - decay);
  const want = Math.max(6, prefWant - (decay >= 2 ? 1 : 0) - (decay >= 3 ? 1 : 0));
  const pool = byLen.get(wl) ?? [];
  const avail = pool.filter((w) => !used.has(w));
  const scored = avail
    .map((a) => ({ a, rich: buildable(a).filter((w) => !used.has(w) && w.length >= minLen).length }))
    .sort((x, y) => y.rich - x.rich);
  console.log(`decay ${decay}: wl=${wl} pool=${pool.length} avail=${avail.length} topRich=${scored.slice(0, 3).map((s) => `${s.a}:${s.rich}`).join(", ")}`);
  if (scored.length === 0 || scored[0].rich < 3) { console.log("  → no viable anchor at this decay"); continue; }
  const topPool = scored.slice(0, Math.max(12, Math.ceil(scored.length * 0.6)));
  const candidates = shuffle(topPool.map((s) => s.a), rand);
  let tried = 0;
  for (const anchor of candidates) {
    tried++;
    const rich = buildable(anchor).filter((w) => !used.has(w) && w.length >= minLen);
    const sortedT = [...rich.filter((w) => w !== anchor)].sort((a, b) => b.length - a.length);
    if (tried <= 5) console.log(`  anchor ${anchor} (${letters(anchor).length}) rich=${rich.length}`);
    if (sortedT.length < 3) continue;
    const picked: string[] = [];
    const longs = sortedT.filter((w) => w.length >= 4);
    if (longs.length) picked.push(longs[Math.floor(rand() * Math.min(3, longs.length))]);
    const mids = sortedT.filter((w) => w.length === 3);
    if (mids.length) picked.push(mids[Math.floor(rand() * mids.length)]);
    for (const w of shuffle(sortedT, rand)) {
      if (picked.length >= Math.max(3, want - 1)) break;
      if (!picked.includes(w)) picked.push(w);
    }
    for (const n of [want - 1, want - 2, want - 3, 4]) {
      const t = Math.min(n, picked.length);
      if (t < 3) continue;
      const words = [anchor, ...picked.slice(0, t)];
      const layout = makeCrossword(words, 19110);
      if (!layout) { if (tried <= 5) console.log(`    n=${n + 1} crossword FAIL`); continue; }
      console.log(`    n=${n + 1} crossword OK grid=${layout.cols}x${layout.rows}`);
      process.exit(0);
    }
    if (tried >= 40) { console.log("  40 anchors tried, all failed"); break; }
  }
}
function letters(w: string): string[] { return Array.from(w); }
