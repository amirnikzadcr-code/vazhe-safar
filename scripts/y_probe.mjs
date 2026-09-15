/* probe: drag a specific word on ch20 lv9 and dump state after each step */
import { execFileSync } from "child_process";
const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const P = (js) => { const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim(); let v; try { v = JSON.parse(raw); } catch { v = raw; } if (typeof v === "string") { try { v = JSON.parse(v); } catch {} } return v; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = (js) => P(js) === true;
const clickText = (t) => P(`(function(){const e=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').includes('${t}'));if(e){e.click();return '1'}return '0'})()`) === "1";

ab(`open http://localhost:3000/`);
ab(`set viewport 390 844`);
await sleep(3500);
if (!B(`!!document.querySelector('.wheel-wrap')`)) {
  clickText("شروع بازی"); await sleep(1400);
  /* jump to ch20 via chips rail: scroll the chip rail to the end */
  for (let i = 0; i < 25 && !B(`!!document.querySelector('.map-node')`); i++) await sleep(200);
  P(`(function(){const chips=[...document.querySelectorAll('.ch-chip')];const c=chips[chips.length-1];if(c)c.click();return '1'})()`);
  await sleep(1600);
  P(`(function(){const n=document.querySelector('.map-node');if(n)n.click();return '1'})()`);
  await sleep(2200);
}
/* restart the level for a clean board */
clickText("تنظیمات"); await sleep(600); clickText("شروع دوباره"); await sleep(1500);

const tiles = P(`JSON.stringify(Array.from(document.querySelectorAll('.tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`);
console.log("tiles:", JSON.stringify(tiles));
const word = process.argv[2] ?? "پهلوی";
console.log("dragging:", word);
const path = [];
const used = new Set();
for (const ch of word) {
  const t = tiles.find((x) => x.ch === ch && !used.has(`${x.x}:${x.y}`));
  if (!t) { console.log("NO TILE for", ch); process.exit(1); }
  used.add(`${t.x}:${t.y}`); path.push(t);
}
const dump = (tag) => {
  const s = P(`JSON.stringify({
    sel:[...document.querySelectorAll('.tile.sel')].map(t=>t.getAttribute('aria-label')).join(''),
    guess:(document.querySelector('.guess-inner')||{}).textContent||'',
    pts:(document.querySelector('.wheel-wrap polyline')||{getAttribute:()=>''}).getAttribute('points')
  })`);
  console.log(tag, JSON.stringify(s));
};
ab(`mouse move ${path[0].x} ${path[0].y}`);
ab(`mouse down`);
await sleep(80); dump("after down:");
for (let i = 1; i < path.length; i++) {
  ab(`mouse move ${path[i].x} ${path[i].y}`);
  await sleep(90);
  dump(`after move ${i} (${word[i]}):`);
}
ab(`mouse up`);
await sleep(400);
dump("after up:");
await sleep(1600);
{
  const found = P(`JSON.stringify([...document.querySelectorAll('.wgroup')].filter(g=>g.classList.contains('done')||g.querySelector('.wl')).length)`);
  const txt = P(`document.body.innerText`);
  console.log("filled groups:", found, "msg:", String(txt).split("\n").filter(l => l.includes("پذیرفته") || l.includes("واژه")).slice(0,2).join(" | "));
}
