/* ================================================================
 * z_e2e.mjs — session Z E2E (v1.25)
 *   A. home dock: wooden plank board, TWO items only (no تنظیمات),
 *      cartoon chest + animated mission scroll, HUD gear survives
 *   B. chapter-1 fresh tutorial: veil + flying hand + teaching card,
 *      demo really spells the hero word into the guess strip
 *   C. first find pops the chapter-1 coach (cheer + explanation)
 *   D. repeating an already-found word flashes the board row + toast
 *   E. pause modal: cartoon wooden .b3.fancy buttons with glyphs
 *   F. party: a TAP selects NOTHING (drag-only), a real drag selects;
 *      fair-round note on the handoff; recap hands over the turn
 * Run: node scripts/z_e2e.mjs   (server on :3000)
 * ================================================================ */
import { execFileSync } from "child_process";

const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0;
const ok = (m, x = "") => { PASS++; console.log(`  ✓ ${m} ${x}`); };
const bad = (m, x = "") => { FAIL++; console.log(`  ✗ ${m} ${x}`); };
const P = (js) => {
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim();
    last = raw;
    let v;
    try { v = JSON.parse(raw); } catch { v = raw; }
    if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* keep string */ } }
    /* transient empty evals happen when the page is mid-repaint — retry */
    if (v !== "" && v != null) return v;
  }
  return last;
};
const B = (js) => P(js) === true;
const clickText = (txt) => P(`(function(){const els=[...document.querySelectorAll('button')];const el=els.find(e=>(e.innerText||'').includes('${txt}'));if(el){el.click();return '1'}return '0'})()`) === "1";
const clickAria = (label) => P(`(function(){const els=[...document.querySelectorAll('button')];const el=els.find(e=>(e.getAttribute('aria-label')||'').includes('${label}'));if(el){el.click();return '1'}return '0'})()`) === "1";
const bodyTxt = () => { const v = P(`document.body.innerText`); return typeof v === "string" ? v : ""; };
const tilesAt = (sel) => {
  /* P() already JSON-parses the CLI output (string → array); no second
   * parse — JSON.parse(array) would collapse to [object Object],… */
  const v = P(`(function(){return JSON.stringify(Array.from(document.querySelectorAll('${sel}')).map(function(t){const b=t.getBoundingClientRect();return {ch:(t.getAttribute('aria-label')||t.textContent.trim()),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))})()`);
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
};
function drag(path, dwell = 65) {
  ab(`mouse move ${path[0].x} ${path[0].y}`);
  ab(`mouse down`);
  return new Promise((r) => {
    let i = 1;
    const step = () => {
      if (i < path.length) { ab(`mouse move ${path[i].x} ${path[i].y}`); i++; setTimeout(step, dwell); }
      else { ab(`mouse up`); r(Date.now()); }
    };
    setTimeout(step, dwell);
  });
}
const setReactInput = (sel, val) => P(`(function(){
  const el=document.querySelector('${sel}'); if(!el) return '0';
  const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  st.call(el,'${val}'); el.dispatchEvent(new Event('input',{bubbles:true})); return '1';
})()`) === "1";

/* ================= boot (FRESH PROFILE — deterministic tutorial) ================= */
try { ab(`close --all`); } catch { /* no session yet */ }
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`);
await sleep(1500);
/* a cold first navigation can land before the browser is warm — the
 * page arrives EMPTY; re-open once if so */
if (P(`document.body.innerText.length`) === 0) {
  ab(`open http://localhost:3000/`);
  await sleep(2500);
}
/* wait out the splash */
let homeAt = 0;
for (let i = 0; i < 40; i++) {
  if (B(`!!document.querySelector('.hud')`) || B(`!!document.querySelector('.nameask-panel')`)) { homeAt = Date.now(); break; }
  await sleep(300);
}
if (!homeAt) { bad("reached home"); process.exit(1); }
await sleep(400);

/* first-entry name ask → become «یار آزمایشی».
 * The save persists on a 900ms debounce — wait OUT the flush. */
