/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/mascot.ts
 *  «عمو دانا» — the wise old storyteller: a real human guide rendered
 *  in premium 3D style. Three poses (hello / point / cheer) as
 *  pre-loaded transparent WebP cutouts + ornate speech bubble.
 *  All images are pre-decoded so switching poses never lags.
 * ------------------------------------------------------------------ */
import { h } from "../core/utils";

export type MascotPose = "idle" | "point" | "cheer";

const POSE_SRC: Record<MascotPose, string> = {
  idle: "/assets/char/hello.webp",
  point: "/assets/char/point.webp",
  cheer: "/assets/char/cheer.webp",
};

/* decode every pose once, app-wide — pose swaps are instant afterwards */
let preloaded = false;
export function preloadMascot(): void {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;
  for (const src of Object.values(POSE_SRC)) {
    const img = new Image();
    img.src = src;
    img.decode?.().catch(() => { /* best-effort */ });
  }
}

export interface MascotHandle {
  el: HTMLDivElement;
  say(text: string, ms?: number): void;
  setPose(p: MascotPose): void;
}

/** the wise guide; `size` = display width of the cutout. */
export function createMascot(size = 92, cls = ""): MascotHandle {
  const el = h("div", { class: `vz-mascot ${cls}`, "aria-hidden": "true" });
  el.style.setProperty("--mz-w", `${size}px`);

  const img = h("img", {
    class: "vz-mascot-img",
    src: POSE_SRC.idle,
    alt: "",
    draggable: "false",
  }) as HTMLImageElement;
  img.decoding = "async";
  const shadow = h("div", { class: "vz-mascot-shadow" });
  el.append(shadow, img);

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
      const src = POSE_SRC[p] ?? POSE_SRC.idle;
      if (img.getAttribute("src") !== src) img.src = src;
      el.classList.toggle("cheer", p === "cheer");
      el.classList.toggle("point", p === "point");
    },
  };
  preloadMascot();
  return handle;
}
