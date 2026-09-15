/* party mid-drag screenshot — robust waits */
import { execFileSync } from "child_process";
const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const P = (js) => { const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim(); let v; try { v = JSON.parse(raw); } catch { v = raw; } if (typeof v === "string") { try { v = JSON.parse(v); } catch {} } return v; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = () => String(P(`document.body.innerText`));
const clickText = (t) => P(`(function(){const e=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').includes('${t}'));if(e){e.click();return '1'}return '0'})()`) === "1";
const waitText = async (t, ms) => { for (let i = 0; i < ms / 250; i++) { if (txt().includes(t)) return true; await sleep(250); } return false; };
const clickWhen = async (t, ms) => { for (let i = 0; i < ms / 300; i++) { if (clickText(t)) return true; await sleep(300); } return false; };

ab(`open about:blank`);
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`);
await waitText("بازی دورهمی", 15000);
await sleep(400);
if (!(await clickWhen("بازی دورهمی", 4000))) { console.log("FAIL party btn. text:", txt().slice(0, 250)); process.exit(1); }
await waitText("چند نفرید؟", 5000);
if (!(await clickWhen("۲ نفر", 3000))) console.log("2n already ok?");
if (!(await clickWhen("شروع دورهمی!", 3000))) { console.log("FAIL start"); process.exit(1); }
await waitText("نوبتِ", 5000);
if (!(await clickWhen("شروع!", 4000))) { console.log("FAIL go"); process.exit(1); }
await waitText("واژه بساز", 6000);
await sleep(400);
const pt = P(`JSON.stringify(Array.from(document.querySelectorAll('.pw-tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.textContent.trim(),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`);
if (!pt || pt.length < 3) { console.log("no ring"); process.exit(1); }
const p0 = pt[0], p1 = pt[1], p2 = pt[2];
ab(`mouse move ${p0.x} ${p0.y}`); ab(`mouse down`);
ab(`mouse move ${p1.x} ${p1.y}`); await sleep(130);
ab(`mouse move ${p2.x} ${p2.y}`); await sleep(90);
ab(`screenshot /home/z/my-project/scripts/xaudit/y_party_ribbon_mid.png`);
ab(`mouse up`);
console.log("done");
