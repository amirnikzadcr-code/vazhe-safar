/* ------------------------------------------------------------------
 *  واژه‌سفر — core/preload.ts
 *  Aggressive asset preloading: every image is fetched + decoded
 *  during the splash screen with REAL progress, so no screen ever
 *  shows a half-loaded / popping-in image again.
 * ------------------------------------------------------------------ */

export const PRELOAD_IMAGES: string[] = [
  /* backgrounds */
  "/assets/bg/home2.webp",
  "/assets/bg/map2.webp",
  "/assets/bg/sunset2.webp",
  "/assets/bg/menu.webp",
  "/assets/bg/ch01.webp",
  "/assets/bg/ch02.webp",
  "/assets/bg/ch03.webp",
  "/assets/bg/ch04.webp",
  "/assets/bg/ch05.webp",
  "/assets/bg/ch06.webp",
  "/assets/bg/ch07.webp",
  "/assets/bg/ch08.webp",
  "/assets/bg/ch09.webp",
  "/assets/bg/ch10.webp",
  /* guide character (عمو دانا) */
  "/assets/char/seat.webp",
  "/assets/char/thumb.webp",
  "/assets/char/rest.webp",
  "/assets/char/hello.webp",
  "/assets/char/cheer.webp",
  "/assets/char/point.webp",
  /* objects */
  "/assets/obj/gift.webp",
  "/assets/obj/chest.webp",
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
