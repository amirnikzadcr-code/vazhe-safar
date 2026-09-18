/* HH — Myket promo composer:
 * 4 phone promos 1080×1920 + feature banner 1024×500, real screenshots,
 * عمو دانا as the presenter, Persian copy in Vazirmatn. */
import { chromium } from "playwright";
import fs from "node:fs";

const ROOT = "/home/z/my-project";
const P = `${ROOT}/scripts/promo`;
const OUT = `${ROOT}/download/myket_promo`;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(`${P}/compose`, { recursive: true });

/* stage assets next to the HTML (relative paths, no CORS drama) */
for (const f of ["Vazirmatn-ExtraBold.woff2", "Vazirmatn-Bold.woff2", "Vazirmatn-Medium.woff2"])
  fs.copyFileSync(`${ROOT}/public/assets/fonts/${f}`, `${P}/compose/${f}`);
for (const f of ["hello", "cheer", "point", "thumb", "rest", "seat"])
  fs.copyFileSync(`${ROOT}/public/assets/char/${f}.webp`, `${P}/compose/${f}.webp`);
fs.copyFileSync(`${ROOT}/public/assets/img/logo_banner.webp`, `${P}/compose/logo.webp`);
for (const f of ["home", "map", "play_drag", "party_ring"])
  fs.copyFileSync(`${P}/${f}.png`, `${P}/compose/${f}.png`);

const CSS = `
@font-face { font-family:"V"; src:url("Vazirmatn-ExtraBold.woff2") format("woff2"); font-weight:800; }
@font-face { font-family:"V"; src:url("Vazirmatn-Bold.woff2") format("woff2"); font-weight:700; }
@font-face { font-family:"V"; src:url("Vazirmatn-Medium.woff2") format("woff2"); font-weight:500; }
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:540px; height:960px; overflow:hidden; }
body {
  font-family:"V", sans-serif; direction:rtl; position:relative;
  background:
    radial-gradient(46% 26% at 18% 6%, rgba(255,243,190,.95) 0%, rgba(255,231,140,0) 70%),
    radial-gradient(90% 30% at 50% 104%, #dff3c8 0%, rgba(223,243,200,0) 62%),
    linear-gradient(180deg,#7ec8f5 0%, #a8dcf9 40%, #cdeef7 68%, #e6f6da 100%);
}
.cloud { position:absolute; background:#fff; border-radius:999px; opacity:.85; }
.cloud::before, .cloud::after { content:""; position:absolute; background:#fff; border-radius:999px; }
.cloud::before { width:52%; height:150%; top:-62%; right:12%; }
.cloud::after  { width:38%; height:110%; top:-42%; right:52%; }
.fl { position:absolute; font-weight:800; color:#2f6d9e; opacity:.16; }
.shot {
  position:absolute; width:452px; height:588px; border-radius:26px; overflow:hidden;
  border:7px solid #fff; outline:4px solid #e8b53c;
  box-shadow:0 22px 34px rgba(20,40,80,.35);
}
.shot img { display:block; width:100%; }
.shot img.crop-home { margin-top:-7%; }
.shot img.crop-map { margin-top:-12%; }
.shot img.crop-play { margin-top:-15%; }
.shot img.crop-party { margin-top:-30%; }
.char { position:absolute; z-index:9; filter:drop-shadow(0 10px 14px rgba(10,30,60,.28)); }
.bubble {
  position:absolute; z-index:10; background:#fffdf2; border:3px solid #e8b53c;
  border-radius:18px; padding:10px 14px 11px; max-width:300px;
  font-size:15px; font-weight:700; color:#5d3a12; line-height:1.9;
  box-shadow:0 8px 16px rgba(80,40,0,.18);
}
.bubble::after {
  content:""; position:absolute; bottom:-13px; right:34px; width:20px; height:20px;
  background:#fffdf2; border-left:3px solid #e8b53c; border-bottom:3px solid #e8b53c;
  transform:rotate(-55deg) skewX(-12deg);
}
.head { position:absolute; top:26px; right:0; left:0; text-align:center; z-index:5; }
.head h1 {
  font-size:41px; font-weight:800; color:#fff; letter-spacing:-.5px;
  text-shadow:0 3px 0 #b8860b, 0 7px 16px rgba(90,40,0,.45);
}
.head p { margin-top:9px; font-size:17.5px; font-weight:700; color:#23455f; }
.chips { position:absolute; z-index:8; display:flex; gap:9px; justify-content:center; right:0; left:0; top:146px; }
.chip {
  background:rgba(255,255,255,.94); border:2.5px solid #e8b53c; color:#7a4a00;
  font-size:14.5px; font-weight:800; padding:6px 14px 8px; border-radius:999px;
  box-shadow:0 5px 10px rgba(80,40,0,.16);
}
.cta {
  position:absolute; z-index:8; right:28px; left:28px; bottom:26px; height:66px;
  background:linear-gradient(180deg,#ffb52e,#f08a00); border-radius:20px;
  border:3px solid #fff; outline:4px solid #d98a12;
  box-shadow:0 12px 22px rgba(140,70,0,.35), inset 0 3px 0 rgba(255,255,255,.5);
  display:flex; align-items:center; justify-content:center; gap:14px;
  color:#fff; font-size:23px; font-weight:800;
  text-shadow:0 2px 0 rgba(120,50,0,.5);
}
.cta small {
  background:#1c8a43; border:2px solid #fff; color:#fff; font-size:14px; font-weight:800;
  padding:4px 12px 6px; border-radius:999px; text-shadow:none;
}
.logo { position:absolute; z-index:8; right:0; left:0; display:flex; justify-content:center; }
`;
const fl = Array.from({ length: 7 }, (_, i) =>
  `<span class="fl" style="right:${18 + i * 71}px; bottom:${90 + (i % 3) * 260}px; font-size:${19 + (i % 3) * 9}px">${["ا","ب","پ","ت","س","ک","گ"][i]}</span>`).join("");
