/* ================================================================
 * x_party.mjs — session X party + timing E2E (v2, no nested quoting)
 *   A. timing: first letter lands ≤1.6s after release, banner ≥1.9s
 *   B. party: no ثبت/پاک buttons, no word counter, no dictionary name
 *   C. ring drag auto-submits via the offline lexicon
 *   D. recap «نوبتِ نفر بعدی» → final podium
 *   E. podium geometry: medal never intersects the name
 * Run: node scripts/x_party.mjs
 * ================================================================ */
import { execFileSync } from "child_process";

const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log(`  ✓ ${m}`); };
const bad = (m, x = "") => { FAIL++; console.log(`  ✗ ${m} ${x}`); };

const EV = (js) => {
  /* run one agent-browser eval; returns the decoded value */
  const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim();
  let v;
  try { v = JSON.parse(raw); } catch { return raw; }
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
  return v;
};
const J = (obj) => EV("JSON.stringify(" + obj + ")");
const clickText = (txt) => EV(`(function(){const els=[...document.querySelectorAll('button')];const el=els.find(e=>(e.innerText||'').includes('${txt}'));if(el){el.click();return '1'}return '0'})()`) === 1;
async function assert(name, fn) {
  for (let i = 0; i < 3; i++) {
    try { if (await fn()) { ok(name); return true; } break; }
    catch (e) { if (i === 2) { bad(name, `[${String(e).slice(0, 110)}]`); return false; } await sleep(500); }
  }
  bad(name); return false;
}
const tilesAt = (sel) => J(`Array.from(document.querySelectorAll('${sel}')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.textContent.trim(),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})`);
function drag(path) {
  ab(`mouse move ${path[0].x} ${path[0].y}`);
  ab(`mouse down`);
  let releasedAt = 0;
  return new Promise((r) => {
    let i = 1;
    const step = () => {
      if (i < path.length) { ab(`mouse move ${path[i].x} ${path[i].y}`); i++; setTimeout(step, 65); }
      else { ab(`mouse up`); releasedAt = Date.now(); r(releasedAt); }
    };
    setTimeout(step, 65);
  });
}
async function gotoLevelNode(chipIdx, nodeTxt) {
  for (let t = 0; t < 8; t++) {
    if (J(`!!document.querySelector('.ch-chip')`) === true) break;
    if (J(`!!document.querySelector('.wheel-wrap')`) === true) {
      EV(`(function(){const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='تنظیمات');if(g){g.click();return '1'}return '0'})()`);
      await sleep(600);
      clickText("خروج به نقشه");
      await sleep(900);
      continue;
    }
    clickText("شروع بازی");
    await sleep(1200);
  }
  EV(`(function(){const c=[...document.querySelectorAll('.ch-chip')][${chipIdx}];if(c){c.click();return '1'}return '0'})()`);
  let clicked = "0";
  for (let i = 0; i < 12; i++) {
    await sleep(350);
    clicked = EV(`(function(){const n=[...document.querySelectorAll('.map-node')].find(e=>(e.innerText||'').trim()==='${nodeTxt}');if(n){n.click();return '1'}return '0'})()`);
    if (String(clicked) === "1") break;
  }
  await sleep(1700);
  /* RESTART the level so any resumed snapshot (words already found) is
   * cleared — the timing drag needs a fresh «new» commit to measure */
  EV(`(function(){const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='تنظیمات');if(g){g.click();return '1'}return '0'})()`);
  await sleep(600);
  clickText("شروع دوباره");
  await sleep(1200);
  return String(clicked) === "1";
}

