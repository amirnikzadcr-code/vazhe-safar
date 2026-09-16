/* ================================================================
 * y_e2e.mjs — session Y E2E (v1.24)
 *   A. splash: renders correctly (fonts!), holds ≥1.6s, smooth exit
 *   B. HUD: level chip NEVER overlaps the avatar; compact plate
 *   C. wheel: tiles ≤24% of wheel, ≥14px apart, wheel still big
 *   D. main-wheel ribbon draws during drag + guess strip builds live
 *   E. party: gibberish REJECTED, real word accepted, ribbon draws
 *   F. page-switch speed: every screen paints its key UI ≤1s, no errors
 *   G. assets: menu3.ogg shipped (menu2 gone), fa_words.txt ≥30k clean
 * Run: node scripts/y_e2e.mjs
 * ================================================================ */
import { execFileSync } from "child_process";

const ab = (cmd) => execFileSync("agent-browser", cmd.split(" "), { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0;
const ok = (m, x = "") => { PASS++; console.log(`  ✓ ${m} ${x}`); };
const bad = (m, x = "") => { FAIL++; console.log(`  ✗ ${m} ${x}`); };

/* P — evaluate a JS expression and NORMALIZE the result:
 * agent-browser prints the value JSON-encoded; strings stay strings.
 * Every object probe in this file goes through P (never bare EV). */
const P = (js) => {
  const raw = execFileSync("agent-browser", ["eval", js], { encoding: "utf8" }).trim();
  let v;
  try { v = JSON.parse(raw); } catch { v = raw; }
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* keep string */ } }
  return v;
};
const J = (obj) => P("JSON.stringify(" + obj + ")");
const B = (js) => P(js) === true; /* boolean probe */
const clickText = (txt) => EVclickText(txt);
function EVclickText(txt) {
  return P(`(function(){const els=[...document.querySelectorAll('button')];const el=els.find(e=>(e.innerText||'').includes('${txt}'));if(el){el.click();return '1'}return '0'})()`) === "1";
}
const clickAria = (label) => P(`(function(){const els=[...document.querySelectorAll('button')];const el=els.find(e=>(e.getAttribute('aria-label')||'').includes('${label}'));if(el){el.click();return '1'}return '0'})()`) === "1";
const txt = () => {
  const v = P(`document.body.innerText`);
  return typeof v === "string" ? v : "";
};
const tilesAt = (sel) => P(`JSON.stringify(Array.from(document.querySelectorAll('${sel}')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.textContent.trim(),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))`) || [];
function drag(path) {
  ab(`mouse move ${path[0].x} ${path[0].y}`);
  ab(`mouse down`);
  return new Promise((r) => {
    let i = 1;
    const step = () => {
      if (i < path.length) { ab(`mouse move ${path[i].x} ${path[i].y}`); i++; setTimeout(step, 65); }
      else { ab(`mouse up`); r(Date.now()); }
    };
    setTimeout(step, 65);
  });
}

