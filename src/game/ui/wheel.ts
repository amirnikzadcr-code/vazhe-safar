/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/wheel.ts
 *  Circular letter wheel with drag-to-connect input (pointer events),
 *  segment-interpolated hit-testing (fast swipes never skip letters),
 *  path drawing, backtrack, shuffle and haptic/sfx feedback.
 * ------------------------------------------------------------------ */
import { h, letters, rng, shuffle, buzz } from "../core/utils";
import { Audio } from "../core/audio";
import { Save } from "../core/save";

export interface WheelHandle {
  el: HTMLDivElement;
  /** called with the assembled word when the pointer is released */
  onSubmit: (word: string) => void;
  /** called whenever the path changes (for micro-sfx) */
  onSelect?: (index: number) => void;
  shuffle(): void;
  clearPath(): void;
  resize(): void;
  pulseLetters(word: string, ms?: number): void;
  /** viewport-space center of a letter button (for tutorial hand demo) */
  letterCenter(i: number): { x: number; y: number } | null;
  letterCount(): number;
  /** the character drawn on letter i */
  letterChar(i: number): string;
}

export function createWheel(seed: number, wheelLetters: string): WheelHandle {
  const el = h("div", { class: "vz-wheel" });
  const ring = h("div", { class: "vz-wheel-ring" });
  const lettersLayer = h("div", { class: "vz-wheel-letters" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "vz-wheel-svg");
  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("class", "vz-wheel-path");
  svg.append(pathEl);
  el.append(ring, svg, lettersLayer);

  let chars: string[] = Array.from(wheelLetters);
  let nodes: { ch: string; x: number; y: number; btn: HTMLButtonElement }[] = [];
  let path: number[] = [];
  let active = false;
  let shuffleCount = 0;
  const baseSeed = seed;
  // last sampled pointer position — the drag is sampled in small steps along
  // the segment between samples so fast swipes can never skip a letter
  let lastSample: { x: number; y: number } | null = null;

  const layout = (): void => {
    const rand = rng(baseSeed * 977 + shuffleCount * 131);
    chars = shuffle(chars, rand);
    lettersLayer.innerHTML = "";
    nodes = chars.map((ch, i) => {
      const btn = h("button", { class: "vz-letter", type: "button", "aria-label": ch });
      btn.textContent = ch;
      lettersLayer.append(btn);
      return { ch, x: 0, y: 0, btn };
    });
    position();
  };

  const position = (): void => {
    const w = el.clientWidth;
    const hh = el.clientHeight;
    if (!w || !hh) return;
    // radius fits inside BOTH dimensions with a safe margin so letters and
    // the decorative ring never clip on short screens
    // (v1.3: wider radius → more breathing room between letters)
    const R = Math.max(60, Math.min(w, hh) / 2 - 34);
    // keep the decorative ring a perfect circle hugging the letters
    const d = 2 * (R + 34);
    ring.style.width = `${d}px`;
    ring.style.height = `${d}px`;
    const n = nodes.length;
    nodes.forEach((nd, i) => {
      // start from top, clockwise
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      nd.x = w / 2 + R * Math.cos(a);
      nd.y = hh / 2 + R * Math.sin(a);
      nd.btn.style.left = `${nd.x}px`;
      nd.btn.style.top = `${nd.y}px`;
    });
    drawPath();
  };

  const drawPath = (mx?: number, my?: number): void => {
    if (path.length === 0 && mx == null) {
      pathEl.setAttribute("d", "");
      return;
    }
    const pts = path.map((i) => nodes[i]);
    let d = "";
    if (pts.length) {
      d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
      if (active && mx != null && pts.length) d += ` L ${mx} ${my}`;
    }
    pathEl.setAttribute("d", d);
  };

  const refreshSel = (): void => {
    nodes.forEach((nd, i) => nd.btn.classList.toggle("sel", path.includes(i)));
  };

  const hitTest = (x: number, y: number): number => {
    // generous adaptive pick radius (v1.3: bigger letters → bigger targets)
    const pick = Math.max(31, Math.min(50, el.clientWidth * 0.098));
    let best = -1, bestD = pick * pick;
    for (let i = 0; i < nodes.length; i++) {
      const dx = x - nodes[i].x, dy = y - nodes[i].y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const localPos = (e: PointerEvent): { x: number; y: number } => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** process a hit at (x,y): push / backtrack / ignore */
  const stepAt = (i: number): void => {
    if (i === -1) return;
    const last = path[path.length - 1];
    if (i === last) return;
    const prev = path[path.length - 2];
    if (i === prev) {
      // backtrack
      path.pop();
      refreshSel();
      Audio.sfxLetter(path.length);
      return;
    }
    if (!path.includes(i)) {
      path.push(i);
      refreshSel();
      Audio.sfxLetter(path.length);
      buzz(8, Save.data.settings.haptics);
      handle.onSelect?.(path.length);
    }
  };

  el.addEventListener("pointerdown", (e) => {
    if (!chars.length) return;
    const { x, y } = localPos(e);
    const i = hitTest(x, y);
    if (i === -1) return;
    active = true;
    lastSample = { x, y };
    el.setPointerCapture(e.pointerId);
    path = [i];
    refreshSel();
    drawPath(x, y);
    Audio.sfxLetter(0);
    buzz(8, Save.data.settings.haptics);
    handle.onSelect?.(0);
  });

  el.addEventListener("pointermove", (e) => {
    if (!active) return;
    const { x, y } = localPos(e);
    const from = lastSample ?? { x, y };
    lastSample = { x, y };
    // sample along the segment so quick flicks register every passed letter
    const dist = Math.hypot(x - from.x, y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let s = 1; s <= steps; s++) {
      const px = from.x + ((x - from.x) * s) / steps;
      const py = from.y + ((y - from.y) * s) / steps;
      stepAt(hitTest(px, py));
    }
    drawPath(x, y);
  });

  const finish = (e: PointerEvent): void => {
    if (!active) return;
    active = false;
    lastSample = null;
    drawPath();
    if (path.length >= 2) {
      const word = path.map((i) => nodes[i].ch).join("");
      handle.onSubmit(word);
    }
    path = [];
    refreshSel();
    drawPath();
  };

  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", () => {
    active = false;
    lastSample = null;
    path = [];
    refreshSel();
    drawPath();
  });

  const handle: WheelHandle = {
    el,
    onSubmit: () => { /* replaced by gameplay */ },
    onSelect: () => { /* optional */ },
    shuffle() {
      shuffleCount++;
      path = [];
      layout();
      refreshSel();
    },
    clearPath() {
      path = [];
      active = false;
      refreshSel();
      drawPath();
    },
    resize() { position(); },
    letterCenter(i: number) {
      const nd = nodes[i];
      if (!nd) return null;
      const r = nd.btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    letterCount() { return nodes.length; },
    letterChar(i: number) { return nodes[i]?.ch ?? ""; },
    pulseLetters(word, ms = 900) {
      const target = letters(word);
      const used = new Set<number>();
      const idxs: number[] = [];
      for (const ch of target) {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].ch === ch && !used.has(i)) { used.add(i); idxs.push(i); break; }
        }
      }
      for (const i of idxs) {
        nodes[i].btn.classList.add("pulse");
        setTimeout(() => nodes[i].btn.classList.remove("pulse"), ms);
      }
    },
  };

  layout();
  // position after insertion into DOM + track any size change (flex settle,
  // orientation, etc.) so letters never end up at stale coordinates
  requestAnimationFrame(() => position());
  const ro = new ResizeObserver(() => position());
  ro.observe(el);
  return handle;
}
