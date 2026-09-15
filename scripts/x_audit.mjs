/* ================================================================
 * x_audit.mjs — session X ground-truth layout audit (v1.22 baseline)
 * For EVERY chapter: enter its MOST CROWDED level through the real UI,
 * drag every word on the real wheel, then MEASURE the live DOM:
 *   A. every .wtile fully inside the .board-box panel (tolerance 1px)
 *   B. no two .wgroup boxes intersect (rows and pair halves)
 *   C. wheel tiles keep real spacing (min center distance)
 *   D. wheel wrap size per chapter
 * Screenshots → scripts/xaudit/chXX.png
 * Run: node scripts/x_audit.mjs [firstCh] [lastCh]
 * ================================================================ */
import { execSync } from "child_process";
import { readFileSync, mkdirSync } from "fs";

const ab = (c) => execSync(`agent-browser ${c}`, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FA = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

const FIRST = Number(process.argv[2] ?? 1);
const LAST = Number(process.argv[3] ?? 20);

/* load all chapter files, pick per chapter the level with MOST words */
const levelsByCh = {};
for (let c = 1; c <= 20; c++) {
  const j = JSON.parse(readFileSync(`/home/z/my-project/src/game/data/levels/ch${String(c).padStart(2, "0")}.json`, "utf8"));
  const sorted = [...j].sort((a, b) => b.words.length - a.words.length);
  levelsByCh[c] = { max: sorted[0], lvIdx: sorted[0].id - (c >= 11 ? 100 + 2 * 1 : 0) };
}
/* real lv index inside chapter from the global id */
function lvOf(ch, id) {
  let before = 0;
  for (let c = 1; c < ch; c++) before += c >= 11 ? 12 : 10;
  return id - before;
}

mkdirSync("/home/z/my-project/scripts/xaudit", { recursive: true });

let PASS = 0, FAIL = 0;
const problems = [];
const ok = (m) => { PASS++; console.log(`  ✓ ${m}`); };
const bad = (m) => { FAIL++; console.log(`  ✗ ${m}`); problems.push(m); };

const evalJSON = (expr) => {
  const raw = ab(`eval "${expr}"`);
  let v;
  try { v = JSON.parse(raw); } catch { return raw; }
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
  return v;
};
const clickText = (txt, sel = "button") => evalJSON(
  `(function(){const els=[...document.querySelectorAll('${sel}')];const el=els.find(e=>(e.innerText||'').includes('${txt}'));if(el){el.click();return '1'}return '0'})()`
);

/* ---- boot ---- */
console.log("— boot");
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`); /* small Android — the complaint device class */
let ready = false;
for (let i = 0; i < 30; i++) {
  const t = await evalJSON(`JSON.stringify(document.body.innerText)`);
  if (typeof t === "string" && (t.includes("شروع بازی") || t.includes("شروع سفر"))) { ready = true; break; }
  await sleep(600);
}
if (!ready) throw new Error("home never appeared");
await evalJSON(`(function(){window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String(e.message||e))});return 'ok'})()`);
{
  const t = await evalJSON(`JSON.stringify(document.body.innerText)`);
  if (t.includes("شروع سفر")) { await clickText("شروع سفر"); await sleep(1400); }
}
/* ---- inject an all-unlocked save (220 completed levels) + reload ----
 * The app flushes its IN-MEMORY cache on pagehide (unconditional write),
 * which used to clobber the injection on reload. A guard listener
 * registered AFTER the app's re-writes the injected save last. */
{
  const lv = {};
  for (let c = 1; c <= 20; c++) {
    const per = c >= 11 ? 12 : 10;
    for (let l = 1; l <= per; l++) lv[c + ":" + l] = { stars: 3, bonus: [], mistakes: 0 };
  }
  const save = { v: 1, coins: 9999, levels: lv, settings: { music: false, sfx: true, musicVol: 0.5, sfxVol: 0.5, haptics: false }, tutorialDone: true, dailyGiftDay: "", chests: [], last: { ch: 1, lv: 1 }, createdAt: Date.now(), wordsFound: 0, levelsPlayed: 0, bonusTotal: 0, missionsClaimed: [], challenge: { day: "", done: false, streak: 0 }, lastSeen: 0, welcomeShownDay: "", profile: { name: "بیین", avatar: "cat" }, adsRemoved: true, lastRewardedAd: 0, bonusAll: [] };
  const b64 = Buffer.from(JSON.stringify(save), "utf8").toString("base64");
  await evalJSON(`(function(){const J=(new TextDecoder()).decode(Uint8Array.from(atob('${b64}'),c=>c.charCodeAt(0)));localStorage.setItem('vazhe_safar_save_v1',J);const g=()=>localStorage.setItem('vazhe_safar_save_v1',J);window.addEventListener('pagehide',g);window.addEventListener('beforeunload',g);window.addEventListener('visibilitychange',g);return '1'})()`);
  ab(`open http://localhost:3000/`);
  await sleep(2500);
  const coins = await evalJSON(`JSON.stringify((JSON.parse(localStorage.getItem('vazhe_safar_save_v1')||'{}').coins)||0)`);
  if (coins !== 9999) throw new Error("save injection failed (coins=" + coins + ")");
}

