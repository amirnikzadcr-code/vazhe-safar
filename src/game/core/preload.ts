/* ------------------------------------------------------------------
 *  واژه‌سفر — core/preload.ts
 *  Aggressive asset preloading: every image is fetched + decoded
 *  during the splash screen with REAL progress, so no screen ever
 *  shows a half-loaded / popping-in image again.
 *  v1.12: SLIM list — only the three main screens' art. Inner
 *  screens lazy-load their own images (faster first launch).
 * ------------------------------------------------------------------ */

export const PRELOAD_IMAGES: string[] = [
  /* main screens */
  "/assets/bg/home3.webp",
  "/assets/bg/play3.webp",
  "/assets/map/m01.webp",
  /* reference icon set */
  "/assets/img/logo_banner.png",
  "/assets/img/grandpa.png",
  "/assets/img/shop.png",
  "/assets/img/mission.png",
  "/assets/img/chest.png",
  "/assets/img/house.png",
  "/assets/img/books.png",
  "/assets/img/tasks.png",
  "/assets/img/gift.png",
  "/assets/img/bulb.png",
  "/assets/img/swap.png",
  "/assets/img/star.png",
  "/assets/img/gear.png",
  "/assets/img/coins.png",
];

const decoded = new Set<string>();

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

/** Preload everything with progress callback (0..1). Never rejects. */
export function preloadAssets(onProgress?: (p: number) => void): Promise<void> {
  let done = 0;
  const total = PRELOAD_IMAGES.length;
  return new Promise((resolve) => {
    if (total === 0) { onProgress?.(1); resolve(); return; }
    for (const src of PRELOAD_IMAGES) {
      preloadImage(src).then(() => {
        done++;
        onProgress?.(done / total);
        if (done >= total) resolve();
      });
    }
  });
}