if (B(`!!document.querySelector('.nameask-panel .name-input')`)) {
  setReactInput(".name-input", "یار آزمایشی");
  await sleep(120);
  P(`(function(){const b=document.querySelector('.nameask-panel .b3');if(b){b.click();return '1'}return '0'})()`);
  await sleep(1600); /* debounce flush lands */
  ok("first-entry name asked + set");
}
/* a fresh profile guarantees tutorialDone=false; assert it so a profile
 * leak fails loudly HERE instead of mysteriously in section B */
if (!B(`(function(){try{return JSON.parse(localStorage.getItem('vazhe_safar_save_v1')).tutorialDone===false}catch(e){return false}})()`)) {
  bad("fresh save with tutorialDone=false", "profile not fresh?");
} else {
  ok("fresh save with tutorialDone=false");
}
await sleep(300);

/* ================= A. home dock ================= */
console.log("— A. home dock: wooden board, 2 cartoon items");
{
  const d = P(`JSON.stringify((function(){
    const nav=document.querySelector('.navbar2'); if(!nav) return {err:'no nav'};
    const cs=getComputedStyle(nav);
    return {
      wooden:nav.classList.contains('wooden'),
      bg:cs.backgroundImage||'',
      items:nav.querySelectorAll('.nav2-item').length,
      labels:[...nav.querySelectorAll('.nav2-label')].map(e=>e.innerText),
      chest:!!nav.querySelector('.anim-chest'),
      scroll:!!nav.querySelector('.anim-scroll'),
      leafOrb:!!nav.querySelector('.nav2-orb.leaf'),
      gearOnHud:!!document.querySelector('.gearbtn'),
      settingsInNav:[...nav.querySelectorAll('.nav2-label')].some(e=>e.innerText.includes('تنظیمات')),
    };
  })())`);
  if (d && d.wooden && /repeating-linear-gradient/.test(d.bg)) ok("dock is the brown WOOD-PLANK board", "repeating planks + knots");
  else bad("dock is the brown WOOD-PLANK board", JSON.stringify(d && d.bg ? d.bg.slice(0, 60) : d));
  if (d && d.items === 2) ok("dock has exactly TWO buttons");
  else bad("dock has exactly TWO buttons", String(d && d.items));
  if (d && !d.settingsInNav) ok("تنظیمات REMOVED from the dock");
  else bad("تنظیمات REMOVED from the dock", JSON.stringify(d && d.labels));
  if (d && d.chest && d.scroll && d.leafOrb) ok("cartoon MONEY CHEST + animated mission SCROLL icons", "chest/scroll/leaf-orb");
  else bad("cartoon MONEY CHEST + animated mission SCROLL icons", JSON.stringify({ c: d && d.chest, s: d && d.scroll, l: d && d.leafOrb }));
  if (d && d.gearOnHud) ok("settings still reachable via the HUD gear");
  else bad("settings still reachable via the HUD gear");
}

/* ================= B. chapter-1 tutorial ================= */
console.log("— B. chapter-1: animated-hand tutorial");
clickText("شروع بازی");
await sleep(1000);
/* شروع بازی opens the MAP → tap the first (next) level node */
for (let i = 0; i < 6 && !B(`!!document.querySelector('.wheel-wrap')`); i++) {
  if (B(`!!document.querySelector('.map-node')`)) {
    P(`(function(){const n=document.querySelector('.map-node');if(n){n.click();return '1'}return '0'})()`);
    await sleep(1400);
    continue;
  }
  if (B(`!!document.querySelector('.ch-chip')`)) { await sleep(800); continue; }
  await sleep(500);
}
{
  let inLevel = B(`!!document.querySelector('.wheel-wrap')`);
  if (!inLevel) { bad("entered level 1:1"); process.exit(1); }
}
await sleep(500);
{
  const t = P(`JSON.stringify((function(){
    const veil=document.querySelector('.tut-veil'); if(!veil) return {err:'no veil'};
    return {
      veil:true, hand:!!document.querySelector('.tut-hand-fly'),
      card:!!document.querySelector('.tut-card'),
      cardTxt:(document.querySelector('.tut-card-txt')||{}).innerText||'',
      pointerFree:getComputedStyle(veil).pointerEvents,
    };
  })())`);
  if (t && t.veil && t.hand && t.card) ok("tutorial veil + flying hand + teaching card render");
  else bad("tutorial veil + flying hand + teaching card render", JSON.stringify(t));
  if (t && t.pointerFree === "none") ok("tutorial never blocks the wheel (pointer-events none)");
  else bad("tutorial never blocks the wheel", String(t && t.pointerFree));
  /* the demo really spells the hero word into the guess strip */
  let demoWord = "";
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const g = P(`(function(){const g=document.querySelector('.guess-inner');return g?g.textContent:''})()`);
    if (typeof g === "string" && g.length > demoWord.length) demoWord = g;
    if (demoWord.length >= 4) break; /* hero is 4 letters (قوری) */
    await sleep(120);
  }
  if (demoWord.length >= 3) ok("hand demo SPELLS the hero word into the guess strip", `«${demoWord}»`);
  else bad("hand demo SPELLS the hero word into the guess strip", `«${demoWord}»`);
  globalThis.demoWord = demoWord;
}