/* ================= boot + A. SPLASH ================= */
console.log("— A. splash render + hold + exit");
const tOpen = Date.now();
ab(`open http://localhost:3000/`);
ab(`set viewport 360 740`);
await sleep(500);
{
  const s = P(`JSON.stringify((function(){
    const b=document.body.innerText;
    return {
      hint:b.indexOf('برای شروع آماده')>=0,
      title:!!document.querySelector('.title3d'),
      font800:document.fonts?document.fonts.check('800 40px Vazirmatn'):true,
      font700:document.fonts?document.fonts.check('700 16px Vazirmatn'):true,
      charImg:(function(){const i=document.querySelector('img');return !i||(i.complete&&i.naturalWidth>0)})()
    };
  })())`);
  if (s && s.hint && s.title) ok("splash scene renders (title + hint + progress)");
  else bad("splash scene renders", JSON.stringify(s));
  if (s && s.font800 && s.font700) ok("Vazirmatn ready during splash (no fallback flash)");
  else bad("Vazirmatn ready during splash", JSON.stringify(s));
  if (s && s.charImg) ok("splash character image already decoded");
  else bad("splash character image already decoded");
}
let sawOut = false, homeAt = 0;
for (let i = 0; i < 40; i++) {
  const st = P(`JSON.stringify({out:!!document.querySelector('.splash-out'),home:document.body.innerText.indexOf('شروع بازی')>=0||document.body.innerText.indexOf('شروع سفر')>=0})`);
  if (st && st.out) sawOut = true;
  if (st && st.home) { homeAt = Date.now(); break; }
  await sleep(120);
}
{
  const held = homeAt - tOpen;
  if (homeAt && held >= 1600) ok("splash holds ≥1.6s (visible branding)", `${held}ms`);
  else bad("splash holds ≥1.6s", `${held}ms`);
  if (sawOut) ok("splash exits through the smooth curtain (.splash-out)");
  else bad("splash exits through the smooth curtain");
}
P(`(function(){window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String(e.message||e))});return 'ok'})()`);
if (txt().includes("شروع سفر")) { clickText("شروع سفر"); await sleep(1200); }

/* ================= B. HUD ================= */
console.log("— B. HUD — compact, zero overlap");
{
  const r = P(`JSON.stringify((function(){
    const av=document.querySelector('.plate-avatar'); const chip=document.querySelector('.hud-lvl-chip');
    const plate=document.querySelector('.plate-unified');
    if(!av||!chip||!plate) return {err:'missing'};
    const a=av.getBoundingClientRect(), c=chip.getBoundingClientRect(), p=plate.getBoundingClientRect();
    const n=document.querySelector('.plate-name'); const nb=n?n.getBoundingClientRect():null;
    return {
      ix:Math.round(Math.min(a.right,c.right)-Math.max(a.left,c.left)),
      iy:Math.round(Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)),
      nx:nb?Math.round(Math.min(nb.right,c.right)-Math.max(nb.left,c.left)):0,
      ny:nb?Math.round(Math.min(nb.bottom,c.bottom)-Math.max(nb.top,c.top)):0,
      plateH:Math.round(p.height), chipH:Math.round(c.height)
    };
  })())`);
  if (!r || r.err) bad("HUD geometry measured", JSON.stringify(r));
  else {
    if (r.ix <= 0 || r.iy <= 0) ok("level chip does NOT overlap the avatar", `gap ${Math.max(r.ix, r.iy)}px`);
    else bad("level chip does NOT overlap the avatar", `overlap ${r.ix}x${r.iy}px`);
    if (r.nx <= 0 || r.ny <= 0) ok("level chip does NOT overlap the name");
    else bad("level chip does NOT overlap the name", `overlap ${r.nx}x${r.ny}px`);
    if (r.plateH <= 64) ok("plate is compact", `h=${r.plateH}px`);
    else bad("plate is compact", `h=${r.plateH}px`);
  }
}

