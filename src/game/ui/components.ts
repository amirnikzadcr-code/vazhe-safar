/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/components.ts
 *  Shared UI atoms: buttons, modals, top bar, coin badge, toasts.
 * ------------------------------------------------------------------ */
import { h } from "../core/utils";
import { Audio } from "../core/audio";
import { Save } from "../core/save";
import { faNum, buzz } from "../core/utils";
import { T } from "../i18n";

/** wrap raw path markup in a proper <svg> — raw <path> outside an svg
 *  context is NEVER rendered by browsers (this bug hid all lock/star icons) */
export function svgIcon(inner: string, size = 22, stroke = 2.2): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** wire a button with click sfx + haptics. `icon` = raw svg inner markup */
export function actionBtn(
  label: string,
  cls: string,
  onClick: () => void,
  icon?: string,
): HTMLButtonElement {
  const b = h("button", { class: `vz-btn ${cls}`, type: "button" });
  if (icon) {
    const ic = h("span", { class: "vz-btn-ic", "aria-hidden": "true" });
    ic.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
    b.append(ic);
  }
  b.append(h("span", { class: "vz-btn-lb", text: label }));
  b.addEventListener("click", () => {
    Audio.sfxClick();
    buzz(12, Save.data.settings.haptics);
    onClick();
  });
  return b;
}

/** circular icon-only button */
export function iconBtn(icon: string, label: string, onClick: () => void, cls = ""): HTMLButtonElement {
  const b = h("button", { class: `vz-icon-btn ${cls}`, "aria-label": label, type: "button" });
  b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
  b.addEventListener("click", () => {
    Audio.sfxClick();
    buzz(12, Save.data.settings.haptics);
    onClick();
  });
  return b;
}

export const ICONS = {
  back: '<path d="M9 6l6 6-6 6"/>',
  pause: '<line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/>',
  help: '<circle cx="12" cy="12" r="9.2"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.8-2.4 2.2-2.8 3.8"/><circle cx="12" cy="17.4" r="0.4" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  starFill: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.6 2.5 1.7c0 2.6-5 1.7-5 4.3 0 1.1 1.1 1.9 2.5 1.9s2.5-.8 2.5-1.9"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>',
  undo: '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/>',
  x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  flag: '<path d="M4 21V4"/><path d="M4 4h12l-2.5 4L16 12H4"/>',
};

/** coin badge showing current balance; call refresh() when coins change */
export function coinBadge(): HTMLDivElement & { refresh(): void } {
  const el = h("div", { class: "vz-coin-badge" }) as HTMLDivElement & { refresh(): void };
  const render = () => {
    el.innerHTML = `<span class="vz-coin-ic">🪙</span><span class="vz-coin-num">${faNum(Save.data.coins)}</span>`;
  };
  el.refresh = render;
  render();
  return el;
}

export function starRow(n: number, total = 3, size = 16): HTMLDivElement {
  const d = h("div", { class: "vz-star-row" });
  for (let i = 0; i < total; i++) {
    d.innerHTML += `<span class="vz-star ${i < n ? "on" : ""}" style="width:${size}px;height:${size}px">${svgIcon(ICONS.starFill, size)}</span>`;
  }
  return d;
}

/* ---------- modal ---------- */

export interface ModalHandle { el: HTMLDivElement; close(): void }

export function modal(content: HTMLElement, opts: { closable?: boolean; onClose?: () => void; cls?: string } = {}): ModalHandle {
  const wrap = h("div", { class: `vz-modal-wrap ${opts.cls ?? ""}` });
  const card = h("div", { class: "vz-modal-card", role: "dialog", "aria-modal": "true" });
  card.append(content);
  wrap.append(card);
  const handle: ModalHandle = {
    el: wrap,
    close() {
      wrap.classList.add("closing");
      setTimeout(() => wrap.remove(), 260);
      opts.onClose?.();
    },
  };
  if (opts.closable !== false) {
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) handle.close();
    });
  }
  return handle;
}

/* ---------- toast ---------- */

export function toast(msg: string, kind: "ok" | "warn" = "ok"): void {
  const t = h("div", { class: `vz-toast ${kind}`, text: msg, role: "status" });
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 400);
  }, 2200);
}

/** section header with title + optional back */
export function screenHeader(title: string, onBack: () => void, right?: HTMLElement): HTMLDivElement {
  const bar = h("div", { class: "vz-screen-header" });
  bar.append(iconBtn(ICONS.back, T.back, onBack, "flip-rtl"));
  bar.append(h("h2", { class: "vz-screen-title", text: title }));
  if (right) bar.append(h("div", { class: "vz-screen-right" }, right));
  else bar.append(h("div", { class: "vz-screen-right" }));
  return bar;
}
