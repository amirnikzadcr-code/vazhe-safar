/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/screens.ts
 *  Splash, Main menu, Chapter select, Level select, Settings,
 *  Progress, Rewards — built with vanilla DOM + CSS animations.
 * ------------------------------------------------------------------ */
import { h, faNum, wait } from "../core/utils";
import { Audio, MusicConfig } from "../core/audio";
import { Save, SaveData } from "../core/save";
import { CHAPTERS } from "../data/chapters";
import { T } from "../i18n";
import { ICONS, actionBtn, iconBtn, coinBadge, modal, toast, starRow, screenHeader, svgIcon } from "./components";
import { createMascot } from "./mascot";
import { chapterVignette } from "./vignette";

export interface Nav {
  goMenu(): void;
  goChapters(): void;
  goLevels(ch: number): void;
  goGameplay(ch: number, lv: number): void;
  goProgress(): void;
  goRewards(): void;
  goGuide(): void;
  openSettings(): void;
}

/** first not-yet-completed level across unlocked chapters (smart continue) */
export function continueTarget(): { ch: number; lv: number } {
  for (let ch = 1; ch <= 10; ch++) {
    if (!Save.chapterUnlocked(ch)) break;
    for (let lv = 1; lv <= 10; lv++) {
      if (!Save.data.levels[`${ch}:${lv}`]) return { ch, lv };
    }
  }
  return { ch: 1, lv: 1 };
}

/** scene-like hero bg used by several screens */
function heroBg(url: string, cls = ""): HTMLDivElement {
  const d = h("div", { class: `vz-hero ${cls}` });
  const img = h("img", { src: url, alt: "", draggable: "false" });
  d.append(img);
  return d;
}

const MENU_MUSIC: MusicConfig = {
  track: "menu",
  root: 261.63, cents: [0, 204, 340, 498, 702, 906, 1040], bpm: 56,
  meter: 6, perc: "none", lead: "ney", octave: 0, drone: 0.75,
  motif: [[0, 1.5], [1, 0.5], [2, 1], [1, 0.5], [0, 1.5], [-1, 0.5], [3, 1], [2, 0.5], [1, 0.5], [0, 3]],
  motifB: [[2, 0.5], [1, 0.5], [0, 1], [-1, 0.5], [1, 0.5], [0, 2.5]],
};

/* ================= SPLASH ================= */
export function showSplash(container: HTMLElement, onDone: () => void): () => void {
  const el = h("div", { class: "vz-screen vz-splash" });
  el.innerHTML = `
    <div class="vz-splash-ring"><div class="vz-splash-ring2"></div><div class="vz-splash-logo">✦</div></div>
    <h1 class="vz-splash-title">${T.gameTitle}</h1>
    <p class="vz-splash-tag">${T.gameTagline}</p>
    <div class="vz-splash-load"><div class="vz-splash-bar"></div></div>`;
  container.append(el);
  const t = setTimeout(onDone, 2300);
  return () => { clearTimeout(t); el.remove(); };
}

/* ================= MAIN MENU ================= */
export function showMenu(container: HTMLElement, nav: Nav): () => void {
  const el = h("div", { class: "vz-screen vz-menu" });
  el.append(heroBg("/assets/bg/menu.webp"));
  // ornamental Persian pattern wash over the hero (brown-on-brown)
  el.append(h("div", { class: "vz-menu-pattern", "aria-hidden": "true" }));

  const title = h("div", { class: "vz-menu-title" });
  title.innerHTML = `<h1>${T.gameTitle}</h1><p>${T.gameTagline}</p>`;

  const mascot = createMascot(96, "vz-mascot-menu");
  const col = h("div", { class: "vz-menu-col" });
  const target = continueTarget();
  const hasProgress = Save.totalWords() > 0;
  const playLabel = hasProgress ? T.continueGame : T.play;
  const playBtn = actionBtn(playLabel, "vz-primary vz-big-btn", () => {
    nav.goGameplay(target.ch, target.lv);
  }, ICONS.play);
  const chaptersBtn = actionBtn(T.chapters, "vz-secondary vz-big-btn", () => nav.goChapters(), ICONS.flag);
  const row = h("div", { class: "vz-menu-row" });
  row.append(
    iconBtn(ICONS.chart, T.progress, () => nav.goProgress()),
    iconBtn(ICONS.gift, T.rewards, () => nav.goRewards()),
    iconBtn(ICONS.book, T.guide, () => nav.goGuide()),
    iconBtn(ICONS.gear, T.settings, () => nav.openSettings()),
  );
  col.append(playBtn, chaptersBtn, row);
  el.append(title, mascot.el, col);
  container.append(el);

  Audio.ensure();
  Audio.startMusic(MENU_MUSIC);
  const greet = setTimeout(() => mascot.say(T.mascotMenu, 3600), 1400);
  return () => { clearTimeout(greet); el.remove(); };
}