/* ================= C+D. MAIN WHEEL ================= */
console.log("— C. main wheel geometry (smaller spaced tiles, big wheel)");
const enterAnyLevel = async () => {
  for (let t = 0; t < 10 && !B(`!!document.querySelector('.wheel-wrap')`); t++) {
    if (B(`!!document.querySelector('.ch-chip')`) || B(`!!document.querySelector('.map-node')`)) {
      /* map page → tap the first (next) level node */
      P(`(function(){const n=document.querySelector('.map-node');if(n){n.click();return '1'}return '0'})()`);
      await sleep(1500);
      continue;
    }
    clickText("شروع بازی");
    await sleep(1300);
  }
  return B(`!!document.querySelector('.wheel-wrap')`);
};
if (!(await enterAnyLevel())) bad("reached a level");
await sleep(700);
{
  const r = P(`JSON.stringify((function(){
    const w=document.querySelector('.wheel-wrap'); if(!w) return {err:'no wheel'};
    const wb=w.getBoundingClientRect();
    const tiles=[...w.querySelectorAll('[data-tile]')].map(t=>{const b=t.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,s:Math.round(b.width),fs:parseFloat(getComputedStyle(t).fontSize)}});
    let minGap=1e9, maxTile=0;
    for(let i=0;i<tiles.length;i++){maxTile=Math.max(maxTile,tiles[i].s);
      for(let j=i+1;j<tiles.length;j++){const d=Math.hypot(tiles[i].x-tiles[j].x,tiles[i].y-tiles[j].y)-Math.max(tiles[i].s,tiles[j].s);minGap=Math.min(minGap,d);}}
    return {wheel:Math.round(wb.width),tile:maxTile,gap:Math.round(minGap),n:tiles.length,glyph:Math.round(tiles[0].fs)};
  })())`);
  if (!r || r.err) bad("wheel measured", JSON.stringify(r));
  else {
    if (r.wheel >= 220) ok("wheel itself stays BIG", `${r.wheel}px`);
    else bad("wheel itself stays BIG", `${r.wheel}px`);
    if (r.tile <= 0.24 * r.wheel) ok("tiles smaller (≤24% of wheel)", `${r.tile}px on ${r.wheel}px`);
    else bad("tiles smaller (≤24% of wheel)", `${r.tile}px on ${r.wheel}px`);
    if (r.gap >= 14) ok("tiles spaced apart", `min gap ${r.gap}px`);
    else bad("tiles spaced apart", `min gap ${r.gap}px`);
    if (r.glyph >= 0.3 * r.tile) ok("glyphs still big inside smaller discs", `${r.glyph}px ≈ ${Math.round((r.glyph / r.tile) * 100)}%`);
    else bad("glyphs still big inside smaller discs", `${r.glyph}px vs tile ${r.tile}px`);
  }
}
console.log("— D. main-wheel ribbon + live guess strip");
{
  const tiles = tilesAt(`[data-tile]`);
  if (tiles.length >= 2) {
    const t0 = tiles[0], t1 = tiles[1];
    const dragP = drag([{ x: t0.x, y: t0.y }, { x: t0.x, y: t0.y }, { x: t0.x, y: t0.y }, { x: t0.x, y: t0.y }, { x: t1.x, y: t1.y }, { x: t1.x, y: t1.y }, { x: t1.x, y: t1.y }]);
    /* poll DURING the stroke until both letters are caught (CLI round-
     * trips stretch the timeline — never sleep-blind) */
    let mid = null;
    for (let i = 0; i < 30; i++) {
      await sleep(40);
      const s = P(`JSON.stringify((function(){
        const pts=document.querySelector('.wheel-wrap polyline');
        const g=document.querySelector('.guess-inner');
        return {ribbon:pts?pts.getAttribute('points'):'',guess:g?g.textContent:'',dragging:!!document.querySelector('.wheel-wrap.dragging')};
      })())`);
      if (s && (s.guess || "").length >= 2) { mid = s; break; }
      if (!mid && s && (s.guess || "").length === 1) mid = s; /* first sight fallback */
    }
    await dragP;
    await sleep(300);
    const after = P(`JSON.stringify({ribbon:(function(){const p=document.querySelector('.wheel-wrap polyline');return p?p.getAttribute('points'):''})()})`);
    if (mid && mid.ribbon && mid.ribbon.split(" ").length >= 2) ok("golden ribbon draws through the stroke", `word=«${mid.guess}» dragging=${mid.dragging}`);
    else bad("golden ribbon draws through the stroke", JSON.stringify(mid));
    if (mid && (mid.guess || "").length >= 2) ok("guess strip builds the word LIVE");
    else bad("guess strip builds the word LIVE", `«${mid && mid.guess}»`);
    if (!after || !after.ribbon || after.ribbon.split(" ").length < 2) ok("ribbon clears after release");
    else bad("ribbon clears after release", after.ribbon);
  } else bad("wheel tiles found", String(tiles.length));
}

