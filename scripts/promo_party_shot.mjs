/* II — party ring shot only (pw-tile is the correct tile class) */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3311/";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !document.querySelector(".splash-sky"), null, { timeout: 25000 });
await page.waitForTimeout(900);
const nameInput = page.locator("input").first();
if (await nameInput.count()) {
  await nameInput.fill("سارا");
  await page.getByText("شروع سفرِ واژه‌ها").click();
  await page.waitForTimeout(1000);
}
await page.locator(".party-big").click();
await page.waitForTimeout(1100);
await page.locator(".pm-card:not(.pm-wifi)").first().click();
await page.waitForTimeout(1000);
await page.locator(".party-start").click();
await page.waitForTimeout(1000);
await page.locator(".ps-hand-go").click();
await page.waitForSelector(".ps-ring .pw-tile", { timeout: 15000 });
await page.waitForFunction(
  () => document.querySelectorAll(".ps-ring .pw-tile").length >= 9, null, { timeout: 10000 });
await page.waitForTimeout(2600);
await page.screenshot({ path: "/home/z/my-project/scripts/promo/party_ring.png" });
console.log("PARTY_SHOT_V2_DONE");
await browser.close();
