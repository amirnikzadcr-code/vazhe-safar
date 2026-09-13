/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/wheel.ts
 *  Circular letter wheel with drag-to-connect input (pointer events),
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
    // radius fits inside BOTH dimensions so letters never clip on short screens
    const R = Math.min(w, hh) / 2 - 34;
    // keep the decorative ring a perfect circle hugging the letters
    const d = 2 * (R + 33);
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
    const R = el.clientWidth * 0.105;
    let best = -1, bestD = R * R * 2.4;
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

  el.addEventListener("pointerdown", (e) => {
    if (!chars.length) return;
    const { x, y } = localPos(e);
    const i = hitTest(x, y);
    if (i === -1) return;
    active = true;
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
    const i = hitTest(x, y);
    if (i !== -1) {
      const last = path[path.length - 1];
      if (i !== last) {
        const prev = path[path.length - 2];
        if (i === prev) {
          // backtrack
          path.pop();
          refreshSel();
          drawPath(x, y);
          Audio.sfxLetter(path.length);
        } else if (!path.includes(i)) {
          path.push(i);
          refreshSel();
          drawPath(x, y);
          Audio.sfxLetter(path.length);
          buzz(8, Save.data.settings.haptics);
          handle.onSelect?.(path.length);
        }
      } else drawPath(x, y);
    } else drawPath(x, y);
  });

  const finish = (e: PointerEvent): void => {
    if (!active) return;
    active = false;
    const { x, y } = localPos(e);
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