/* ================= E. PARTY ================= */
console.log("— E. party — gibberish rejected, ribbon like the main game");
const goHomeFrom = async () => {
  for (let i = 0; i < 8; i++) {
    if (txt().includes("شروع بازی") && !txt().includes("واژه‌ات را اینجا بساز")) return true;
    if (B(`!!document.querySelector('.wheel-wrap')`)) {
      /* in a level → pause → exit to map → back */
      clickAria("تنظیمات");
      await sleep(600);
      clickText("خروج به نقشه");
      await sleep(900);
      clickAria("بازگشت");
      await sleep(800);
      continue;
    }
    if (B(`!!document.querySelector('.ps-ring')`) || B(`!!document.querySelector('.ps-podium')`) || B(`!!document.querySelector('.ps-hand-card')`) || B(`!!document.querySelector('.ps-recap')`)) {
      clickAria("خروج");
      await sleep(600);
      clickText("بله، به صفحهٔ اصلی");
      await sleep(800);
      continue;
    }
    if (B(`!!document.querySelector('.ch-chip')`)) { clickAria("بازگشت"); await sleep(800); continue; }
    clickAria("بازگشت");
    await sleep(700);
  }
  return txt().includes("شروع بازی");
};
await goHomeFrom();
await sleep(400);
clickText("بازی دورهمی");
await sleep(1300);
/* AB — the mode picker now fronts the party section */
if (B(`!!document.querySelector('.pm-cards')`)) { clickText("بازی با یک گوشی"); await sleep(900); }
clickText("۲ نفر");
await sleep(250);
clickText("شروع دورهمی!");
await sleep(1200);
clickText("شروع!");
await sleep(1500);
/* load the shipped lexicon into the page once, then probe pairs SYNC */
P(`(function(){fetch('/assets/dict/fa_words.txt').then(function(r){return r.text()}).then(function(t){window.__lex=t.split('\\n')});return '1'})()`);
let lexReady = false;
for (let i = 0; i < 20 && !lexReady; i++) { await sleep(200); lexReady = B(`Array.isArray(window.__lex)&&window.__lex.length>1000`); }
{
  if (lexReady) ok("shipped lexicon loads in-app");
  else bad("shipped lexicon loads in-app");

  const tilesRes = tilesAt(".pw-tile");
  if (!lexReady || tilesRes.length < 3) { bad("party pair probe", "no tiles/lex"); }
  else {
    if ((P(`window.__lex.length`) || 0) >= 30000) ok("shipped lexicon ≥30k words", `${P(`window.__lex.length`)}`);

    /* Z-FIX — judge pairs in NODE against the corpus AND the curated
     * runtime dictionaries: the app accepts a word if EITHER set has
     * it, so a corpus-only "nonsense" choice can be a real word
     * («بن» — the run where the probe lied). */
    const fs = await import("fs");
    const corpus = new Set(fs.readFileSync("/home/z/my-project/public/assets/dict/fa_words.txt", "utf8").split("\n").filter(Boolean));
    const dict = new Set();
    for (const f of ["dictionary.ts", "dictionary_extra.ts", "dictionary_party.ts"]) {
      const m = fs.readFileSync(`/home/z/my-project/src/game/data/${f}`, "utf8").match(/"([\u0600-\u06FF]+)"/g) || [];
      for (const w of m) dict.add(w.slice(1, -1));
    }
    const accepts = (w) => corpus.has(w) || dict.has(w);
    const tiles = tilesRes.map((t) => t.ch);
    let badP = null, goodP = null;
    outer:
    for (let i = 0; i < tiles.length; i++) for (let j = 0; j < tiles.length; j++) {
      if (i === j) continue;
      const w = tiles[i] + tiles[j];
      if (!accepts(w)) { if (!badP) badP = [i, j]; }
      else if (!goodP) goodP = [i, j];
      if (badP && goodP) break outer;
    }
    const mid = (p, q) => ({ x: Math.round((p.x + q.x) / 2), y: Math.round((p.y + q.y) / 2) });
    const glide = async (tA, tB) => {
      await drag([{ x: tA.x, y: tA.y }, { x: mid(tA, tB).x, y: mid(tA, tB).y }, { x: tB.x, y: tB.y }, { x: tB.x, y: tB.y }], 90);
    };

    if (badP) {
      const [i1, j1] = badP;
      const ts = await tilesAt(".pw-tile");
      /* start the glide but DON'T await it — the ribbon must be sampled
       * MID-STROKE (after the release both are cleared) */
      const gp = glide(ts[i1], ts[j1]);
      let midRibbon = null;
      for (let i = 0; i < 14; i++) {
        midRibbon = P(`(function(){return JSON.stringify({ribbon:(function(){const p=document.querySelector('.ps-ring polyline');return p?p.getAttribute('points'):''})(),dragging:!!document.querySelector('.ps-ring.dragging')})})()`);
        if (midRibbon && String(midRibbon.ribbon || "").split(" ").length >= 2) break;
        await sleep(60);
      }
      await gp;
      await sleep(800);
      const t = txt();
      if (midRibbon && String(midRibbon.ribbon || "").split(" ").length >= 2) ok("party ring draws the SAME golden ribbon while dragging", `dragging=${midRibbon.dragging}`);
      else bad("party ring draws the SAME golden ribbon while dragging", JSON.stringify(midRibbon));
      if (t.includes("پذیرفته نشد") || t.includes("قبلاً گفته شد")) ok("NONSENSE word rejected", `«${tiles[i1]}${tiles[j1]}»`);
      else bad("NONSENSE word rejected", `«${tiles[i1]}${tiles[j1]}» accepted?!`);
    } else bad("found a nonsense pair on the ring");

    if (goodP) {
      const [i1, j1] = goodP;
      const ts = await tilesAt(".pw-tile");
      await glide(ts[i1], ts[j1]);
      let tw = false;
      for (let i = 0; i < 12; i++) { if (B(`!!document.querySelector('.ps-tw')`)) { tw = true; break; } await sleep(160); }
      if (tw) ok("REAL word accepted", `«${tiles[i1]}${tiles[j1]}»`);
      else bad("REAL word accepted", `«${tiles[i1]}${tiles[j1]}»`);
    } else bad("found a real pair on the ring");
  }
}
ab(`screenshot /home/z/my-project/scripts/xaudit/y_party_ribbon.png`);

