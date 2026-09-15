/* probe 220 v2: record the RAW pointermove trail during the failing drag */
import { execFileSync } from "child_process";
const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const P = (js) => { const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim(); let v; try { v = JSON.parse(raw); } catch { v = raw; } if (typeof v === "string") { try { v = JSON.parse(v); } catch {} } return v; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = (js) => P(js) === true;
const clickText = (t) => P(`(function(){const e=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').includes('${t}'));if(e){e.click();return '1'}return '0'})()`) === "1";
const FA = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

ab(`open http://localhost:3000/`);
ab(`set viewport 390 844`);
await sleep(3500);
if (B(`document.body.innerText.includes('شروع سفر')`)) { clickText("شروع سفر"); await sleep(1200); }
clickText("شروع بازی");
await sleep(1700);
P(`(function(){const chips=[...document.querySelectorAll('.ch-chip')];const c=chips[19];if(c){c.click();return '1'}return '0'})()`);
await sleep(2300);
P(`(function(){const n=[...document.querySelectorAll('.map-node')].find(e=>(e.innerText||'').includes('${FA(220)}'));if(n){n.click();return '1'}return '0'})()`);
await sleep(2200);
clickText("تنظیمات"); await sleep(600); clickText("شروع دوباره"); await sleep(1500);

const g = P(`JSON.stringify((function(){
  const w=document.querySelector('.wheel-wrap');
  const tiles=[...w.querySelectorAll('[data-tile]')].map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}});
  return {size:Math.round(w.getBoundingClientRect().width),tiles:tiles};
})())`);
console.log("wheel:", g.size);
const word = process.argv[2] ?? "پهلوی";
const path = [];
const used = new Set();
for (const ch of word) {
  const t = g.tiles.find((x) => x.ch === ch && !used.has(`${x.x}:${x.y}`));
  used.add(`${t.x}:${t.y}`); path.push(t);
}
/* install the recorder */
P(`(function(){localStorage.removeItem('__ydbg');window.__mv=[];document.addEventListener('pointermove',function(e){window.__mv.push([Math.round(e.clientX),Math.round(e.clientY)])},true);return '1'})()`);
ab(`mouse move ${path[0].x} ${path[0].y}`);
ab(`mouse down`);
await sleep(90);
for (let i = 1; i < path.length; i++) {
  ab(`mouse move ${path[i].x} ${path[i].y}`);
  await sleep(100);
}
const trail = P(`JSON.stringify(window.__mv)`);
const selMid = P(`JSON.stringify([...document.querySelectorAll('.tile.sel')].map(t=>t.getAttribute('aria-label')).join(''))`);
const dbgMid = P(`localStorage.getItem("__ydbg")||"[]"`);
console.log("MID sel:", selMid);
console.log("MID dbg:", dbgMid.slice(0,600));
ab(`mouse up`);
console.log("word:", word);
console.log("targets:", JSON.stringify(path));
console.log("pointer trail (" + trail.length + " pts):", JSON.stringify(trail));
const sel = P(`JSON.stringify([...document.querySelectorAll('.tile.sel')].map(t=>t.getAttribute('aria-label')).join(''))`);
console.log("sel:", sel);
const dbg = P(`localStorage.getItem("__ydbg")||"[]"`);
console.log("CATCH DEBUG:", JSON.stringify(dbg));
/* analyze: min distance of each tile center to the trail polyline */
const an = P(`JSON.stringify((function(){
  const trail=window.__mv||[];
  function dseg(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const l2=dx*dx+dy*dy;let t=l2>0?((px-a[0])*dx+(py-a[1])*dy)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(a[0]+t*dx),py-(a[1]+t*dy));}
  const tiles=[...document.querySelectorAll('[data-tile]')].map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:b.x+b.width/2,y:b.y+b.height/2}});
  return tiles.map(t=>{let m=1e9;for(let i=1;i<trail.length;i++){m=Math.min(m,dseg(t.x,t.y,trail[i-1],trail[i]));}if(trail.length===1)m=dseg(t.x,t.y,trail[0],trail[0]);return {ch:t.ch,d:Math.round(m)};});
})())`);
console.log("min dist trail→tile:", JSON.stringify(an));
