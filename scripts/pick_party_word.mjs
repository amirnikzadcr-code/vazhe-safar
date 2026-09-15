/* pick_party_word.mjs — argv: JSON of ring tiles [{ch,x,y}]
 * prints JSON {w, path:[{x,y}...]} for the best (first) 3+ letter
 * curated-dictionary word buildable from the party ring. */
import { readFileSync } from "fs";

const tiles = JSON.parse(process.argv[2] ?? "[]");
const pool = tiles.map((t) => t.ch).join("");
const dict = JSON.parse(readFileSync("/tmp/partywords.json", "utf8"));

const canBuild = (w) => {
  let p = pool;
  for (const c of w) {
    const i = p.indexOf(c);
    if (i < 0) return false;
    p = p.slice(0, i) + p.slice(i + 1);
  }
  return true;
};

const w = dict.find((x) => x.length >= 3 && canBuild(x));
if (!w) {
  console.log(JSON.stringify({ w: null }));
  process.exit(0);
}
const path = [];
const used = new Set();
const avail = tiles.slice();
for (const ch of w) {
  const i = avail.findIndex((t) => t.ch === ch && !used.has(`${t.x}:${t.y}`));
  if (i < 0) break;
  used.add(`${avail[i].x}:${avail[i].y}`);
  path.push({ x: avail[i].x, y: avail[i].y });
}
console.log(JSON.stringify({ w, path }));