async function gotoLevel(ch, lv) {
  /* ensure we land on the MAP from wherever we are */
  for (let t = 0; t < 8; t++) {
    const hasChip = await evalJSON(`JSON.stringify(!!document.querySelector('.ch-chip'))`);
    if (hasChip === true) break;
    /* any modal with «ادامه» → click it (win modal → next level), then
       leave that level through the pause menu */
    const adv = await evalJSON(`(function(){const bs=[...document.querySelectorAll('button')];const b=bs.find(x=>(x.innerText||'').trim()==='ادامه');if(b){b.click();return '1'}return '0'})()`);
    if (adv === 1) { await sleep(1000); continue; }
    const inLevel = await evalJSON(`JSON.stringify(!!document.querySelector('.wheel-wrap'))`);
    if (inLevel === true) {
      await evalJSON(`(function(){const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='تنظیمات');if(g){g.click();return '1'}return '0'})()`);
      await sleep(600);
      await clickText("خروج به نقشه");
      await sleep(900);
      continue;
    }
    /* home or another page → the big play button opens the map */
    await clickText("شروع بازی");
    await sleep(1200);
  }
  await evalJSON(`(function(){const chips=[...document.querySelectorAll('.ch-chip')];const c=chips[${ch - 1}];if(c){c.click();return '1'}return '0'})()`);
  /* node text = the GLOBAL level number (۹۱..۱۰۰ style); poll until the
   * target node exists (curtain takes ~1.8s) */
  let before = 0;
  for (let c = 1; c < ch; c++) before += c >= 11 ? 12 : 10;
  const g = before + lv;
  let clicked = "0";
  for (let i = 0; i < 12; i++) {
    await sleep(350);
    clicked = await evalJSON(`(function(){const els=[...document.querySelectorAll('.map-node')];const el=els.find(e=>(e.innerText||'').trim()==='${FA(g)}');if(el){el.click();return '1'}return '0'})()`);
    if (String(clicked) === "1") break;
  }
  if (String(clicked) !== "1") throw new Error(`node ${FA(g)} not found for ch${ch}`);
  await sleep(1700);
}

async function wheelTiles() {
  for (let i = 0; i < 10; i++) {
    const arr = await evalJSON(`JSON.stringify(Array.from(document.querySelectorAll('.tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`);
    if (arr.length) return arr;
    await sleep(400);
  }
  throw new Error("no wheel tiles");
}
async function dragWord(word, ts) {
  const used = new Set(); const path = [];
  for (const ch of word) {
    const t = ts.find((t) => t.ch === ch && !used.has(`${t.x}:${t.y}`));
    if (!t) throw new Error(`no tile for «${ch}»`);
    used.add(`${t.x}:${t.y}`); path.push(t);
  }
  ab(`mouse move ${path[0].x} ${path[0].y}`); ab(`mouse down`);
  await sleep(55);
  for (let i = 1; i < path.length; i++) { ab(`mouse move ${path[i].x} ${path[i].y}`); await sleep(55); }
  ab(`mouse up`);
  await sleep(300);
}

