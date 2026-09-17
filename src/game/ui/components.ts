/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/components.ts
 *  Shared UI atoms: buttons, modals, top bar, coin badge, toasts.
 *  v1.3: rich FILLED two-tone icon set (graphic, "real asset" feel).
 * ------------------------------------------------------------------ */
import { h } from "../core/utils";
import { Audio } from "../core/audio";
import { Save } from "../core/save";
import { faNum, buzz } from "../core/utils";
import { T } from "../i18n";

/** wrap icon markup in an <svg>. Icons are self-styled (filled silhouettes
 *  with knocked-out details) so no forced fill/stroke here. */
export function svgIcon(inner: string, size = 22): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
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
    ic.innerHTML = svgIcon(icon, 20);
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
  b.innerHTML = svgIcon(icon, 24);
  b.addEventListener("click", () => {
    Audio.sfxClick();
    buzz(12, Save.data.settings.haptics);
    onClick();
  });
  return b;
}

/* two-tone detail color (dark carved line inside golden fills) */
const D = 'var(--vz-panel, "#2e1b12")';

export const ICONS = {
  back: `<path fill="currentColor" d="M8.6 4.6 16 12l-7.4 7.4-2-2L12 12 6.6 6.6z"/>`,
  pause: `<rect x="6" y="4.2" width="4.2" height="15.6" rx="1.6" fill="currentColor"/><rect x="13.8" y="4.2" width="4.2" height="15.6" rx="1.6" fill="currentColor"/>`,
  book: `<path fill="currentColor" d="M12 5.4C10 3.9 7.2 3.2 3.6 3.2c-.7 0-1.2.5-1.2 1.2v13c0 .7.5 1.2 1.2 1.2 3.2 0 5.9.7 8.4 2.2 2.5-1.5 5.2-2.2 8.4-2.2.7 0 1.2-.5 1.2-1.2v-13c0-.7-.5-1.2-1.2-1.2-3.6 0-6.4.7-8.4 2.2z"/><path stroke="${D}" stroke-width="1.3" fill="none" opacity=".6" d="M12 5.6v15"/>`,
  help: `<circle cx="12" cy="12" r="10" fill="currentColor"/><path fill="none" stroke="${D}" stroke-width="2.1" stroke-linecap="round" d="M9.3 9.2a2.75 2.75 0 0 1 5.35.9c0 1.75-2.35 2.15-2.75 3.7"/><circle cx="11.9" cy="17" r="1.25" fill="${D}"/>`,
  gear: `<path fill="currentColor" d="M10.3 1.6h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.35.1.72.1 1.1s0 .75-.1 1.1l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6a7 7 0 0 1-1.7-.9l-2.5.9-1.7-2.9 2-1.7a7.4 7.4 0 0 1 0-2.2l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9z"/><circle cx="12" cy="12" r="3.3" fill="${D}" opacity=".85"/>`,
  chart: `<rect x="3.4" y="12.6" width="4.2" height="8.2" rx="1.1" fill="currentColor"/><rect x="9.9" y="5.8" width="4.2" height="15" rx="1.1" fill="currentColor"/><rect x="16.4" y="9.2" width="4.2" height="11.6" rx="1.1" fill="currentColor"/>`,
  gift: `<path fill="currentColor" d="M2.8 8.4h18.4v3.4H2.8zM4.2 13h15.6v7.6c0 .8-.6 1.4-1.4 1.4H5.6c-.8 0-1.4-.6-1.4-1.4zM10.9 13h2.2v9h-2.2z"/><path fill="currentColor" d="M12 8.4C9.9 8.4 6.9 7.8 6.9 5.4 6.9 3.8 8.1 2.8 9.5 2.8c1.9 0 2.5 3.2 2.5 5.6zm0 0c2.1 0 5.1-.6 5.1-3 0-1.6-1.2-2.6-2.6-2.6-1.9 0-2.5 3.2-2.5 5.6z"/>`,
  bulb: `<path fill="currentColor" d="M12 2.2a6.6 6.6 0 0 0-3.9 11.9c.7.5 1.1 1.2 1.2 2l.1.9h5.2l.1-.9c.1-.8.5-1.5 1.2-2A6.6 6.6 0 0 0 12 2.2z"/><path fill="currentColor" d="M9.5 18.4h5v1.2a1.7 1.7 0 0 1-1.7 1.7h-1.6a1.7 1.7 0 0 1-1.7-1.7z"/><path stroke="${D}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".7" d="M9.7 9.6a3.5 3.5 0 0 1 2.3-2.4"/><path stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".8" d="M3.2 8.2h-1.8M22.6 8.2h-1.8M5 3.6 3.7 2.3M19 3.6l1.3-1.3"/>`,
  home: `<path fill="currentColor" d="M12 2.4 2.2 11.2h2.4v9.2c0 .8.6 1.4 1.4 1.4h4.2v-6.6h3.6v6.6h4.2c.8 0 1.4-.6 1.4-1.4v-9.2h2.4z"/>`,
  restart: `<path fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" d="M19.7 12a7.7 7.7 0 1 1-2.3-5.5"/><path fill="currentColor" d="M22.3 3.2l-.7 6.2-5.8-2.7z"/>`,
  star: `<path fill="currentColor" d="M12 1.7l3.25 6.5 7.15 1.05-5.2 5.05 1.25 7.1L12 18l-6.45 3.4 1.25-7.1-5.2-5.05L8.75 8.2z"/>`,
  starFill: `<path fill="currentColor" d="M12 1.7l3.25 6.5 7.15 1.05-5.2 5.05 1.25 7.1L12 18l-6.45 3.4 1.25-7.1-5.2-5.05L8.75 8.2z"/><path fill="#fff6e4" opacity=".35" d="M12 4.6l2 4 4.4.65-3.2 3.1.75 4.3L12 14.5z"/>`,
  lock: `<path fill="currentColor" d="M6.1 10.2V8a5.9 5.9 0 0 1 11.8 0v2.2h.7c1 0 1.8.8 1.8 1.8v8.2c0 1-.8 1.8-1.8 1.8H5.4c-1 0-1.8-.8-1.8-1.8V12c0-1 .8-1.8 1.8-1.8zM8.5 10.2h7V8a3.5 3.5 0 0 0-7 0z"/><circle cx="12" cy="15.8" r="1.9" fill="${D}" opacity=".8"/>`,
  coin: `<circle cx="12" cy="12" r="9.6" fill="currentColor"/><circle cx="12" cy="12" r="7" fill="none" stroke="${D}" stroke-width="1.3" opacity=".5"/><path fill="${D}" opacity=".85" d="M12 6.9l1.45 2.9 3.2.47-2.32 2.26.55 3.19L12 14.2l-2.88 1.52.55-3.19-2.32-2.26 3.2-.47z"/>`,
  play: `<circle cx="12" cy="12" r="10.2" fill="currentColor"/><path fill="${D}" opacity=".9" d="M9.3 6.9l8.6 5.1-8.6 5.1z"/>`,
  shuffle: `<path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" d="M2.6 16.6h3.6c1.5 0 2.9-.7 3.8-1.9l3.6-4.8a4.7 4.7 0 0 1 3.8-1.9h2.5"/><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" d="M2.6 7.9h3.6c1.5 0 2.9.7 3.8 1.9l3.6 4.8a4.7 4.7 0 0 0 3.8 1.9h2.5"/><path fill="currentColor" d="M17.9 3.9 21.9 8l-4 4.1zM17.9 12.9l4 4.1-4 4.1z"/>`,
  undo: `<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M8.7 4.3 4.2 8.6l4.5 4.3"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4.8 8.6h8a6.5 6.5 0 0 1 6.5 6.5v.1a6.5 6.5 0 0 1-6.5 6.5H9.6"/>`,
  x: `<path fill="currentColor" d="M5.7 4.3 12 10.6 18.3 4.3 19.7 5.7 13.4 12l6.3 6.3-1.4 1.4L12 13.4 5.7 19.7 4.3 18.3 10.6 12 4.3 5.7z"/>`,
  check: `<path fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round" d="M4.4 12.7 9.4 17.6 19.6 6.7"/>`,
  flag: `<path fill="currentColor" d="M5.4 2.6h1.9v19h-1.9z"/><path fill="currentColor" d="M7.3 3.7c4.7-2.1 9.4 2.1 14.1 0v9.2c-4.7 2.1-9.4-2.1-14.1 0z"/>`,
  music: `<path fill="currentColor" d="M11.4 3.6 6.5 7.9H3.3c-.8 0-1.4.6-1.4 1.4v5.4c0 .8.6 1.4 1.4 1.4h3.2l4.9 4.3c.7.6 1.8.1 1.8-.8V4.4c0-.9-1.1-1.4-1.8-.8z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.1 8.5a4.9 4.9 0 0 1 0 7M18.7 6a8.6 8.6 0 0 1 0 12"/>`,
  volume: `<path fill="currentColor" d="M11.4 3.6 6.5 7.9H3.3c-.8 0-1.4.6-1.4 1.4v5.4c0 .8.6 1.4 1.4 1.4h3.2l4.9 4.3c.7.6 1.8.1 1.8-.8V4.4c0-.9-1.1-1.4-1.8-.8z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.1 8.5a4.9 4.9 0 0 1 0 7"/>`,
  hand: `<path fill="currentColor" stroke="rgba(70,40,15,.35)" stroke-width=".9" d="M9.2 11.2V5a1.9 1.9 0 0 1 3.8 0v5.3l4.6 1a2.3 2.3 0 0 1 1.8 2.5l-.5 3.8a4.2 4.2 0 0 1-4.2 3.6h-2.8a4.2 4.2 0 0 1-3.2-1.4l-3.5-4.1a2 2 0 0 1 2.9-2.7l1.1.9z"/>`,
};

/** coin badge showing current balance; call refresh() when coins change */
export function coinBadge(): HTMLDivElement & { refresh(): void } {
  const el = h("div", { class: "vz-coin-badge" }) as HTMLDivElement & { refresh(): void };
  const render = () => {
    el.innerHTML = `<span class="vz-coin-ic">${svgIcon(ICONS.coin, 20)}</span><span class="vz-coin-num">${faNum(Save.data.coins)}</span>`;
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
