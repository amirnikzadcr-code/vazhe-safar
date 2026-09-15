/* visual sweep: mid-drag ribbon screenshots (main + party) */
import { execFileSync } from "child_process";
const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const P = (js) => { const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim(); let v; try { v = JSON.parse(raw); } catch { v = raw; } if (typeof v === "string") { try { v = JSON.parse(v); } catch {} } return v; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = (js) => P(js) === true;
const clickText = (t) => P(`(function(){const e=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').includes('${t}'));if(e){e.click();return '1'}return '0'})()`) === "1";

/* 1. mid-drag MAIN wheel */
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`);
await sleep(3400);
await sleep(800);
clickText("شروع بازی"); await sleep(1400);
P(`(function(){const n=document.querySelector('.map-node');if(n)n.click();return '1'})()`);
await sleep(2200);
const tiles = P(`JSON.stringify(Array.from(document.querySelectorAll('[data-tile]')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`);
const t0 = tiles[0], t1 = tiles[1], t2 = tiles[2];
ab(`mouse move ${t0.x} ${t0.y}`); ab(`mouse down`);
ab(`mouse move ${t1.x} ${t1.y}`); await sleep(120);
ab(`mouse move ${t2.x} ${t2.y}`); await sleep(90);
ab(`screenshot /home/z/my-project/scripts/xaudit/y_main_ribbon.png`);
ab(`mouse up`);
await sleep(600);

/* 2. mid-drag PARTY ring with the same ribbon */
for (let i = 0; i < 8; i++) {
  if (B(`!!document.querySelector('.wheel-wrap')`) && !B(`!!document.querySelector('.ps-ring')`)) {
    clickText("تنظیمات"); await sleep(600); clickText("خروج به نقشه"); await sleep(900);
    P(`(function(){const e=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('بازگشت'));if(e){e.click();return '1'}return '0'})()`);
    await sleep(800);
  }
  if (B(`document.body.innerText.includes('بازی دورهمی')`) && !B(`!!document.querySelector('.wheel-wrap')`)) break;
  await sleep(400);
}
clickText("بازی دورهمی"); await sleep(1300);
clickText("۲ نفر"); await sleep(250);
clickText("شروع دورهمی!"); await sleep(1300);
clickText("شروع!"); await sleep(1600);
const pt = P(`JSON.stringify(Array.from(document.querySelectorAll('.pw-tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.textContent.trim(),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`);
const p0 = pt[0], p1 = pt[1], p2 = pt[2];
ab(`mouse move ${p0.x} ${p0.y}`); ab(`mouse down`);
ab(`mouse move ${p1.x} ${p1.y}`); await sleep(120);
ab(`mouse move ${p2.x} ${p2.y}`); await sleep(90);
ab(`screenshot /home/z/my-project/scripts/xaudit/y_party_ribbon_mid.png`);
ab(`mouse up`);
console.log("done");