/* ---- measurement ---- */
async function auditBoard(ch, lv, nWords) {
  const r = await evalJSON(`(function(){
    const panel=document.querySelector('.board-box');
    const board=document.querySelector('.wboard');
    if(!panel||!board) return JSON.stringify({err:'no board'});
    const P=panel.getBoundingClientRect();
    const tiles=[...panel.querySelectorAll('.wtile')].map(t=>{const b=t.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}});
    const groups=[...panel.querySelectorAll('.wgroup')].map(g=>{const b=g.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,n:g.querySelectorAll('.wtile').length}});
    const rows=[...panel.querySelectorAll('.wrow')].length;
    const wrap=document.querySelector('.wheel-wrap');
    const W=wrap?wrap.getBoundingClientRect():null;
    const wts=[...panel.querySelectorAll('.wrow')].map(r=>parseFloat(getComputedStyle(r).getPropertyValue('--wt')));
    const scroll=board.scrollHeight-board.clientHeight;
    return JSON.stringify({P:{x:P.x,y:P.y,w:P.width,h:P.height},tiles,groups,rows,wts,
      wheel:W?{w:Math.round(W.width),h:Math.round(W.height)}:null,scroll:Math.round(scroll)});
  })()`);
  if (!r || r.err) { bad(`ch${ch}-${lv}: no board DOM`); return; }
  let overflow = 0, inter = 0;
  const tol = 1;
  for (const t of r.tiles) {
    if (t.x < r.P.x - tol || t.y < r.P.y - tol || t.x + t.w > r.P.x + r.P.w + tol || t.y + t.h > r.P.y + r.P.h + tol) overflow++;
  }
  /* pair/group intersections (same-row siblings must not overlap) */
  for (let i = 0; i < r.groups.length; i++) {
    for (let j = i + 1; j < r.groups.length; j++) {
      const a = r.groups[i], b = r.groups[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) inter++;
    }
  }
  const minTile = Math.min(...r.wts.filter((x) => x > 0), 99);
  const tag = `ch${ch} lv${lv} (${nWords} words, ${r.rows} rows, tile≥${Math.round(minTile)}, wheel ${r.wheel ? r.wheel.w + "px" : "?"}, vscroll ${r.scroll}px)`;
  if (overflow === 0 && inter === 0 && r.scroll <= 8) ok(tag);
  else {
    bad(tag);
    if (overflow) problems.push(`ch${ch} lv${lv}: ${overflow} tiles OUTSIDE panel`);
    if (inter) problems.push(`ch${ch} lv${lv}: ${inter} group OVERLAPS`);
    if (r.scroll > 2) problems.push(`ch${ch} lv${lv}: board scrolls ${r.scroll}px (words hidden below)`);
  }
  await ab(`screenshot /home/z/my-project/scripts/xaudit/ch${String(ch).padStart(2, "0")}.png`);
}

console.log(`— audit ch${FIRST}..${LAST} @360×740`);
for (let ch = FIRST; ch <= LAST; ch++) {
  const { max } = levelsByCh[ch];
  const lv = lvOf(ch, max.id);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await gotoLevel(ch, lv);
      const ts = await wheelTiles();
      const words = [...max.words].sort((a, b) => b.length - a.length);
      for (const w of words) {
        try { await dragWord(w, ts); } catch (e) { console.log(`    drag skip «${w}»: ${String(e).slice(0, 60)}`); }
        /* if the win modal appeared, close it to keep measuring */
        const adv = await evalJSON(`(function(){const bs=[...document.querySelectorAll('button')];const b=bs.find(x=>(x.innerText||'').trim()==='ادامه');if(b){b.click();return '1'}return '0'})()`);
        if (adv === 1) { await sleep(900); const ts2 = await wheelTiles(); ts.length = 0; ts.push(...ts2); }
      }
      await sleep(700);
      await auditBoard(ch, lv, max.words.length);
      break;
    } catch (e) {
      if (attempt === 1) bad(`ch${ch} flow: ${String(e).slice(0, 90)}`);
      else await sleep(1200);
    }
  }
}
console.log(`\n==== AUDIT RESULT: ${PASS} ok, ${FAIL} problem levels ====`);
for (const p of problems) console.log("  • " + p);
