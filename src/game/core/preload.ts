/* ------------------------------------------------------------------
 *  واژه‌سفر — core/preload.ts
 *  v2.4 — SPLIT PRELOAD (user: «موقع لود کنده … صفحه آبی گیر میکنه چند
 *  ثانیه و بعدش با لگ لود میشه»):
 *   • CRITICAL_IMAGES — the small set the FIRST screens need. Preloaded
 *     + decoded during the splash with progress; splash finishes as soon
 *     as this set is done (fast boot on weak phones).
 *   • DEFERRED_IMAGES — chapter realm art + character poses. Loaded in
 *     gentle 2-at-a-time idle waves AFTER the game is interactive, so
 *     boot is never blocked and pages still paint instantly later.
 *  isDecoded() lets <img> backgrounds paint at FULL opacity on their
 *  very first render (synchronous check, zero flash).
 * ------------------------------------------------------------------ */

/** screen backgrounds — resident in the in-DOM ImgPool → page switches
 *  NEVER re-fetch or re-decode them (user: «هروقت جا ب جا میشی سریع باشن»)
 *  Y: +map2b (party setup) +sunset2b (party turn/recap) — the party
 *  screens used to decode their bg on first entry (fresh-install pop). */
export const SCREEN_BGS: string[] = [
  "/assets/bg/home3.webp",
  "/assets/bg/play3.webp",
  "/assets/bg/home2.webp",
  "/assets/bg/map2.webp",
  "/assets/bg/sunset2.webp",
  "/assets/bg/map2b.webp",
  "/assets/bg/sunset2b.webp",
];

/** everything the splash waits for: screen bgs + icons + first realms */
export const CRITICAL_IMAGES: string[] = [
  ...SCREEN_BGS,
  "/assets/img/logo_banner.webp",
  "/assets/img/coins.webp",
  "/assets/img/gear.webp",
  "/assets/img/shop.webp",
  "/assets/img/mission.webp",
  "/assets/img/books.webp",
  "/assets/img/tasks.webp",
  "/assets/img/bulb.webp",
  "/assets/img/swap.webp",
  "/assets/img/star.webp",
  "/assets/img/gift.webp",
  "/assets/img/grandpa.webp",
  "/assets/map/m01.webp",
  "/assets/map/m02.webp",
  "/assets/char/thumb.webp",
  "/assets/char/rest.webp",
  "/assets/char/seat.webp",
  "/assets/obj/chest.webp",
];

/** chapter realms m03..m20 + character poses — loaded AFTER boot.
 * v4 PERF (user: «گوشی داغ میکنه»): the 20 per-chapter PLAY backdrops
 * were removed from this set — decoding 41 large bitmaps back-to-back
 * right after boot burned CPU+GPU on phones for the first minute.
 * Each chapter's backdrop is now decoded lazily while its MAP is open
 * (MapScreen idle-prefetch), which is also when its music track decodes.
 * Realms load one at a time with idle gaps — invisible, gentle, cool. */
export const DEFERRED_IMAGES: string[] = [
  ...Array.from({ length: 18 }, (_, i) => `/assets/map/m${String(i + 3).padStart(2, "0")}.webp`),
  "/assets/char/hello.webp",
  "/assets/char/point.webp",
  "/assets/char/cheer.webp",
];

/** every image the game may ever show (used by the resident ImgPool) */
export const PRELOAD_IMAGES: string[] = [...SCREEN_BGS, ...CRITICAL_IMAGES.slice(SCREEN_BGS.length), ...DEFERRED_IMAGES];

const decoded = new Set<string>();

/** true → this src was already fetched AND decoded (stable first paint) */
export function isDecoded(src: string): boolean {
  return decoded.has(src);
}

/** Preload one image; resolves when fetched AND decoded. */
export function preloadImage(src: string): Promise<void> {
  if (decoded.has(src)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      decoded.add(src);
      resolve();
    };
    img.onload = () => { /* decode() may be missing on old webviews */
      if (typeof img.decode === "function") {
        img.decode().then(finish).catch(finish);
      } else finish();
    };
    img.onerror = finish; /* never block the game on a missing asset */
    img.decoding = "async";
    try { img.fetchPriority = "high"; } catch { /* older browsers */ }
    img.src = src;
    /* absolute safety net — 7s per image max */
    setTimeout(finish, 7000);
  });
}

/** Preload a list with progress callback (0..1). Never rejects.
 *  Loads in small parallel waves so weak phones never stall.
 *  `gapMs` — optional pause after each finished image (v4 heat guard:
 *  lets the CPU/GPU cool between big decodes in background loading). */
function preloadList(list: string[], wave: number, onProgress?: (p: number) => void, gapMs = 0): Promise<void> {
  let done = 0;
  const total = list.length;
  return new Promise((resolve) => {
    if (total === 0) { onProgress?.(1); resolve(); return; }
    let head = 0;
    const pump = () => {
      if (head >= total) { if (done >= total) resolve(); return; }
      const src = list[head++];
      preloadImage(src).then(() => {
        done++;
        onProgress?.(done / total);
        if (done >= total) resolve();
        else if (gapMs > 0) setTimeout(pump, gapMs);
        else pump();
      });
    };
    for (let i = 0; i < Math.min(wave, total); i++) pump();
  });
}

/** splash preload: CRITICAL set only (fast boot) */
export function preloadAssets(onProgress?: (p: number) => void): Promise<void> {
  return preloadList(CRITICAL_IMAGES, 6, onProgress);
}

/** post-boot background loading — ONE image at a time, with a breather
 * between images (v4: the old 2-wide non-stop wave kept the CPU+GPU
 * busy decoding big bitmaps for a full minute after boot → phones got
 * warm and the first minutes of play stuttered). Fire-and-forget. */
let deferredStarted = false;
export function startDeferredPreload(): void {
  if (deferredStarted) return;
  deferredStarted = true;
  const run = () => { void preloadList(DEFERRED_IMAGES, 1, undefined, 350); };
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => run(), { timeout: 2500 });
  else setTimeout(run, 1200);
}