/* ================= F. PAGE-SWITCH SPEED ================= */
console.log("— F. page-switch speed + rendering");
await goHomeFrom();
await sleep(500);
{
  const hops = [
    ["ماموریت‌ها", ".panel"],
    ["فروشگاه", ".vz-page"],
  ];
  let allFast = true;
  const log = [];
  for (const [btn, sel] of hops) {
    const t0 = Date.now();
    clickText(btn);
    let found = 0;
    for (let i = 0; i < 20; i++) {
      await sleep(60);
      if (B(`!!document.querySelector('${sel}')`)) { found = Date.now() - t0; break; }
    }
    log.push(`${btn}:${found}ms`);
    if (!found || found > 1000) allFast = false;
    await sleep(350);
    clickAria("بازگشت");
    await sleep(550);
  }
  const t0 = Date.now();
  clickText("شروع بازی");
  let wheelAt = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(60);
    if (B(`!!document.querySelector('.wheel-wrap')`) || B(`!!document.querySelector('.map-node')`)) { wheelAt = Date.now() - t0; break; }
  }
  /* map → into the level itself (two hops, still one interaction chain) */
  if (wheelAt && !B(`!!document.querySelector('.wheel-wrap')`)) {
    const t1 = Date.now();
    P(`(function(){const n=document.querySelector('.map-node');if(n){n.click();return '1'}return '0'})()`);
    for (let i = 0; i < 20; i++) {
      await sleep(60);
      if (B(`!!document.querySelector('.wheel-wrap')`)) { wheelAt = Date.now() - t1; break; }
    }
  }
  log.push(`شروع بازی:${wheelAt}ms`);
  if (!wheelAt || wheelAt > 1000) allFast = false;
  if (allFast) ok("every page paints its key UI ≤1s", log.join("  "));
  else bad("every page paints its key UI ≤1s", log.join("  "));
}
await goHomeFrom();
await sleep(300);
clickText("بازی دورهمی");
await sleep(700);
if (B(`!!document.querySelector('.pm-cards')`)) { clickText("بازی با یک گوشی"); await sleep(900); }
{
  const r = P(`JSON.stringify((function(){
    const img=[...document.querySelectorAll('img.vz-fill')].find(function(i){return (i.src||'').indexOf('map2b')>=0});
    return {instant:!!img&&img.complete&&img.naturalWidth>0};
  })())`);
  if (r && r.instant) ok("party bg paints instantly on FIRST visit (resident pool)");
  else bad("party bg paints instantly on FIRST visit", JSON.stringify(r));
}
await goHomeFrom();
await sleep(300);
{
  const errs = P(`(window.__errs||[]).length`);
  if (errs === 0) ok("zero uncaught errors across the whole session");
  else bad("zero uncaught errors across the whole session", JSON.stringify(P(`JSON.stringify(window.__errs||[])`)));
}

