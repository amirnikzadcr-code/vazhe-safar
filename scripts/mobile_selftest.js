/* eslint-disable @typescript-eslint/no-require-imports */
// mobile_selftest.js — v4 mobile-emulated QA (CPU 4x throttle = weak phone)
// Verifies: boot speed, no console errors, word-guess flow, page transitions,
// party screen (pool badge + word count), XP bars use scaleX (no width anim).
const { chromium, devices } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices["Pixel 5"],
    isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();

  // 4x CPU slowdown → emulates a weak phone
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  const t0 = Date.now();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

  // boot shell must paint instantly (server-rendered)
  const shellVisible = await page.locator(".boot-shell").isVisible().catch(() => false);

  // wait for boot (React splash auto-finishes → name-ask modal or home)
  await page.waitForTimeout(3500);
  const bootMs = Date.now() - t0;

  // name ask (fresh save) — dialog may appear slightly after home under throttle
  for (let i = 0; i < 5; i++) {
    const inp = page.locator("input").first();
    if (!(await inp.count())) break;
    await inp.fill("تستر").catch(() => {});
    await page.locator("button", { hasText: "شروع سفر" }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    if (!(await page.locator('[role="dialog"]').count())) break;
  }

  const homeOk = await page.locator("text=مرحله بعدی").count();
  console.log("shellVisible:", shellVisible, "| bootMs:", bootMs, "| homeOk:", homeOk > 0);

  // ---- enter level 1 (word-guess path under throttle) ----
  await page.locator("text=مرحله بعدی").first().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(900);
  // tap the first unlocked level node on the map (مرحله ۱)
  await page.locator("button[aria-label='مرحله ۱']").first().click({ force: true, timeout: 8000 }).catch(() => {});
  await page.waitForSelector(".wheel-wrap", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const playVisible = await page.locator(".wheel-wrap").count();
  console.log("playVisible:", playVisible > 0);

  // measure long tasks during a scripted word drag on the wheel
  await cdp.send("Performance.enable");
  const tDrag0 = Date.now();
  // find a valid short word by trying drags across the wheel tiles
  const tiles = await page.locator(".tile").all();
  console.log("tiles:", tiles.length);
  if (tiles.length >= 3) {
    const b0 = await tiles[0].boundingBox();
    const b1 = await tiles[1].boundingBox();
    const b2 = await tiles[2].boundingBox();
    const cx = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    const p0 = cx(b0), p1 = cx(b1), p2 = cx(b2);
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(p0.x + ((p1.x - p0.x) * i) / 6, p0.y + ((p1.y - p0.y) * i) / 6);
      await page.waitForTimeout(12);
    }
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(p1.x + ((p2.x - p1.x) * i) / 6, p1.y + ((p2.y - p1.y) * i) / 6);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(1200);
  const dragMs = Date.now() - tDrag0;

  // check no width-animated bars: XP fill must carry --p custom prop now
  const xpFill = page.locator(".plate-xpbar > i").first();
  const xpStyle = (await xpFill.count()) ? await xpFill.getAttribute("style", { timeout: 5000 }).catch(() => "") : "";
  console.log("xpFillStyle:", xpStyle);

  // ---- navigation speed: play -> map -> home under throttle ----
  const navT0 = Date.now();
  // back to map via exit button if present (gear → خروج), simpler: reload-less route taps
  await page.locator("button[aria-label='تنظیمات']").first().click({ force: true, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.locator("text=خروج به نقشه").first().click({ force: true, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.locator("button[aria-label='بازگشت']").first().click({ force: true, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const navMs = Date.now() - navT0;
  console.log("navMs:", navMs);

  // ---- party screen: pool badge ----
  await page.locator("text=دورهمی").first().click();
  await page.waitForTimeout(600);
  const badge = await page.locator("text=واژهٔ فارسی در چرخِ دورهمی").count();
  const badgeText = badge ? await page.locator(".ps-pool-badge").first().innerText() : "";
  console.log("partyBadge:", badgeText);

  // back home
  await page.locator("button[aria-label='بازگشت']").first().click({ force: true, timeout: 8000 }).catch(() => {});
  await page.locator("button[aria-label='خروج']").first().click({ force: true, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  const metrics = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.metrics.map((x) => [x.name, x.value]));
  console.log("METRICS layoutCount:", m.LayoutCount, "recalcStyle:", m.RecalcStyleCount,
    "nodes:", m.Nodes, "JSHeapMB:", Math.round(m.JSHeapUsedSize / 1048576));

  console.log("ERRORS:", errors.length ? errors.slice(0, 8) : "none");
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
