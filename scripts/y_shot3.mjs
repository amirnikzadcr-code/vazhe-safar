import { execFileSync } from "child_process";
const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const P = (js) => { const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim(); let v; try { v = JSON.parse(raw); } catch { v = raw; } if (typeof v === "string") { try { v = JSON.parse(v); } catch {} } return v; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = () => String(P(`document.body.innerText`));
const step = async (label, t, want) => {
  for (let i = 0; i < 16; i++) {
    if (txt().includes(want)) return true;
    P(`(function(){const e=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').includes('${t}'));if(e){e.click();return '1'}return '0'})()`);
    await sleep(500);
  }
  console.log("stuck at", label, "|", txt().slice(0, 150));
  return txt().includes(want);
};
ab(`open about:blank`);
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`);
await step("party", "بازی دورهمی", "چند نفرید؟");
await step("2p", "۲ نفر", "چند نفرید؟");
await step("start", "شروع دورهمی!", "نوبتِ");
await step("go", "شروع!", "واژه بساز");
await sleep(600);
const pt = P(`JSON.stringify(Array.from(document.querySelectorAll('.pw-tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.textContent.trim(),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`);
if (!pt || pt.length < 3) { console.log("no ring"); process.exit(1); }
ab(`mouse move ${pt[0].x} ${pt[0].y}`); ab(`mouse down`);
ab(`mouse move ${pt[1].x} ${pt[1].y}`); await sleep(130);
ab(`mouse move ${pt[2].x} ${pt[2].y}`); await sleep(90);
ab(`screenshot /home/z/my-project/scripts/xaudit/y_party_ribbon_mid.png`);
ab(`mouse up`);
console.log("SHOT OK");
