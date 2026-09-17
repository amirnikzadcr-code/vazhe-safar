/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/vignette.ts
 *  Living CSS vignettes: small animated life-layers (petals, sparks,
 *  stars, glows…) rendered inside any card/scene container.
 *  Pure CSS keyframes (see game.css .vz-vig) — no canvas, cheap.
 * ------------------------------------------------------------------ */
import { h, rng } from "../core/utils";

type VigKind = "fall" | "rise" | "twinkle" | "g";

/** deterministic pseudo-random helper bound to a seed */
function mkRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** build a vignette layer of n elements */
function layer(kind: VigKind, n: number, seed: number, dur: [number, number]): HTMLElement {
  const rand = mkRand(seed);
  const wrap = h("div", { class: "vz-vig-layer" });
  for (let i = 0; i < n; i++) {
    const el = h("i", { class: kind === "fall" ? "p" : kind === "rise" ? "r" : kind === "g" ? "g" : "t" });
    el.style.left = `${4 + rand() * 92}%`;
    el.style.top = kind === "rise" ? `${55 + rand() * 40}%` : `${rand() * 78}%`;
    el.style.setProperty("--vigd", `${dur[0] + rand() * (dur[1] - dur[0])}s`);
    el.style.setProperty("--vigdel", `${(-rand() * dur[1]).toFixed(2)}s`);
    const sc = 0.6 + rand() * 0.9;
    el.style.transform += ` scale(${sc.toFixed(2)})`;
    wrap.append(el);
  }
  return wrap;
}

/**
 * Per-chapter living vignette — matched to the chapter's atmosphere.
 * ch1 garden petals · ch2 bazaar sparks · ch3 desert glow · ch4 fireflies
 * ch5 snow · ch6 dust · ch7 sea sparkles · ch8 leaves · ch9 stars · ch10 gold
 */
export function chapterVignette(ch: number): HTMLDivElement {
  const root = h("div", { class: "vz-vig", "aria-hidden": "true" });
  const seed = ch * 7919;
  switch (ch) {
    case 1: // باغ — falling rose petals (pink/cream)
      root.style.setProperty("--vig1", "#ff9fb8");
      root.append(layer("fall", 7, seed, [5, 9]));
      root.style.setProperty("--vig1", "#ffd76e");
      root.append(layer("twinkle", 4, seed + 1, [2, 4]));
      break;
    case 2: // بازار — rising warm sparks + glow
      root.style.setProperty("--vig1", "#ffcf5e");
      root.style.setProperty("--vig2", "rgba(255, 190, 90, 0.5)");
      root.append(layer("rise", 6, seed, [5, 8]));
      root.append(layer("g", 1, seed + 1, [0, 0]));
      break;
    case 3: // کویر — big warm sun glow + drifting sand
      root.style.setProperty("--vig1", "#ffb85e");
      root.style.setProperty("--vig2", "rgba(255, 150, 60, 0.55)");
      root.append(layer("g", 1, seed, [0, 0]));
      root.style.setProperty("--vig1", "#ffd9a0");
      root.append(layer("rise", 5, seed + 1, [6, 10]));
      break;
    case 4: // جنگل — fireflies + green glow
      root.style.setProperty("--vig1", "#d4ff8f");
      root.style.setProperty("--vig2", "rgba(120, 220, 140, 0.4)");
      root.append(layer("twinkle", 9, seed, [2, 5]));
      root.append(layer("g", 1, seed + 1, [0, 0]));
      break;
    case 5: // کوه — falling snow
      root.style.setProperty("--vig1", "#eaf4ff");
      root.append(layer("fall", 9, seed, [6, 11]));
      break;
    case 6: // بادگیرها — dusk dust + window glow
      root.style.setProperty("--vig1", "#ffb36e");
      root.style.setProperty("--vig2", "rgba(255, 170, 90, 0.45)");
      root.append(layer("rise", 6, seed, [6, 10]));
      root.append(layer("g", 1, seed + 1, [0, 0]));
      break;
    case 7: // دریا — sea sparkles
      root.style.setProperty("--vig1", "#a8f0ea");
      root.append(layer("twinkle", 8, seed, [2, 4.5]));
      root.style.setProperty("--vig1", "#ffe9b0");
      root.append(layer("rise", 3, seed + 1, [6, 9]));
      break;
    case 8: // روستا — drifting leaves + warm glow
      root.style.setProperty("--vig1", "#ffb36e");
      root.style.setProperty("--vig2", "rgba(255, 170, 90, 0.4)");
      root.append(layer("fall", 6, seed, [5, 9]));
      root.append(layer("g", 1, seed + 1, [0, 0]));
      break;
    case 9: // شب ستاره‌ها — twinkling stars
      root.style.setProperty("--vig1", "#ffe9a8");
      root.append(layer("twinkle", 12, seed, [1.8, 4]));
      root.style.setProperty("--vig1", "#fff");
      root.append(layer("twinkle", 5, seed + 1, [2.5, 5]));
      break;
    default: // ch10 جشن — golden sparks + glow
      root.style.setProperty("--vig1", "#ffd76e");
      root.style.setProperty("--vig2", "rgba(255, 214, 130, 0.55)");
      root.append(layer("rise", 8, seed, [4, 8]));
      root.append(layer("twinkle", 5, seed + 1, [2, 4]));
      root.append(layer("g", 1, seed + 2, [0, 0]));
  }
  return root;
}