/* ================= CHAPTER SELECT ================= */

/** girih-style 8-point star medallion (SVG) */
const GIRIH_STAR = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
  <g opacity="0.9">
    <path d="M24 4 L28 16 L40 12 L32 22 L44 24 L32 26 L40 36 L28 32 L24 44 L20 32 L8 36 L16 26 L4 24 L16 22 L8 12 L20 16 Z"/>
    <circle cx="24" cy="24" r="7.5" opacity="0.7"/>
  </g>
</svg>`;

export function showChapters(container: HTMLElement, nav: Nav): () => void {
  const el = h("div", { class: "vz-screen vz-chapters" });
  const coins = coinBadge();
  el.append(screenHeader(T.chooseChapter, () => nav.goMenu(), coins));
  const list = h("div", { class: "vz-ch-list" });
  const totalStars = Save.totalStars();

  // poetic lead line — makes the page feel alive, not a bare grid
  const lead = h("p", { class: "vz-ch-lead" });
  lead.innerHTML = `<span class="vz-ch-lead-star">${svgIcon(ICONS.starFill, 17)}</span> ${faNum(totalStars)} ${T.starsCount} · ${T.chooseChapter}`;
  list.append(lead);

  const chMascot = createMascot(64, "vz-mascot-chapters");
  list.append(chMascot.el);
  setTimeout(() => { chMascot.say(T.mascotChapters, 3600); }, 1200);

  CHAPTERS.forEach((ch) => {
    const unlocked = Save.chapterUnlocked(ch.id);
    let done = 0, stars = 0;
    for (let lv = 1; lv <= 10; lv++) {
      const r = Save.data.levels[`${ch.id}:${lv}`];
      if (r) { done++; stars += r.stars; }
    }
    const card = h("button", {
      class: `vz-ch-card ${unlocked ? "" : "locked"}`,
      type: "button",
      "aria-label": ch.title,
    });
    card.innerHTML = `
      <img class="vz-ch-bg" src="${ch.bg}" alt="" draggable="false" loading="lazy" decoding="async"/>
      <div class="vz-ch-shade"></div>
      <div class="vz-ch-arch"></div>
      <div class="vz-ch-emblem">${GIRIH_STAR}<span>${faNum(ch.id)}</span></div>
      <div class="vz-ch-info">
        <div class="vz-ch-num">${T.chapter} ${faNum(ch.id)}</div>
        <div class="vz-ch-title">${ch.title}</div>
        <div class="vz-ch-sub">${unlocked ? ch.subtitle : T.chapterLockedHint}</div>
      </div>
      <div class="vz-ch-meta">
        ${unlocked
          ? `<span class="vz-ch-stars">${svgIcon(ICONS.starFill, 15)} ${faNum(stars)}/۳۰</span><span class="vz-ch-prog">${faNum(done)}/۱۰</span>`
          : `<span class="vz-ch-lock">${svgIcon(ICONS.lock, 22)}</span>`}
      </div>
      <div class="vz-ch-steps" aria-label="${faNum(done)}/${faNum(10)}">
        ${Array.from({ length: 10 }, (_, i) =>
          `<i class="${i < done ? "done" : ""}"></i>`).join("")}
      </div>`;
    card.prepend(chapterVignette(ch.id));
    card.addEventListener("click", () => {
      if (!unlocked) { toast(T.completeChapter, "warn"); return; }
      nav.goLevels(ch.id);
    });
    list.append(card);
  });
  el.append(list);
  container.append(el);
  Audio.setMusicConfig(MENU_MUSIC);
  return () => el.remove();
}

/* ================= LEVEL SELECT ================= */
export function showLevels(container: HTMLElement, nav: Nav, chId: number): () => void {
  const theme = CHAPTERS[chId - 1];
  const el = h("div", {
    class: "vz-screen vz-levels",
    style: `--acc:${theme.accent};--acc2:${theme.accent2}`,
  });
  const coins = coinBadge();
  el.append(screenHeader(`${theme.title}`, () => nav.goChapters(), coins));

  const pathWrap = h("div", { class: "vz-lv-path" });
  // winding path: alternate left/right positions
  for (let lv = 1; lv <= 10; lv++) {
    const unlocked = Save.levelUnlocked(chId, lv);
    const rec = Save.data.levels[`${chId}:${lv}`];
    const node = h("button", {
      class: `vz-lv-node side-${lv % 2} ${unlocked ? "" : "locked"} ${rec ? "done" : ""}`,
      type: "button",
      style: `--side:${lv % 2 === 0 ? 58 : 12}%;`,
      "aria-label": `${T.level} ${lv}`,
    });
    node.innerHTML = `
      <span class="vz-lv-bubble">
        ${unlocked ? faNum(lv) : svgIcon(ICONS.lock, 20)}
      </span>
      ${rec ? `<span class="vz-lv-stars">${starRow(rec.stars, 3, 11).innerHTML}</span>` : ""}`;
    node.addEventListener("click", () => {
      if (!unlocked) { toast(T.levelLocked, "warn"); return; }
      nav.goGameplay(chId, lv);
    });
    pathWrap.append(node);
  }
  el.append(pathWrap);
  const hint = h("p", { class: "vz-lv-hint", text: `${theme.subtitle}` });
  el.append(hint);
  container.append(el);
  Audio.setMusicConfig(theme.music);
  return () => el.remove();
}

/* ================= SETTINGS ================= */
export function showSettings(container: HTMLElement, onClose: () => void): () => void {
  const m = buildSettingsModal(onClose);
  container.append(m.el);
  return () => m.el.remove();
}

export function buildSettingsModal(onClose: () => void) {
  const body = h("div", { class: "vz-settings-body" });
  body.append(h("h3", { class: "vz-modal-title", text: T.settings }));

  const s = Save.data.settings;
  const rows = h("div", { class: "vz-set-rows" });

  const mkToggle = (label: string, key: keyof SaveData["settings"], onChange?: () => void) => {
    const row = h("div", { class: "vz-set-row" });
    const lb = h("span", { class: "vz-set-lb", text: label });
    const btn = h("button", { class: `vz-switch ${s[key] ? "on" : ""}`, type: "button", role: "switch", "aria-checked": String(s[key]) });
    const knob = h("span", { class: "vz-switch-knob" });
    btn.append(knob);
    btn.addEventListener("click", () => {
      const v = !(s[key] as boolean);
      (s[key] as boolean) = v;
      Save.setSetting(key, v);
      btn.classList.toggle("on", v);
      btn.setAttribute("aria-checked", String(v));
      Audio.sfxClick();
      onChange?.();
    });
    row.append(lb, btn);
    rows.append(row);
  };

  const mkSlider = (label: string, key: "musicVol" | "sfxVol", onChange: (v: number) => void) => {
    const row = h("div", { class: "vz-set-row col" });
    const lb = h("span", { class: "vz-set-lb", text: label });
    const input = h("input", { type: "range", min: "0", max: "100", value: String(Math.round(s[key] * 100)) }) as HTMLInputElement;
    input.addEventListener("input", () => {
      const v = input.valueAsNumber / 100;
      Save.setSetting(key, v);
      onChange(v);
    });
    row.append(lb, input);
    rows.append(row);
  };

  mkToggle(T.music, "music", () => Audio.setMusicOn(Save.data.settings.music));
  mkSlider(T.musicVolume, "musicVol", (v) => Audio.setMusicVol(v));
  mkToggle(T.sound, "sfx", () => Audio.setSfxOn(Save.data.settings.sfx));
  mkSlider(T.soundVolume, "sfxVol", (v) => Audio.setSfxVol(v));
  mkToggle(T.haptics, "haptics");

  const resetBtn = actionBtn(T.resetProgress, "vz-danger", () => {
    const confirmBody = h("div", { class: "vz-confirm" });
    confirmBody.append(h("p", { text: T.resetConfirm }));
    const bb = h("div", { class: "vz-modal-btns" });
    bb.append(
      actionBtn(T.yes, "vz-danger", () => {
        Save.reset();
        cm.close();
        sm.close();
        toast(T.back);
        location.reload();
      }),
      actionBtn(T.no, "vz-secondary", () => cm.close()),
    );
    confirmBody.append(bb);
    const cm = modal(confirmBody, { closable: true });
    sm.el.querySelector(".vz-modal-card")?.append(cm.el);
  });

  body.append(rows, h("p", { class: "vz-about", text: T.aboutText }), resetBtn);
  const sm = modal(body, { closable: true, onClose });
  return sm;
}

/* ================= PROGRESS ================= */
export function showProgress(container: HTMLElement, nav: Nav): () => void {
  const el = h("div", { class: "vz-screen vz-progress" });
  el.append(screenHeader(T.progress, () => nav.goMenu(), coinBadge()));

  const stats = h("div", { class: "vz-stats" });
  const items: [string, string, string][] = [
    [svgIcon(ICONS.starFill, 24), T.totalStars, `${faNum(Save.totalStars())} / ${faNum(300)}`],
    [svgIcon(ICONS.play, 24), T.levelsDone, `${faNum(Save.totalWords())} / ${faNum(100)}`],
    [svgIcon(ICONS.shuffle, 24), T.totalBonus, faNum(Save.totalBonus())],
    [svgIcon(ICONS.coin, 24), T.coins, faNum(Save.data.coins)],
  ];
  for (const [ic, lb, val] of items) {
    const card = h("div", { class: "vz-stat-card" });
    card.innerHTML = `<span class="vz-stat-ic">${ic}</span><span class="vz-stat-val">${val}</span><span class="vz-stat-lb">${lb}</span>`;
    stats.append(card);
  }

  const chList = h("div", { class: "vz-prog-chs" });
  CHAPTERS.forEach((ch) => {
    let stars = 0, done = 0;
    for (let lv = 1; lv <= 10; lv++) {
      const r = Save.data.levels[`${ch.id}:${lv}`];
      if (r) { done++; stars += r.stars; }
    }
    const row = h("button", { class: "vz-prog-row", type: "button" });
    row.innerHTML = `
      <span class="vz-prog-name">${ch.title}</span>
      <span class="vz-prog-bar"><i style="width:${stars / 30 * 100}%"></i></span>
      <span class="vz-prog-val">${svgIcon(ICONS.starFill, 14)}${faNum(stars)}/۳۰</span>`;
    row.addEventListener("click", () => {
      if (Save.chapterUnlocked(ch.id)) nav.goLevels(ch.id);
    });
    chList.append(row);
  });

  el.append(stats, chList);
  container.append(el);
  return () => el.remove();
}

/* ================= REWARDS ================= */
export function showRewards(container: HTMLElement, nav: Nav): () => void {
  const el = h("div", { class: "vz-screen vz-rewards" });
  const coins = coinBadge();
  el.append(screenHeader(T.rewards, () => nav.goMenu(), coins));

  const wrap = h("div", { class: "vz-rewards-body" });
  el.append(wrap);

  // re-render in place — NEVER stack a second screen over the old one
  const rerender = (): void => {
    wrap.innerHTML = "";
    buildGiftCard(wrap, coins, rerender);
    wrap.append(h("h3", { class: "vz-sub-title", text: T.chapterChest }));
    const chestGrid = h("div", { class: "vz-chest-grid" });
    CHAPTERS.forEach((ch) => {
      const done = Save.levelsDoneInChapter(ch.id);
      const complete = done >= 10;
      const claimed = Save.hasChest(ch.id);
      const card = h("div", { class: `vz-chest-card ${claimed ? "claimed" : ""} ${complete && !claimed ? "ready" : ""}` });
      card.innerHTML = `
        <span class="vz-chest-ic">${svgIcon(claimed ? ICONS.check : complete ? ICONS.gift : ICONS.lock, 26)}</span>
        <span class="vz-chest-name">${ch.title}</span>
        <span class="vz-chest-val">${complete ? (claimed ? "دریافت شد" : `۱۵۰ ${svgIcon(ICONS.coin, 14)}`) : `${faNum(done)}/۱۰`}</span>`;
      if (complete && !claimed) {
        card.addEventListener("click", () => {
          Save.claimChest(ch.id);
          Audio.sfxChapterUnlock();
          toast(`+${faNum(150)} ${svgIcon(ICONS.coin, 15)}`);
          coins.refresh();
          rerender();
        });
      }
      chestGrid.append(card);
    });
    wrap.append(chestGrid);
  };
  rerender();
  container.append(el);
  return () => el.remove();
}

function buildGiftCard(
  wrap: HTMLElement,
  coins: HTMLDivElement & { refresh(): void },
  rerender: () => void,
): void {
  const giftCard = h("div", { class: "vz-gift-card" });
  const today = new Date().toISOString().slice(0, 10);
  const taken = Save.data.dailyGiftDay === today;
  giftCard.innerHTML = `
    <span class="vz-gift-ic ${taken ? "dim" : "swing"}">${svgIcon(ICONS.gift, 34)}</span>
    <div class="vz-gift-info"><b>${T.dailyGift}</b><span>${taken ? "امروز دریافت شد" : "۵۰ سکه منتظر شماست"}</span></div>`;
  if (!taken) {
    const claim = actionBtn(T.claimReward, "vz-primary", () => {
      const got = Save.claimDailyGift();
      if (got) {
        Audio.sfxCoin();
        toast(`+${faNum(got)} ${svgIcon(ICONS.coin, 15)} — ${T.dailyGiftMsg}`);
        coins.refresh();
        rerender();
      }
    });
    giftCard.append(claim);
  }
  wrap.append(giftCard);
}

/* ================= GUIDE (راهنما) ================= */
export function showGuide(container: HTMLElement, nav: Nav): () => void {
  const el = h("div", { class: "vz-screen vz-guide" });
  const coins = coinBadge();
  el.append(screenHeader(T.guide, () => nav.goMenu(), coins));

  const body = h("div", { class: "vz-guide-body" });

  const step = (
    ic: string,
    title: string,
    text: string,
  ): HTMLElement => {
    const card = h("div", { class: "vz-guide-card" });
    card.innerHTML = `
      <span class="vz-guide-ic">${ic}</span>
      <div class="vz-guide-txt"><b>${title}</b><p>${text}</p></div>`;
    return card;
  };

  body.append(h("h3", { class: "vz-sub-title", text: T.guideHowTitle }));
  body.append(buildGuideDemo());
  body.append(
    step(svgIcon(ICONS.hand, 24), T.guide1T, T.guide1B),
    step(svgIcon(ICONS.play, 24), T.guide2T, T.guide2B),
    step(svgIcon(ICONS.star, 24), T.guide3T, T.guide3B),
    step(svgIcon(ICONS.coin, 24), T.guide4T, T.guide4B),
    step(svgIcon(ICONS.bulb, 24), T.guide5T, T.guide5B),
  );

  body.append(h("h3", { class: "vz-sub-title", text: T.guideScoreTitle }));
  const table = h("div", { class: "vz-guide-table" });
  const rows: [string, string][] = [
    [svgIcon(ICONS.check, 20), T.guideS1],
    [svgIcon(ICONS.coin, 20), T.guideS2],
    [svgIcon(ICONS.starFill, 20), T.guideS3],
    [svgIcon(ICONS.gift, 20), T.guideS4],
  ];
  for (const [ic, tx] of rows) {
    const r = h("div", { class: "vz-guide-row" });
    r.innerHTML = `<span class="vz-guide-ric">${ic}</span><span>${tx}</span>`;
    table.append(r);
  }
  body.append(table);

  body.append(h("h3", { class: "vz-sub-title", text: T.guideTipsTitle }));
  const tips = h("ul", { class: "vz-guide-tips" });
  for (const tip of [T.guideTip1, T.guideTip2, T.guideTip3]) tips.append(h("li", { text: tip }));
  body.append(tips);

  body.append(h("p", { class: "vz-guide-credits", text: T.aboutText }));
  el.append(body);
  container.append(el);
  return () => el.remove();
}

/** animated mini wheel: shows the drag path drawing itself, loops forever */
function buildGuideDemo(): HTMLElement {
  const demo = h("div", { class: "vz-guide-demo", "aria-hidden": "true" });
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "vz-gd-path");
  svg.setAttribute("viewBox", "0 0 150 110");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M 118 30 L 96 82 L 54 82 L 32 30");
  svg.append(path);
  // three letter nodes + word result
  const nodes: [number, number, string][] = [
    [118, 30, "ب"], [96, 82, "ا"], [54, 82, "ر"],
  ];
  for (const [x, y, chTxt] of nodes) {
    const n = h("span", { class: "vz-gd-node", text: chTxt });
    n.style.left = `${x - 15}px`;
    n.style.top = `${y - 15}px`;
    demo.append(n);
  }
  demo.append(svg);
  return demo;
}
