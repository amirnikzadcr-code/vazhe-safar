/* HH smoke v2: full first-entry flow — name modal → home → map →
 * play, verifying the lobby track is the fetched menu music. */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3311/";
const out = (p) => `/home/z/my-project/scripts/hh_${p}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const oggs = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.url().includes("/assets/music/")) oggs.push(r.url().split("/music/")[1]); });

const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".sky-letters b", { timeout: 4000 });
await page.screenshot({ path: out("splash") });
await page.waitForFunction(
  () => !document.querySelector(".sky-letters"), null, { timeout: 15000 },
);
const bootMs = Date.now() - t0;

/* first entry → name modal */
await page.waitForTimeout(700);
const nameInput = page.locator("input").first();
if (await nameInput.count()) {
  await nameInput.fill("تستر");
  await page.getByText("شروع سفرِ واژه‌ها").click();
  await page.waitForTimeout(700);
}
await page.screenshot({ path: out("home") });

/* home → map */
await page.locator(".play-big").click();
await page.waitForTimeout(1000);
await page.screenshot({ path: out("map") });

/* map → first open level */
await page.locator(".map-node.open").first().click();
await page.waitForSelector(".wheel-wrap", { timeout: 8000 });
await page.waitForTimeout(500);
const tiles = await page.locator(".tile").count();
await page.screenshot({ path: out("play") });

console.log(JSON.stringify({ bootMs, tiles, oggs: [...new Set(oggs)], errors: errors.slice(0, 5) }, null, 1));
await browser.close();
