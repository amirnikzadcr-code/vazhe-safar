/* ------------------------------------------------------------------
 * واژه‌سفر — core/stage.ts  (v7 — «سایز بندی روی همه گوشی‌ها یکسان»)
 *
 * UNITY-STYLE CANSCALER (user: «با چند گوشی مختلف تست کردم سایز بندی
 * هاشون متفاوته … مثل یونیتی نرم روان بکن»):
 *
 * The whole game lives in a .vz-phone stage whose CSS was written for
 * a ~412px-wide phone. On a 360px phone everything crowded; on a 480px
 * phone everything spread out; on tablets the 430px cap letterboxed —
 * every device saw DIFFERENT proportions. Fix (exactly what Unity's
 * Canvas Scaler "Scale With Screen Size / Match=Width" does):
 *
 *   zoom = realWidth / 412   → the stage is AUTHORED at 412 design-px
 *   stage height = realHeight / zoom (fills the screen exactly)
 *
 * Every px value in game.css now represents the SAME fraction of screen
 * width on ALL phones. vw-based rules keep working (they are relative
 * to the real viewport and end up ≈ the same visual proportion).
 *
 * Safety notes baked in:
 *  • zoom keyed to WIDTH only → the Android keyboard opening (height
 *    change) never rescales the UI.
 *  • position:fixed helpers that are placed with real-px coordinates
 *    (tutorial hand, flying word chip) divide by stageZoom() — Chrome
 *    multiplies transforms inside a zoomed subtree.
 *  • Desktop / wide windows keep the original 430px letterboxed look.
 *  • ?zoom=off QA override previews the pre-v7 behaviour.
 * ------------------------------------------------------------------ */

const DESIGN_W = 412;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.75;

let currentZoom = 1;
let applied = false;

export function stageZoom(): number {
  return currentZoom;
}

function compute(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>(".vz-phone");
  if (!el) return;

  let off = false;
  try { off = new URLSearchParams(window.location.search).has("zoomoff"); } catch { /* noop */ }

  const w = window.innerWidth;
  const h = window.innerHeight;
  /* desktop / wide window → the classic letterboxed 430px stage */
  const desktop = w >= 900 && !("ontouchstart" in window);
  if (off || desktop || w <= 0 || h <= 0) {
    currentZoom = 1;
    el.style.removeProperty("zoom");
    el.style.removeProperty("width");
    el.style.removeProperty("height");
    el.style.removeProperty("max-width");
    el.style.removeProperty("max-height");
    applied = false;
    return;
  }

  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, w / DESIGN_W));
  currentZoom = z;
  /* the stage is authored in design-px; Chrome scales it by zoom */
  el.style.zoom = String(z);
  el.style.width = `${w / z}px`;
  el.style.height = `${Math.round(h / z)}px`;
  el.style.maxWidth = "none";
  el.style.maxHeight = "none";
  applied = true;
}

let started = false;
export function startStageScaler(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  compute();
  let raf = 0;
  const onR = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; compute(); });
  };
  window.addEventListener("resize", onR);
  window.addEventListener("orientationchange", onR);
  /* the shell (.vz-phone) is server-rendered — but recompute once more
   * after hydration in case layout shifted the node */
  setTimeout(compute, 0);
  setTimeout(compute, 1200);
}

/** QA/debug helper */
export function isStageScaled(): boolean {
  return applied;
}
