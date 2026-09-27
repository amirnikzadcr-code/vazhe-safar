import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

const OUT = join(process.cwd(), "out");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".ogg": "audio/ogg", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let f = join(OUT, p);
  if (!existsSync(f)) f = join(OUT, "index.html");
  try {
    const b = readFileSync(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(b);
  } catch { res.writeHead(404); res.end(); }
});

await new Promise(r => srv.listen(3311, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR:", e.message));

await page.goto("http://localhost:3311/", { waitUntil: "networkidle" });
await page.waitForTimeout(3500); // splash
// welcome → maybe name modal → home
for (const txt of ["شروع سفر", "بریم", "ادامه", "شروع بازی"]) {
  const el = page.locator(`text=${txt}`).first();
  if (await el.isVisible({ timeout: 700 }).catch(() => false)) { await el.click().catch(() => {}); await page.waitForTimeout(900); }
}
await page.waitForTimeout(1200);
await page.screenshot({ path: "scripts/kk_home.png" });
// map → back to home (top-left round arrow)
const back = page.locator("button:has(svg)").first();
await back.click().catch(() => {});
await page.waitForTimeout(1300);
await page.screenshot({ path: "scripts/kk_home2.png" });
// open shop (bottom dock)
const shop = page.locator("text=فروشگاه").first();
if (await shop.isVisible({ timeout: 1500 }).catch(() => false)) {
  await shop.click(); await page.waitForTimeout(1600);
  await page.screenshot({ path: "scripts/kk_shop_top.png" });
  // scroll the shop panel to the bottom to see all cards
  const panel = page.locator(".shop2-cards, .shop2-list, [class*=shop2]").last();
  await page.mouse.wheel(0, 900); await page.waitForTimeout(600);
  await page.screenshot({ path: "scripts/kk_shop_mid.png" });
  await page.mouse.wheel(0, 900); await page.waitForTimeout(600);
  await page.screenshot({ path: "scripts/kk_shop_bottom.png" });
} else {
  console.log("shop button not found");
}
await browser.close();
srv.close();
console.log("QA shots done");