/* dismiss with a real stroke, then build the full hero word */
let tiles = tilesAt(`[data-tile]`);
for (let i = 0; i < 8 && tiles.length < 3; i++) { await sleep(300); tiles = tilesAt(`[data-tile]`); }
if (tiles.length < 3) { bad("level tiles found"); process.exit(1); }
const take = (ch, used) => {
  const i = tiles.findIndex((t) => t.ch === ch && !used.has(t.x + ":" + t.y));
  if (i === -1) return null;
  const t = tiles[i]; used.add(t.x + ":" + t.y); return t;
};
{
  const first = tiles[0];
  const near = tiles[1];
  await drag([first, { x: first.x, y: first.y }, { x: near.x, y: near.y }, { x: near.x, y: near.y }]);
  let faded = false;
  for (let i = 0; i < 12; i++) { if (!B(`!!document.querySelector('.tut-veil')`)) { faded = true; break; } await sleep(200); }
  if (faded) ok("first real drag fades the tutorial away");
  else bad("first real drag fades the tutorial away");
}

console.log("— C. coach cheer + teaching after a correct guess");
{
  const word = globalThis.demoWord || "";
  const used = new Set();
  const path = [];
  for (const ch of Array.from(word)) { const t = take(ch, used); if (t) path.push(t); }
  if (path.length >= 3) {
    const full = [...path, ...path.slice(-1)];
    await drag(full, 80);
    let coach = null;
    for (let i = 0; i < 16; i++) {
      coach = P(`JSON.stringify((function(){const c=document.querySelector('.pcoach');return c?{txt:(c.innerText||'').slice(0,60),img:!!c.querySelector('img')}:null})())`);
      if (coach) break;
      await sleep(200);
    }
    if (coach && coach.img) ok("coach bubble pops: CHEER + explanation (عمو دانا)", `«${coach.txt}»`);
    else bad("coach bubble pops: CHEER + explanation (عمو دانا)", JSON.stringify(coach));
  } else bad("could not path the demo word", word);
}

console.log("— D. repeat word → board-row highlight + toast");
{
  const word = globalThis.demoWord || "";
  const used = new Set();
  const path = [];
  for (const ch of Array.from(word)) { const t = take(ch, used); if (t) path.push(t); }
  if (path.length >= 3) {
    await sleep(400); /* let the coach bubble's timer settle */
    await drag([...path, ...path.slice(-1)], 80);
    let flashed = false;
    for (let i = 0; i < 26; i++) {
      if (bodyTxt().includes("قبلاً ساختی")) { flashed = true; break; }
      await sleep(120);
    }
    if (flashed) ok("already-found word gets a golden flash + toast");
    else bad("already-found word gets a golden flash + toast");
  }
}

console.log("— E. pause modal: cartoon wooden buttons");
{
  clickAria("تنظیمات");
  await sleep(500);
  const p = P(`JSON.stringify((function(){
    const bs=[...document.querySelectorAll('button.b3.fancy')];
    return {n:bs.length, glyphs:bs.filter(b=>b.querySelector('svg')).length,
      labels:bs.map(b=>b.innerText.trim())};
  })())`);
  if (p && p.n === 4 && p.glyphs === 4) ok("4 wooden fancy buttons, each with its cartoon glyph", p.labels.join(" / "));
  else bad("4 wooden fancy buttons with glyphs", JSON.stringify(p));
  clickText("ادامه بازی");
  await sleep(400);
}

