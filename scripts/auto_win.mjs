/* E2E auto-player: wins chapter-1 levels 2..10 with REAL wheel drags,
 * tapping «ادامه» after each win (→ map) until the chapter celebration
 * screen appears. Run: node scripts/auto_win.mjs 2 10 */
import { execSync } from "child_process";
import { readFileSync } from "fs";

const ab = (c) => execSync(`agent-browser ${c}`, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LVS = JSON.parse(readFileSync("/home/z/my-project/scripts/ch_words.json", "utf8"));

const FROM = Number(process.argv[2] || 2);
const TO = Number(process.argv[3] || 10);
const FA = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

async function tiles() {
  for (let i = 0; i < 12; i++) {
    const raw = ab(`eval "JSON.stringify(Array.from(document.querySelectorAll('.tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))"`);
    const arr = JSON.parse(JSON.parse(raw));
    if (arr.length) return arr;
    await sleep(400);
  }
  throw new Error("no wheel tiles found");
}

async function dragWord(word, ts) {
  const used = new Set();
  const path = [];
  for (const ch of word) {
    const t = ts.find((t) => t.ch === ch && !used.has(`${t.x}:${t.y}`));
    if (!t) throw new Error(`no tile for «${ch}» in «${word}»`);
    used.add(`${t.x}:${t.y}`);
    path.push(t);
  }
  ab(`mouse move ${path[0].x} ${path[0].y}`);
  ab(`mouse down`);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    ab(`mouse move ${Math.round((a.x + b.x) / 2)} ${Math.round((a.y + b.y) / 2)}`);
    ab(`mouse move ${b.x} ${b.y}`);
  }
  ab(`mouse up`);
}

async function clickContinue() {
  for (let i = 0; i < 10; i++) {
    try { ab(`find text "ادامه" click`); return; } catch { await sleep(500); }
  }
  throw new Error("ادامه button never appeared");
}

for (let lv = FROM; lv <= TO; lv++) {
  process.stdout.write(`— level ${lv}: `);
  ab(`find role button click --name "مرحله ${FA(lv)}"`);
  await sleep(1100);
  const ts = await tiles();
  const { words } = LVS[String(lv)];
  for (const w of words) {
    await dragWord(w, ts);
    await sleep(950);
  }
  process.stdout.write(`won (${words.length} words) `);
  await clickContinue();
  await sleep(1400);
  const body = ab(`eval "document.body.innerText"`);
  const txt = JSON.parse(body);
  if (txt.includes("جشن فصل") || txt.includes("باز شد")) {
    console.log("→ 🎉 CHAPTER CELEBRATION reached");
    break;
  }
  console.log("→ back on map");
}
console.log("DONE");
