import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
const OUT = join(process.cwd(), "out");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".ogg": "audio/ogg", ".json": "application/json", ".woff2": "font/woff2" };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let f = join(OUT, p);
  if (!existsSync(f)) f = join(OUT, "index.html");
  try { const b = readFileSync(f); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(3312, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto("http://localhost:3312/", { waitUntil: "networkidle" });
await page.waitForTimeout(3200);
const back = page.locator("button:has(svg)").first();
await back.click().catch(() => {});
await page.waitForTimeout(1100);
const shop = page.locator("text=فروشگاه").first();
if (await shop.isVisible({ timeout: 2000 }).catch(() => false)) {
  await shop.click(); await page.waitForTimeout(1600);
  const scrolled = await page.evaluate(() => {
    const els = [...document.querySelectorAll("*")].filter(e => e.scrollHeight > e.clientHeight + 80 && e.clientHeight > 300);
    if (!els.length) return "no scrollable";
    const el = els[els.length - 1];
    el.scrollTop = el.scrollHeight;
    return "scrolled " + el.className;
  });
  console.log(scrolled);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "scripts/kk_shop_end.png" });
}
await browser.close(); srv.close();