console.log("— boot");
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`);
/* clear in-progress level snapshots — a resumed level treats its words
 * as already-found (correct game behavior) and the timing drag would
 * hit the "known" path with no fresh commit to measure */
EV(`(function(){localStorage.removeItem('vz_progress_v1');return '1'})()`);
let ready = false;
for (let i = 0; i < 30; i++) {
  const t = J(`document.body.innerText`);
  if (typeof t === "string" && (t.includes("شروع بازی") || t.includes("شروع سفر"))) { ready = true; break; }
  await sleep(600);
}
if (!ready) throw new Error("home never appeared");
EV(`(function(){window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String(e.message||e))});return 'ok'})()`);
{
  const t = J(`document.body.innerText`);
  if (t.includes("شروع سفر")) { clickText("شروع سفر"); await sleep(1400); }
}

/* ================= A. TIMING ================= */
console.log("— A. word timing");
{
  const reached = await gotoLevelNode(0, "۱");
  if (!reached) { bad("timing: ch1 lv1 not reached"); }
  else {
    const ts = tilesAt(".tile");
    const lv = JSON.parse(execFileSync("node", ["-e", "const j=require('/home/z/my-project/src/game/data/levels/ch01.json');console.log(JSON.stringify(j.find(l=>l.id===1)))"], { encoding: "utf8" }));
    const word = [...lv.words].sort((a, b) => b.length - a.length)[0];
    const path = []; const used = new Set();
    for (const ch of word) {
      const t = ts.find((t) => t.ch === ch && !used.has(`${t.x}:${t.y}`));
      if (!t) { bad("timing drag path", `no tile «${ch}»`); break; }
      used.add(`${t.x}:${t.y}`); path.push(t);
    }
    if (path.length === word.length) {
      let tRelease = await drag(path);
      /* retry once if the stroke missed (flaky first capture) */
      let rowShown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        for (let i = 0; i < 20; i++) {
          await sleep(50);
          const st = J(`!!document.querySelector('.wrow.new')`);
          if (st === true) { rowShown = Date.now() - tRelease; break; }
        }
        if (rowShown !== null) break;
        const ts2 = tilesAt(".tile");
        const path2 = []; const used2 = new Set();
        for (const ch of word) {
          const t = ts2.find((t) => t.ch === ch && !used2.has(`${t.x}:${t.y}`));
          if (!t) break;
          used2.add(`${t.x}:${t.y}`); path2.push(t);
        }
        if (path2.length !== word.length) break;
        await sleep(400);
        tRelease = await drag(path2);
      }
      if (rowShown !== null && rowShown <= 900) ok(`word boxes appear fast (${rowShown}ms ≤900ms after release)`);
      else bad("word boxes appear fast", `got ${rowShown}ms`);
      /* banner: measure from the FIRST moment it becomes visible → fade */
      let firstVis = null, gone = null;
      const t0 = Date.now();
      while (Date.now() - t0 < 4500) {
        await sleep(100);
        const vis = J(`(function(){const r=document.querySelector('.wb-ribbon');if(!r)return '0';return getComputedStyle(r).opacity==='1'?'1':'0'})()`);
        if ((vis === 1 || vis === "1") && firstVis === null) firstVis = Date.now();
        if (firstVis !== null && !(vis === 1 || vis === "1")) { gone = Date.now(); break; }
      }
      const hold = firstVis !== null && gone !== null ? gone - firstVis : (firstVis !== null ? Date.now() - firstVis : 0);
      if (hold >= 1900) ok(`banner holds ≥1.9s (${Math.round(hold)}ms)`);
      else bad("banner holds ≥1.9s", `got ${Math.round(hold)}ms (firstVis=${firstVis === null ? "never" : Math.round(firstVis - tRelease) + "ms after release"})`);
    }
  }
}

/* ================= B-E. PARTY ================= */
async function ensureHome() {
  for (let t = 0; t < 8; t++) {
    const isHome = J(`document.body.innerText.includes('بازی دورهمi')`);
    if (isHome === true || J(`document.body.innerText.includes('بازی دورهمی')`) === true) return true;
    if (J(`!!document.querySelector('.wheel-wrap')`) === true) {
      EV(`(function(){const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='تنظیمات');if(g){g.click();return '1'}return '0'})()`);
      await sleep(600);
      clickText("خروج به نقشه");
      await sleep(900);
      continue;
    }
    if (J(`!!document.querySelector('.ch-chip')`) === true) {
      EV(`(function(){const b=document.querySelector('.map-back');if(b){b.click();return '1'}return '0'})()`);
      await sleep(900);
      continue;
    }
    await sleep(600);
  }
  return false;
}

console.log("— B. party setup");
if (!(await ensureHome())) throw new Error("never reached home");
clickText("بازی دورهمی");
await sleep(1300);
await assert("party setup opens", async () => J(`document.body.innerText.includes('چند نفرید؟')`) === true);
await assert("setup shows the big offline lexicon claim", async () => /۱۵۹/.test(J(`document.body.innerText`)));
clickText("۲ نفر");
await sleep(300);
await clickText("شروع دورهمی");
await sleep(1300);
await assert("handoff card with شروع! button", async () => J(`document.body.innerText.includes('شروع!')&&document.body.innerText.includes('نوبت')`) === true);
clickText("شروع!");
await sleep(1300);

console.log("— C. party turn");
await assert("no ثبت button", async () => J(`![...document.querySelectorAll('button')].some(b=>(b.innerText||'').includes('ثبت'))`) === true);
await assert("no پاک button", async () => J(`![...document.querySelectorAll('button')].some(b=>(b.innerText||'').includes('پاک'))`) === true);
await assert("no hidden-word counter", async () => J(`!document.body.innerText.includes('واژه در این چرخ پنهان')`) === true);
await assert("no dictionary name anywhere", async () => J(`!document.body.innerText.includes('دهخدا')&&!document.body.innerText.includes('لغت‌نامه')`) === true);
{
  const ringTiles = tilesAt(".pw-tile");
  const word = JSON.parse(execFileSync("node", ["/home/z/my-project/scripts/pick_party_word.mjs", JSON.stringify(ringTiles)], { encoding: "utf8" }));
  if (!word.w) bad("buildable ring word found");
  else if (word.path.length !== word.w.length) bad("party drag path incomplete");
  else {
    await drag(word.path);
    await sleep(1400);
    await assert(`ring drag auto-submits «${word.w}»`, async () => J(`document.querySelectorAll('.ps-tw').length>=1`) === true);
  }
}

console.log("— D. turn end → recap → final");
clickText("پایان نوبت");
await sleep(1100);
await assert("recap with «نوبتِ نفر بعدی» button", async () => J(`!![...document.querySelectorAll('button')].find(b=>(b.innerText||'').includes('نوبتِ نفر بعدی'))`) === true);
clickText("نوبتِ نفر بعدی");
await sleep(900);
for (let i = 0; i < 26; i++) {
  if (J(`!!document.querySelector('.ps-podium')`) === true) break;
  if (J(`!!document.querySelector('.ps-ring')`) === true) { clickText("پایان نوبت"); await sleep(900); continue; }
  if (clickText("نوبتِ نفر بعدی")) { await sleep(800); continue; }
  if (clickText("دیدن برنده‌ها")) { await sleep(1100); continue; }
  if (clickText("شروع!")) { await sleep(800); continue; }
  await sleep(500);
}
await assert("final podium reached", async () => J(`!!document.querySelector('.ps-podium')`) === true);

console.log("— E. podium geometry");
{
  const r = J(`(function(){
    const medal=document.querySelector('.ps-medal'); const name=document.querySelector('.ps-pod-name');
    if(!medal||!name) return JSON.stringify({err:'missing'});
    const m=medal.getBoundingClientRect(); const n=name.getBoundingClientRect();
    const col=medal.closest('.ps-pod-col'); const ava=col?col.querySelector('.ps-pod-ava'):null;
    const a=ava?ava.getBoundingClientRect():null;
    const ovx=Math.min(m.right,n.right)-Math.max(m.left,n.left);
    const ovy=Math.min(m.bottom,n.bottom)-Math.max(m.top,n.top);
    return JSON.stringify({ovx:Math.round(ovx),ovy:Math.round(ovy),onAvatar:a?(m.top>=a.top-16&&m.bottom<=a.bottom+10&&(m.left+m.right)/2>=a.left-4&&(m.left+m.right)/2<=a.right+4):false});
  })()`);
  if (!r || r.err) bad("podium geometry measured", (r && r.err) || "no data");
  else {
    if (r.ovx > 0 && r.ovy > 0) bad("medal never intersects the name", `overlap ${r.ovx}x${r.ovy}px`);
    else ok("medal never intersects the name");
    if (r.onAvatar) ok("medal sits on the avatar corner");
    else bad("medal sits on the avatar corner", JSON.stringify(r));
  }
}
ab(`screenshot /home/z/my-project/scripts/xaudit/party_final.png`);
await assert("no dictionary name on the final page", async () => J(`!document.body.innerText.includes('دهخدا')`) === true);
await assert("zero uncaught errors", async () => J(`(window.__errs||[]).length===0`) === true);

console.log(`\n==== X PARTY/TIMING: ${PASS} ok, ${FAIL} failed ====`);
