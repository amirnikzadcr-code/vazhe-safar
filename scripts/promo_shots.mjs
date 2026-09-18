/* HH — Myket promo source shots (3x crisp):
 * home / map / play mid-drag ribbon / party turn ring. */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3311/";
const out = (p) => `/home/z/my-project/scripts/promo/${p}.png`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.setDefaultTimeout(12000);

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !document.querySelector(".sky-letters"), null, { timeout: 20000 });
await page.waitForTimeout(800);

/* first-entry name modal */
const nameInput = page.locator("input").first();
if (await nameInput.count()) {
  await nameInput.fill("سارا");
  await page.getByText("شروع سفرِ واژه‌ها").click();
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1200); /* home settles */
await page.screenshot({ path: out("home") });

/* map */
await page.locator(".play-big").click();
await page.waitForTimeout(1600);
await page.screenshot({ path: out("map") });

/* play + mid-drag golden ribbon over ر → و → ی («روی») */
await page.locator(".map-node.open").first().click();
await page.waitForSelector(".wheel-wrap .tile", { timeout: 9000 });
await page.waitForTimeout(700);
/* dismiss ch1 tutorial hand if it covers (tap once anywhere on wheel) */
const findTile = (ch) =>
  page.locator(".wheel-wrap .tile").filter({ hasText: ch }).first();
const r = await findTile("ر").boundingBox();
const v = await findTile("و").boundingBox();
const y = await findTile("ی").boundingBox();
if (r && v && y) {
  const cx = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  const a = cx(r), b2 = cx(v), c = cx(y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b2.x, b2.y, { steps: 12 });
  await page.mouse.move(c.x, c.y, { steps: 12 });
  await page.waitForTimeout(450); /* ribbon + guess strip fill */
  await page.screenshot({ path: out("play_drag") });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

/* party: home → دورهمی → دست‌به‌دست → setup → start → handoff → go */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !document.querySelector(".sky-letters"), null, { timeout: 20000 });
await page.waitForTimeout(1100);
await page.locator(".party-big").click();
await page.waitForTimeout(900);
await page.locator(".pm-card:not(.pm-wifi)").first().click();
await page.waitForTimeout(900);
await page.locator(".party-start").click();
await page.waitForTimeout(900);
await page.locator(".ps-hand-go").click();
await page.waitForSelector(".ps-ring, .wheel-wrap", { timeout: 9000 });
await page.waitForTimeout(1400); /* ring tiles pop in + timer starts */
await page.screenshot({ path: out("party_ring") });

console.log("PROMO_SHOTS_DONE");
await browser.close();
