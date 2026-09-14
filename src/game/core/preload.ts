/* ------------------------------------------------------------------
 *  واژه‌سفر — core/preload.ts
 *  v2.2 — TOTAL PRELOAD: every image the game will ever show is
 *  fetched + decoded during the splash screen. Screens then mount
 *  with the image ALREADY in the decode cache → no blue flash, no
 *  "صفحات دیر میاد", no popping-in art on weak phones.
 *  isDecoded() lets <img> backgrounds paint at FULL opacity on their
 *  very first render (synchronous check, zero flash).
 * ------------------------------------------------------------------ */

export const PRELOAD_IMAGES: string[] = [
  /* screen backgrounds */
  "/assets/bg/home3.webp",
  "/assets/bg/play3.webp",
  "/assets/bg/home2.webp",
  "/assets/bg/map2.webp",
  "/assets/bg/sunset2.webp",
  /* map realms (all 10 chapters) */
  ...Array.from({ length: 10 }, (_, i) => `/assets/map/m${String(i + 1).padStart(2, "0")}.webp`),
  /* UI icon set */
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
  /* guide character */
  "/assets/char/thumb.webp",
  "/assets/char/rest.webp",
  "/assets/char/seat.webp",
];

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

/** Preload everything with progress callback (0..1). Never rejects.
 *  Loads in small parallel waves so weak phones never stall. */
export function preloadAssets(onProgress?: (p: number) => void): Promise<void> {
  const list = [...PRELOAD_IMAGES];
  let done = 0;
  const total = list.length;
  return new Promise((resolve) => {
    if (total === 0) { onProgress?.(1); resolve(); return; }
    const WAVE = 6;
    let head = 0;
    const pump = () => {
      if (head >= total) { if (done >= total) resolve(); return; }
      const src = list[head++];
      preloadImage(src).then(() => {
        done++;
        onProgress?.(done / total);
        if (done >= total) resolve();
        else pump();
      });
    };
    for (let i = 0; i < Math.min(WAVE, total); i++) pump();
  });
}
