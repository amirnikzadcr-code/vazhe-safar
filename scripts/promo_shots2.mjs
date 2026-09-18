/* II — promo source shots v2: FULL crisp screens, nothing cropped.
 * home / map / play mid-drag golden ribbon / party turn ring (fully rendered).
 * Runs against the live dev server on :3000, 390x844 @3x. */
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
page.setDefaultTimeout(20000);

const boot = async () => {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector(".sky-letters"), null, { timeout: 25000 });
  await page.waitForTimeout(900);
};

await boot();

/* first-entry name modal */
const nameInput = page.locator("input").first();
if (await nameInput.count()) {
  await nameInput.fill("سارا");
  await page.getByText("شروع سفرِ واژه‌ها").click();
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(1500); /* home fully settles */
await page.screenshot({ path: out("home") });
console.log("shot home");

/* map — wait for nodes to pop in */
await page.locator(".play-big").click();
await page.waitForTimeout(2200);
await page.screenshot({ path: out("map") });
console.log("shot map");

/* play + mid-drag golden ribbon over ر → و → ی («روی») */
await page.locator(".map-node.open").first().click();
await page.waitForSelector(".wheel-wrap .tile", { timeout: 12000 });
await page.waitForTimeout(900);
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
  await page.mouse.move(b2.x, b2.y, { steps: 14 });
  await page.mouse.move(c.x, c.y, { steps: 14 });
  await page.waitForTimeout(550); /* ribbon + guess strip fill */
  await page.screenshot({ path: out("play_drag") });
  await page.mouse.up();
  await page.waitForTimeout(500);
  console.log("shot play_drag");
}

/* party: home → دورهمی → دست‌به‌دست → setup → start → handoff → TURN screen with FULL ring */
await page.reload({ waitUntil: "domcontentloaded" });
await boot();
await page.locator(".party-big").click();
await page.waitForTimeout(1100);
await page.locator(".pm-card:not(.pm-wifi)").first().click();
await page.waitForTimeout(1000);
await page.locator(".party-start").click();
await page.waitForTimeout(1000);
await page.locator(".ps-hand-go").click();
await page.waitForSelector(".ps-ring .tile", { timeout: 12000 });
/* wait until ALL 9 ring tiles are rendered */
await page.waitForFunction(
  () => document.querySelectorAll(".ps-ring .tile").length >= 9, null, { timeout: 10000 });
await page.waitForTimeout(2600); /* turn banner fades + timer running + found panel visible */
await page.screenshot({ path: out("party_ring") });
console.log("shot party_ring");

console.log("PROMO_SHOTS_V2_DONE");
await browser.close();
