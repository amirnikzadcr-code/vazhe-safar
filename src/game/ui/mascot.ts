/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/mascot.ts
 *  «سیمرغک» — the little Simorgh: a friendly mythical-bird guide who
 *  welcomes the player, teaches the drag gesture and celebrates wins.
 *  Pure hand-drawn SVG (3 poses) + CSS float animation + speech bubble.
 *  100% original artwork, no external assets.
 * ------------------------------------------------------------------ */
import { h } from "../core/utils";

export type MascotPose = "idle" | "point" | "cheer";

/** the bird itself — layered SVG, warm gold/copper palette, paisley wing */
function mascotSvg(pose: MascotPose): string {
  // wing rotation per pose
  const wingR = pose === "point" ? 14 : pose === "cheer" ? -18 : 0;
  const bodyY = pose === "cheer" ? -2 : 0;
  return `<svg class="vz-mascot-svg" viewBox="0 0 120 110" width="120" height="110" aria-hidden="true">
  <defs>
    <linearGradient id="vzMBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd97a"/><stop offset=".55" stop-color="#f2b04a"/><stop offset="1" stop-color="#d98a2e"/>
    </linearGradient>
    <linearGradient id="vzMWing" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e89b3a"/><stop offset="1" stop-color="#b06a34"/>
    </linearGradient>
    <linearGradient id="vzMCrest" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#d96a4a"/><stop offset="1" stop-color="#e8b54d"/>
    </linearGradient>
  </defs>
  <g transform="translate(0 ${bodyY})">
    <!-- tail plumes -->
    <g class="vz-mascot-tail">
      <path d="M34 78 C14 84 8 98 12 106 C22 100 30 96 40 94 Z" fill="url(#vzMWing)" opacity=".9"/>
      <path d="M38 84 C24 94 22 104 28 108 C34 102 42 96 48 92 Z" fill="#e8b54d" opacity=".75"/>
    </g>
    <!-- far wing (paisley) -->
    <g transform="rotate(${wingR} 40 55)">
      <path d="M44 46 C20 40 10 52 14 66 C26 62 36 62 46 64 Z" fill="url(#vzMWing)"/>
      <circle cx="26" cy="55" r="3.2" fill="#ffe9a8" opacity=".85"/>
      <path d="M20 62 C28 58 38 58 44 61" stroke="#ffe9a8" stroke-width="1.6" fill="none" opacity=".6"/>
    </g>
    <!-- body -->
    <ellipse cx="60" cy="62" rx="26" ry="24" fill="url(#vzMBody)"/>
    <!-- chest -->
    <ellipse cx="64" cy="70" rx="15" ry="13" fill="#ffe9c9" opacity=".8"/>
    <!-- near wing -->
    <g transform="rotate(${-wingR} 74 56)">
      <path d="M76 46 C96 40 108 52 104 68 C92 64 82 62 72 64 Z" fill="url(#vzMWing)"/>
      <circle cx="92" cy="56" r="3.4" fill="#ffe9a8" opacity=".9"/>
      <path d="M98 64 C90 60 80 60 74 63" stroke="#ffe9a8" stroke-width="1.6" fill="none" opacity=".6"/>
    </g>
    <!-- head -->
    <circle cx="60" cy="34" r="17" fill="url(#vzMBody)"/>
    <!-- Simorgh crest — three rising plumes -->
    <g class="vz-mascot-crest">
      <path d="M52 20 C48 8 54 2 58 0 C56 8 58 14 60 18 Z" fill="url(#vzMCrest)"/>
      <path d="M60 17 C60 6 66 0 71 -1 C66 6 66 12 66 17 Z" fill="#d96a4a"/>
      <path d="M68 19 C72 10 80 6 86 6 C80 11 76 16 74 21 Z" fill="url(#vzMCrest)"/>
    </g>
    <!-- face -->
    <circle cx="52" cy="32" r="4.6" fill="#fff6e4"/><circle cx="51.2" cy="33" r="2.3" fill="#3a2413"/>
    <circle cx="51.7" cy="32.2" r="0.8" fill="#fff"/>
    <circle cx="68" cy="32" r="4.6" fill="#fff6e4"/><circle cx="67.2" cy="33" r="2.3" fill="#3a2413"/>
    <circle cx="67.7" cy="32.2" r="0.8" fill="#fff"/>
    <!-- beak -->
    <path d="M57 40 L64 43 L56 46 C54 44 54 41 57 40 Z" fill="#e8873a"/>
    <path d="M56.5 43 L64 43 L56 46 Z" fill="#c96a2e"/>
    <!-- cheek blush -->
    <ellipse cx="48" cy="40" rx="3" ry="2" fill="#ff9f7e" opacity=".55"/>
    <ellipse cx="72" cy="40" rx="3" ry="2" fill="#ff9f7e" opacity=".55"/>
    <!-- feet -->
    <path d="M52 84 l-3 7 m3 -7 l3 7" stroke="#b06a34" stroke-width="2.4" stroke-linecap="round"/>
  </g>
</svg>`;
}

export interface MascotHandle {
  el: HTMLDivElement;
  say(text: string, ms?: number): void;
  setPose(p: MascotPose): void;
}

/** floating guide bird; `size` scales the svg. */
export function createMascot(size = 92, cls = ""): MascotHandle {
  const el = h("div", { class: `vz-mascot ${cls}`, "aria-hidden": "true" });
  el.innerHTML = mascotSvg("idle");
  el.style.setProperty("--mz-w", `${size}px`);
  let hideT: ReturnType<typeof setTimeout> | null = null;

  const handle: MascotHandle = {
    el,
    say(text, ms = 3600) {
      let bubble = el.querySelector(".vz-mascot-bubble") as HTMLDivElement | null;
      if (!bubble) {
        bubble = h("div", { class: "vz-mascot-bubble" });
        el.append(bubble);
      }
      bubble.textContent = text;
      bubble.classList.remove("out");
      void bubble.offsetWidth; // restart animation
      bubble.classList.add("show");
      if (hideT) clearTimeout(hideT);
      hideT = setTimeout(() => {
        bubble!.classList.remove("show");
        bubble!.classList.add("out");
      }, ms);
    },
    setPose(p: MascotPose) {
      const svg = el.querySelector(".vz-mascot-svg");
      if (svg) {
        const wrap = h("div");
        wrap.innerHTML = mascotSvg(p);
        svg.replaceWith(wrap.firstChild!);
      }
      el.classList.toggle("cheer", p === "cheer");
      el.classList.toggle("point", p === "point");
    },
  };
  return handle;
}
