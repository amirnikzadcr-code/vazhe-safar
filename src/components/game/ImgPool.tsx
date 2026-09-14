"use client";
/* ------------------------------------------------------------------
 * ImgPool — PERMANENT in-DOM image pool (v2.4)
 * Keeps the FIVE SCREEN BACKGROUNDS resident (home/play/library/…
 * — the «زمینهٔ صفحه‌ها» the user switches between constantly), so
 * navigating screens paints them instantly with zero re-decode.
 * v2.4: chapter REALMS are NO LONGER resident — 20 full-page bitmaps
 * pinned in memory made weak phones judder. Realms now lazy-decode
 * as the map scrolls (see MapScreen).
 * Mounted ONCE in GameApp, outside the keyed screen remount div.
 * PERF: fully static, opacity 0, pointer-events none, behind screens.
 * ------------------------------------------------------------------ */
import { SCREEN_BGS } from "@/game/core/preload";

export function ImgPool() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute", inset: 0, overflow: "hidden",
        pointerEvents: "none", opacity: 0, zIndex: 0,
      }}
    >
      {SCREEN_BGS.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          decoding="async"
          draggable={false}
        />
      ))}
    </div>
  );
}