/* ================= G. ASSETS ================= */
console.log("— G. shipped assets");
{
  const a = P(`JSON.stringify((function(){
    if(!window.__lex) return {err:'no lex loaded'};
    const set=new Set(window.__lex);
    const junk=['آآ','آارخیس','استرزی','میطیدانون','آباقا','آبافت','ژولپ','حسکا'].filter(function(w){return set.has(w)});
    const real=['سلام','کتاب','خورشید','مادر','بازی','واژه','دوست','آسمان','کوهستان'].filter(function(w){return !set.has(w)});
    return {lines:window.__lex.length,junk:junk,missingReal:real};
  })())`);
  if (a && !a.err) {
    if (a.lines >= 30000) ok("lexicon ≥30k clean words", `${a.lines}`);
    else bad("lexicon ≥30k clean words", `${a.lines}`);
    if (a.junk.length === 0) ok("known junk tokens are GONE from the lexicon");
    else bad("known junk tokens are GONE from the lexicon", JSON.stringify(a.junk));
    if (a.missingReal.length === 0) ok("all real probe words present");
    else bad("all real probe words present", JSON.stringify(a.missingReal));
  } else bad("lexicon probe", JSON.stringify(a));

  const m = P(`(function(){var x=new XMLHttpRequest();x.open('GET','/assets/music/menu6.ogg',false);x.send();return x.status+':'+x.getResponseHeader('content-length')})()`);
  const m3status = Number(String(m).split(":")[0]);
  const m3size = Number(String(m).split(":")[1] || 0);
  if (m3status === 200 && m3size > 100000) ok("new menu music shipped (menu6.ogg — calm mature semi-traditional)", `${Math.round(m3size / 1024)}KB`);
  else bad("new menu music shipped (menu6.ogg)", String(m));
  for (const old of ["menu2", "menu3", "menu4", "menu5"]) {
    const st = P(`(function(){var x=new XMLHttpRequest();x.open('GET','/assets/music/${old}.ogg',false);x.send();return x.status})()`);
    if (Number(st) === 404) ok(`old menu music deleted (${old}.ogg → 404)`);
    else bad(`old menu music deleted (${old}.ogg → 404)`, `status ${st}`);
  }
}

console.log(`\n==== Y E2E: ${PASS} ok, ${FAIL} failed ====`);
process.exit(FAIL > 0 ? 1 : 0);
