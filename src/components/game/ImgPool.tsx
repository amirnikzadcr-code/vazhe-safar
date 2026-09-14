"use client";
/* ------------------------------------------------------------------
 * ImgPool — PERMANENT in-DOM image pool (v2.3)
 * Every preloaded art asset stays mounted full-size for the whole
 * app lifetime, so the WebView keeps the DECODED bitmaps resident.
 * Navigating screens then paint their <img> instantly from the same
 * cached resource — zero re-fetch, zero re-decode, zero blue flash.
 * Mounted ONCE in GameApp, outside the keyed screen remount div.
 * PERF: fully static, opacity 0, pointer-events none, behind screens.
 * ------------------------------------------------------------------ */
import { PRELOAD_IMAGES } from "@/game/core/preload";

export function ImgPool() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute", inset: 0, overflow: "hidden",
        pointerEvents: "none", opacity: 0, zIndex: 0,
      }}
    >
      {PRELOAD_IMAGES.filter((s) => s.endsWith(".webp")).map((src) => (
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