const clouds = `
  <div class="cloud" style="width:150px;height:38px;top:130px;left:-34px"></div>
  <div class="cloud" style="width:110px;height:30px;top:330px;right:-30px;opacity:.65"></div>
  <div class="cloud" style="width:130px;height:34px;top:610px;left:-40px;opacity:.7"></div>`;

function promo({ title, sub, shot, crop, char, charStyle, bubble, chips, bubbleStyle }) {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  ${clouds}${fl}
  <div class="head"><h1>${title}</h1><p>${sub}</p></div>
  <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
  <div class="shot" style="top:196px; left:50%; margin-left:-226px; transform:rotate(-2deg)">
    <img class="${crop || ""}" src="${shot}.png" alt="">
  </div>
  <img class="char" src="${char}.webp" style="${charStyle}" alt="">
  <div class="bubble" style="${bubbleStyle}">${bubble}</div>
  <div class="cta">همین حالا رایگان بازی کن! <small>مایکت</small></div>
</body></html>`;
}

const pages = {
  "1-intro": promo({
    title: "سفرِ شیرینِ واژه‌ها!",
    sub: "با عمو دانا همراه شو؛ حروف را بچین و سرزمین‌ها را روشن کن",
    shot: "home", crop: "crop-home", char: "hello",
    charStyle: "width:212px; bottom:74px; left:2px;",
    bubble: "سلام! من عمو دانا‌م؛ هر واژه‌ای که بسازی، یک قدم به سفر نزدیک‌تر می‌شوی!",
    bubbleStyle: "bottom:414px; right:16px; max-width:270px;",
    chips: ["۲۰ فصل", "۲۰۰ مرحله", "کاملاً فارسی"],
  }),
  "2-gameplay": promo({
    title: "با کشیدن حروف، واژه بساز",
    sub: "ساده برای شروع، اعتیادآور برای ادامه!",
    shot: "play_drag", crop: "crop-play", char: "thumb",
    charStyle: "width:196px; bottom:70px; left:2px;",
    bubble: "انگشتت را روی حروف بکش… واژه‌های پنهان را پیدا کنی سکه جایزه می‌گیری!",
    bubbleStyle: "bottom:400px; right:14px; max-width:262px;",
    chips: ["هزاران واژهٔ پنهان", "راهنمای هوشمند"],
  }),
  "3-party": promo({
    title: "دورهمی با دوستان!",
    sub: "نوبتی روی یک گوشی یا هم‌زمان با وای‌فای",
    shot: "party_ring", crop: "crop-party", char: "rest",
    charStyle: "width:196px; bottom:74px; left:2px;",
    bubble: "دورهمی رو از دست نده! هر واژه‌ای که زودتر بسازی مالِ توئه!",
    bubbleStyle: "bottom:408px; right:14px; max-width:262px;",
    chips: ["تا ۴ بازیکن", "چرخِ طلایی", "رقابت دوستانه"],
  }),
  "4-journey": promo({
    title: "۲۰ سرزمین تازه در راه است",
    sub: "از باغِ بهاری تا کاخِ شب‌تاب… هر فصل یک دنیای نو",
    shot: "map", crop: "crop-map", char: "point",
    charStyle: "width:208px; bottom:72px; left:2px;",
    bubble: "هر فصل یک سرزمین تازه با موسیقی و نقاشی‌های خودش — کجای سفر هستی؟",
    bubbleStyle: "bottom:404px; right:12px; max-width:272px;",
    chips: ["۲۰ موسیقی اختصاصی", "ستاره جمع کن"],
  }),
};

/* feature banner 1024×500 (viewport 512×250 @2x) */
const bannerCSS = CSS.replace("html,body { width:540px; height:960px; overflow:hidden; }",
  "html,body { width:512px; height:250px; overflow:hidden; }");
const banner = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${bannerCSS}
.logo img { width:296px; }
.head { top:14px; } .head h1 { font-size:30px; } .head p { font-size:14px; margin-top:5px; }
.cta { right:auto; left:14px; bottom:16px; width:196px; height:44px; font-size:15.5px; border-radius:13px; gap:10px; }
.char { z-index:9; }
</style></head><body>
  ${clouds}
  <div class="head"><h1>واژه‌سفر — کلمه بساز؛ حال خوب بچین</h1><p>۲۰۰ مرحله، ۲۰ سرزمین و بازیِ دورهمی با دوستان</p></div>
  <div class="logo" style="top:96px"><img src="logo.webp" alt=""></div>
  <img class="char" src="hello.webp" style="width:132px; bottom:-10px; right:10px" alt="">
  <img class="char" src="point.webp" style="width:118px; bottom:-8px; right:118px" alt="">
  <img class="char" src="thumb.webp" style="width:112px; bottom:-8px; left:224px" alt="">
  <div class="cta">دانلود رایگان <small>مایکت</small></div>
</body></html>`;

for (const [name, html] of Object.entries(pages)) fs.writeFileSync(`${P}/compose/${name}.html`, html);
fs.writeFileSync(`${P}/compose/banner-feature.html`, banner);

const browser = await chromium.launch();
const shoot = async (name, w, h) => {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await pg.goto(`file://${P}/compose/${name}.html`);
  await pg.waitForTimeout(450); /* fonts settle */
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  await pg.close();
  console.log("done", name);
};
for (const name of Object.keys(pages)) await shoot(name, 540, 960);
await shoot("banner-feature", 512, 250);
await browser.close();
console.log("ALL_PROMOS_DONE ->", OUT);