/* ================= F. party: drag-only + fairness ================= */
console.log("— F. party: tap never selects; drag does");
{
  /* leave the level: pause → خروج به نقشه → map → بازگشت → home */
  clickAria("تنظیمات");
  await sleep(500);
  clickText("خروج به نقشه");
  await sleep(900);
  clickAria("بازگشت");
  await sleep(900);
  if (!B(`!!document.querySelector('.navbar2')`)) {
    clickAria("بازگشت");
    await sleep(800);
  }
  clickText("بازی دورهمی");
  await sleep(1000);
  clickText("شروع دورهمی!");
  await sleep(900);
  const fair = P(`(function(){const f=document.querySelector('.ps-fair-note');return f?f.innerText:null})()`);
  if (typeof fair === "string" && fair.includes("عادلانه")) ok("handoff shows the FAIR-ROUND note", `«${fair}»`);
  else bad("handoff shows the FAIR-ROUND note", JSON.stringify(fair));
  clickText("شروع!");
  await sleep(1000);
  /* TAP: down+up on one tile without moving */
  const pt = tilesAt(".pw-tile")[0];
  if (!pt) { bad("party ring tiles found"); process.exit(1); }
  ab(`mouse move ${pt.x} ${pt.y}`);
  ab(`mouse down`);
  await sleep(90);
  ab(`mouse up`);
  await sleep(350);
  const afterTap = P(`(function(){return JSON.stringify({sel:document.querySelectorAll('.pw-tile.sel').length,hub:(document.querySelector('.ps-hub')||{}).innerText||''})})()`);
  if (afterTap && afterTap.sel === 0 && !afterTap.hub.includes(pt.ch)) ok("a quick TAP selects NOTHING (drag-only ring)", `hub «${afterTap.hub}»`);
  else bad("a quick TAP selects NOTHING (drag-only ring)", JSON.stringify(afterTap));
  /* DRAG: glide a→b→c with waypoints (the anti-graze catch needs the
   * PATH, not teleports) and assert letters collect MID-STROKE — the
   * release auto-submits, so sel is only visible while dragging. */
  const seats = tilesAt(".pw-tile");
  const a = seats[0], b = seats[1], c = seats[2];
  const mid = (p, q) => ({ x: Math.round((p.x + q.x) / 2), y: Math.round((p.y + q.y) / 2) });
  ab(`mouse move ${a.x} ${a.y}`);
  ab(`mouse down`);
  await sleep(130);
  ab(`mouse move ${mid(a, b).x} ${mid(a, b).y}`);
  await sleep(110);
  ab(`mouse move ${b.x} ${b.y}`);
  await sleep(110);
  ab(`mouse move ${mid(b, c).x} ${mid(b, c).y}`);
  await sleep(110);
  ab(`mouse move ${c.x} ${c.y}`);
  await sleep(150);
  let selMid = 0;
  for (let i = 0; i < 8; i++) {
    const s = P(`(function(){return JSON.stringify({sel:document.querySelectorAll('.pw-tile.sel').length,hub:(document.querySelector('.ps-hub')||{}).innerText||''})})()`);
    if (s && s.sel >= 2) { selMid = s.sel; break; }
    await sleep(140);
  }
  ab(`mouse up`);
  await sleep(400);
  if (selMid >= 2) ok("a real DRAG collects letters mid-stroke (tap can't)", `${selMid} letters`);
  else bad("a real DRAG collects letters mid-stroke (tap can't)");
  clickText("پایان نوبت");
  await sleep(800);
  if (B(`!!document.querySelector('.ps-recap')`)) ok("turn ends into the calm recap card");
  else bad("turn ends into the calm recap card");
  const go = bodyTxt().includes("نوبتِ نفر بعدی");
  if (go) ok("recap hands the turn over with «نوبتِ نفر بعدی»");
  else bad("recap hands the turn over with «نوبتِ نفر بعدی»");
}

console.log(`\n==== Z E2E: ${PASS} ok, ${FAIL} failed ====`);
process.exit(FAIL > 0 ? 1 : 0);
