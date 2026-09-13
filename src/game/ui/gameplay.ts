/* ------------------------------------------------------------------
 *  واژه‌سفر — ui/gameplay.ts
 *  The heart of the game: living scene (bg + props + particles),
 *  RTL crossword board, letter wheel, hints/coins/celebrations.
 * ------------------------------------------------------------------ */
import { h, rng, faNum, canBuild, wait, buzz, clamp } from "../core/utils";
import { Audio } from "../core/audio";
import { Save, COSTS, REWARDS } from "../core/save";
import { Audio_cue } from "../fx/particles";
import { CHAPTERS, ChapterTheme } from "../data/chapters";
import { getLevel, isRealWord } from "../data/levelsIndex";
import { makeCrossword, CrosswordLayout } from "../crossword";
import { ParticleFX } from "../fx/particles";
import { makeProp } from "../fx/props";
import { T } from "../i18n";
import { createWheel, WheelHandle } from "./wheel";
import { createMascot } from "./mascot";
import { actionBtn, iconBtn, ICONS, coinBadge, modal, toast, starRow, svgIcon } from "./components";

export interface GameplayResult { done: boolean }

export function showGameplay(
  container: HTMLElement,
  chId: number,
  lvId: number,
  onExit: () => void,
  onNext: (ch: number, lv: number) => void,
  onOpenSettings: () => void,
  onOpenGuide?: () => void,
): () => void {
  const theme = CHAPTERS[chId - 1];
  const level = getLevel(chId, lvId);
  const layout: CrosswordLayout | null = makeCrossword(level.words, level.id * 100 + chId);
  if (!layout) {
    // extremely defensive: should never happen (validated offline)
    console.error("layout failed", chId, lvId);
    onExit();
    return () => {};
  }

  /* ---------- root structure ---------- */
  const screen = h("div", { class: "vz-screen vz-gameplay", style: `--acc:${theme.accent};--acc2:${theme.accent2}` });

  const scene = h("div", { class: "vz-scene" });
  const bgWrap = h("div", { class: "vz-bgwrap" });
  const bg = h("img", { class: "vz-bg", src: theme.bg, alt: theme.title, draggable: "false" });
  bgWrap.append(bg);
  const propsLayer = h("div", { class: "vz-props" });
  const canvas = h("canvas", { class: "vz-fx" }) as HTMLCanvasElement;
  const veil = h("div", { class: "vz-veil" });

  const hud = h("div", { class: "vz-hud" });
  const pauseBtn = iconBtn(ICONS.pause, T.pause, () => openPause(), "vz-pause-btn");
  const coins = coinBadge();
  const titleEl = h("div", { class: "vz-level-title" },
    h("span", { class: "vz-lv-ch", text: `${T.chapter} ${faNum(chId)}` }),
    h("span", { class: "vz-lv-dot", text: "·" }),
    h("span", { class: "vz-lv-n", text: `${T.level} ${faNum(lvId)}` }));
  hud.append(pauseBtn, titleEl, coins);

  scene.append(bgWrap, propsLayer, canvas, veil, hud);

  /* crossword board */
  const board = h("div", { class: "vz-board" });

  /* words progress pill + remaining word-length dots (clarity: "what's left?") */
  const wordsRow = h("div", { class: "vz-words-row" });
  const pill = h("div", { class: "vz-words-pill" });
  const dots = h("div", { class: "vz-word-dots", "aria-label": T.dotsLabel });
  wordsRow.append(pill, dots);

  /* bottom: wheel first, then the tidy helper row BELOW it — no overlap
     with the board, everything fits on screen (v1.3) */
  const bottom = h("div", { class: "vz-bottom" });
  const controls = h("div", { class: "vz-controls" });
  const mkHelp = (icon: string, label: string, cost: number | null, onClick: () => void, cls = ""): HTMLButtonElement => {
    const b = h("button", { class: `vz-help-btn ${cls}`, type: "button", "aria-label": label });
    b.innerHTML = `
      <span class="vz-help-ic">${svgIcon(icon, 26)}</span>
      <span class="vz-help-lb">${label}</span>
      ${cost != null ? `<span class="vz-help-cost">${svgIcon(ICONS.coin, 12)} ${faNum(cost)}</span>` : ""}`;
    b.addEventListener("click", () => {
      Audio.sfxClick();
      buzz(12, Save.data.settings.haptics);
      b.classList.remove("tap");
      void b.offsetWidth;
      b.classList.add("tap");
      onClick();
    });
    return b;
  };
  const shuffleBtn = mkHelp(ICONS.shuffle, T.shuffle, null, () => {
    wheel.shuffle();
    Audio.sfxShuffle();
  });
  const undoBtn = mkHelp(ICONS.undo, T.undo, null, () => {
    wheel.clearPath();
  });
  const hintBtn = mkHelp(ICONS.bulb, T.hint, COSTS.hint, () => useHint(), "vz-hint-btn");
  controls.append(shuffleBtn, undoBtn, hintBtn);
  const wheelHost = h("div", { class: "vz-wheel-host" });
  bottom.append(wheelHost, controls);

  screen.append(scene, board, wordsRow, bottom);
  container.append(screen);

  /* ---------- state ---------- */
  const wheel: WheelHandle = createWheel(level.id * 977 + chId * 31, level.wheel);
  wheelHost.append(wheel.el);

  const fx = new ParticleFX(canvas);
  Audio_cue.firework = () => { Audio.sfxBoom(); };

  let foundWords = new Set<string>();
  let mistakes = 0;
  let hintsUsed = 0;
  let bonusFound = new Set<string>();
  let hintCells = new Set<string>(); // "r,c" revealed by hints
  let cellEls = new Map<string, HTMLElement>();
  let finished = false;
  let destroyed = false;
  let propCount = 0;

  /* ---------- crossword board rendering ---------- */
  const buildBoard = (): void => {
    board.innerHTML = "";
    cellEls = new Map();
    const grid = h("div", {
      class: "vz-grid",
      style: `--cols:${layout!.cols};--rows:${layout!.rows};`,
    });
    for (let r = 0; r < layout!.rows; r++) {
      for (let c = 0; c < layout!.cols; c++) {
        const ch = layout!.grid[r][c];
        if (!ch) {
          grid.append(h("div", { class: "vz-cell-empty" }));
          continue;
        }
        const key = `${r},${c}`;
        const cell = h("div", { class: "vz-cell", "data-key": key });
        if (hintCells.has(key)) {
          cell.classList.add("hinted");
          cell.textContent = ch;
        }
        cellEls.set(key, cell);
        grid.append(cell);
      }
    }
    board.append(grid);
    sizeBoard();
  };

  const sizeBoard = (): void => {
    const grid = board.querySelector(".vz-grid") as HTMLElement | null;
    if (!grid) return;
    const availW = screen.clientWidth - 32 - 30; // side margins + panel padding
    // vertical budget: screen − scene − fixed bottom block (min wheel + helpers) + top overlap
    const sceneH = scene.offsetHeight;
    const BOTTOM_RESERVE = 296; // helpers (~64) + wheel min (200) + paddings
    const TOP_OVERLAP = 26;     // board overlaps scene via negative margin
    const availH = Math.max(72, screen.clientHeight - sceneH - BOTTOM_RESERVE + TOP_OVERLAP);
    const cell = Math.floor(Math.min(
      (availW - (layout!.cols - 1) * 5) / layout!.cols,
      (availH - (layout!.rows - 1) * 5) / layout!.rows,
      46,
    ));
    grid.style.setProperty("--cell", `${clamp(cell, 22, 46)}px`);
  };

  const fillWord = (word: string, cls = "found"): void => {
    const p = layout!.placements.find((q) => q.word === word);
    if (!p) return;
    const ls = Array.from(word);
    for (let i = 0; i < ls.length; i++) {
      const r = p.dir === "v" ? p.r + i : p.r;
      const c = p.dir === "h" ? p.c - i : p.c;
      const cell = cellEls.get(`${r},${c}`);
      if (cell) {
        cell.textContent = ls[i];
        cell.classList.add(cls);
        cell.style.animationDelay = `${i * 55}ms`;
      }
    }
  };

  /* ---------- words progress rendering ---------- */
  const renderWordsRow = (): void => {
    const foundN = foundWords.size;
    const totalN = level.words.length;
    pill.innerHTML = `${T.wordsProgress}&nbsp;<b>${faNum(foundN)}/${faNum(totalN)}</b>`;
    dots.innerHTML = "";
    // one bubble per word length (sorted) — done ones turn gold
    const lens = [...level.words].sort((a, b) => a.length - b.length);
    const doneLens = [...foundWords].map((w) => w.length);
    const consumed = new Set<number>();
    lens.forEach((w, i) => {
      const d = h("span", { class: "vz-word-dot", text: faNum(w.length) });
      d.style.animationDelay = `${i * 60}ms`;
      const idx = doneLens.findIndex((L, j) => L === w.length && !consumed.has(j));
      if (idx >= 0) { consumed.add(idx); d.classList.add("done"); }
      dots.append(d);
    });
  };

  /* ---------- props (the world comes alive) ---------- */

  const spawnProp = (animate = true): void => {
    const pool = theme.propPool;
    const zones = theme.zones;
    const idx = propCount;
    const propId = pool[idx % pool.length];
    const zone = zones[idx % zones.length];
    const rand = rng(level.id * 3571 + idx * 97);
    const jitterX = (rand() - 0.5) * 8;
    const jitterY = (rand() - 0.5) * 6;
    const scale = zone.s * (0.85 + rand() * 0.4);
    const prop = makeProp(
      propId, theme.c1, theme.c2,
      scale,
      clamp(zone.x + jitterX, 3, 90),
      clamp(zone.y + jitterY, 8, 86),
      animate ? 0 : 0,
      2 + (idx % 4),
    );
    if (!animate) prop.classList.add("no-anim");
    propsLayer.append(prop);
    propCount++;
    if (animate) {
      const rect = prop.getBoundingClientRect();
      const srect = scene.getBoundingClientRect();
      fx.burst(rect.left - srect.left + rect.width / 2, rect.top - srect.top + rect.height / 2, theme.accent2, 22);
      Audio.sfxPropAppear();
    }
  };

  /* ---------- word validation ---------- */

  const allBonusCheck = (word: string): boolean =>
    (isRealWord(word) || level.bonus.includes(word)) && canBuild(word, level.wheel);

  const submitWord = (word: string): void => {
    if (finished) return;
    if (foundWords.has(word)) {
      toast(T.alreadyFound, "warn");
      return;
    }
    if (level.words.includes(word)) {
      foundWords.add(word);
      fillWord(word);
      Audio.sfxWordFound(foundWords.size);
      // golden star-ring on the word's first cell (v1.3 celebration)
      const p0 = layout!.placements.find((q) => q.word === word);
      if (p0) {
        const cellKey = p0.dir === "v" ? `${p0.r},${p0.c}` : `${p0.r},${p0.c}`;
        const cellEl = cellEls.get(cellKey);
        if (cellEl) {
          const cr = cellEl.getBoundingClientRect();
          const sr = scene.getBoundingClientRect();
          fx.starRing(cr.left - sr.left + cr.width / 2, cr.top - sr.top + cr.height / 2);
        }
      }
      Save.addCoins(REWARDS.perWord);
      coins.refresh();
      buzz([15, 30, 15], Save.data.settings.haptics);
      spawnProp(true);
      floatWord(word, false);
      renderWordsRow();
      tutorialOnWord(foundWords.size);
      if (foundWords.size === level.words.length) {
        setTimeout(() => completeLevel(), 900);
      }
      return;
    }
    if (allBonusCheck(word)) {
      bonusFound.add(word);
      Save.addBonusWord(chId, lvId, word);
      Save.addCoins(REWARDS.perBonus);
      coins.refresh();
      Audio.sfxBonus();
      fx.burst(screen.clientWidth / 2, board.offsetTop + board.clientHeight / 2, "#ffd76e", 30);
      toast(`${T.bonusWordFound}: «${word}»`);
      buzz([10, 40, 10, 40, 20], Save.data.settings.haptics);
      floatWord(word, true);
      return;
    }
    // wrong
    mistakes++;
    Audio.sfxWrong();
    buzz(60, Save.data.settings.haptics);
    wheelHost.classList.add("shake");
    setTimeout(() => wheelHost.classList.remove("shake"), 420);
  };

  wheel.onSubmit = submitWord;

  const floatWord = (word: string, isBonus: boolean): void => {
    const f = h("div", { class: `vz-float-word ${isBonus ? "bonus" : ""}`, text: isBonus ? `${word} ✦` : word });
    f.style.setProperty("--fw-x", `${40 + Math.random() * 20}%`);
    scene.append(f);
    setTimeout(() => f.remove(), 1600);
  };

  /* ---------- hint ---------- */

  function useHint(): void {
    const remaining = level.words.filter((w) => !foundWords.has(w));
    if (!remaining.length) return;
    if (!Save.spendCoins(COSTS.hint)) {
      toast(T.notEnoughCoins, "warn");
      Audio.sfxWrong();
      return;
    }
    coins.refresh();
    Audio.sfxHint();
    hintsUsed++;
    // pick first cell of a random remaining word (prefer words already started)
    const rand = rng(Date.now() % 100000);
    const word = remaining[Math.floor(rand() * remaining.length)];
    const p = layout!.placements.find((q) => q.word === word)!;
    const order: [number, number][] = [];
    for (let i = 0; i < word.length; i++) {
      const r = p.dir === "v" ? p.r + i : p.r;
      const c = p.dir === "h" ? p.c - i : p.c;
      order.push([r, c]);
    }
    const target = order.find(([r, c]) => {
      const cell = cellEls.get(`${r},${c}`);
      return cell && !cell.classList.contains("found") && !cell.classList.contains("hinted");
    }) ?? order[0];
    const [tr, tc] = target;
    const cell = cellEls.get(`${tr},${tc}`);
    if (cell) {
      cell.classList.add("hinted");
      cell.textContent = layout!.grid[tr][tc] ?? "";
      hintCells.add(`${tr},${tc}`);
      cell.classList.add("flash");
      setTimeout(() => cell.classList.remove("flash"), 1200);
    }
    wheel.pulseLetters(word);
    toast(T.hintUsed);
  }

  /* ---------- pause ---------- */

  function openPause(): void {
    Audio.sfxClick();
    fx.setPaused(true);
    const content = h("div", { class: "vz-pause-body" });
    content.append(h("h3", { class: "vz-modal-title", text: T.pause }));
    const btns = h("div", { class: "vz-modal-btns" });
    const resume = actionBtn(T.resume, "vz-primary", () => { m.close(); });
    const restart = actionBtn(T.restart, "vz-secondary", () => {
      m.close();
      restartLevel();
    }, ICONS.restart);
    const settingsB = actionBtn(T.settings, "vz-secondary", () => {
      m.close();
      onOpenSettings();
    }, ICONS.gear);
    const guideB = actionBtn(T.guide, "vz-secondary", () => {
      m.close();
      if (onOpenGuide) onOpenGuide();
    }, ICONS.book);
    const exit = actionBtn(T.exit, "vz-secondary", () => {
      m.close();
      onExit();
    }, ICONS.home);
    btns.append(resume, restart, guideB, settingsB, exit);
    content.append(btns);
    const m = modal(content, { closable: true, onClose: () => fx.setPaused(false) });
    screen.append(m.el);
  }

  const restartLevel = (): void => {
    foundWords = new Set();
    mistakes = 0;
    hintsUsed = 0;
    bonusFound = new Set();
    hintCells = new Set();
    propCount = 0;
    propsLayer.innerHTML = "";
    buildBoard();
    renderWordsRow();
    wheel.shuffle();
  };

  /* ---------- level complete ---------- */

  async function completeLevel(): Promise<void> {
    if (finished) return;
    finished = true;
    const noMistakes = mistakes === 0;
    const stars = noMistakes ? 3 : mistakes <= 2 ? 2 : 1;
    Save.completeLevel(chId, lvId, stars, mistakes);
    Save.addCoins(REWARDS.perStar * stars);
    coins.refresh();
    Audio.sfxLevelComplete(stars);
    fx.confetti(80);
    buzz([30, 60, 30, 60, 80], Save.data.settings.haptics);
    await wait(1400);

    const isChapterEnd = lvId === 10;
    const content = h("div", { class: "vz-complete-body" });
    content.append(h("h3", { class: "vz-modal-title big", text: T.levelComplete }));
    const starsEl = h("div", { class: "vz-complete-stars" });
    for (let i = 0; i < 3; i++) {
      const s = h("span", { class: `vz-big-star ${i < stars ? "on" : ""}` });
      s.innerHTML = svgIcon(ICONS.starFill, 54);
      s.style.animationDelay = `${i * 280}ms`;
      starsEl.append(s);
    }
    content.append(starsEl);
    if (noMistakes) content.append(h("div", { class: "vz-perfect", text: bonusFound.size ? T.perfectLevel : T.noMistakes }));
    else if (stars === 2) content.append(h("div", { class: "vz-perfect soft", text: T.goodLevel }));

    const mascot = createMascot(84);
    mascot.setPose("cheer");
    mascot.say(stars === 3 ? T.mascotPerfect : T.mascotGood, 3200);
    content.append(mascot.el);

    const earned = REWARDS.perStar * stars;
    content.append(h("div", { class: "vz-reward-line" },
      h("span", { class: "vz-reward-inline" },
        h("span", { text: `+${faNum(earned)}` }),
        h("span", { class: "vz-reward-coin", innerHTML: svgIcon(ICONS.coin, 18) }))));
    if (bonusFound.size) content.append(h("div", { class: "vz-reward-line sub", text: `${T.bonusWords}: ${faNum(bonusFound.size)}` }));

    const btns = h("div", { class: "vz-modal-btns" });
    if (isChapterEnd) {
      const next = actionBtn(T.nextChapter, "vz-primary", () => {
        m.close();
        showChapterComplete();
      }, ICONS.flag);
      const back = actionBtn(T.backToLevels, "vz-secondary", () => { m.close(); onExit(); });
      btns.append(next, back);
    } else {
      const next = actionBtn(T.nextLevel, "vz-primary", () => {
        m.close();
        onNext(chId, lvId + 1);
      }, ICONS.play);
      const back = actionBtn(T.backToLevels, "vz-secondary", () => { m.close(); onExit(); });
      btns.append(next, back);
    }
    content.append(btns);
    const m = modal(content, { closable: false });
    screen.append(m.el);

    if (stars > 0) {
      for (let i = 0; i < stars; i++) setTimeout(() => Audio.sfxStar(), 500 + i * 280);
    }
  }

  /* ---------- chapter complete (finale) ---------- */

  function showChapterComplete(): void {
    // full-screen cinematic
    const cine = h("div", { class: "vz-chapter-complete" });
    cine.style.setProperty("--acc", theme.accent);
    const bgImg = h("img", { class: "vz-cine-bg", src: theme.bg, alt: "" });
    const inner = h("div", { class: "vz-cine-inner" });
    const h1 = h("h2", { class: "vz-cine-title", text: T.chapterComplete });
    const h2 = h("div", { class: "vz-cine-ch", text: `${theme.title}` });
    const p = h("p", { class: "vz-cine-text", text: theme.finaleText });
    const chest = h("button", { class: "vz-chest", type: "button" });
    chest.innerHTML = `<span class="vz-chest-emoji">${svgIcon(ICONS.gift, 34)}</span><span class="vz-chest-lb">${T.claimReward}</span>`;
    chest.addEventListener("click", () => {
      if (Save.claimChest(chId)) {
        Audio.sfxCoin();
        chest.innerHTML = `<span class="vz-chest-emoji">${svgIcon(ICONS.coin, 34)}</span><span class="vz-chest-lb">+${faNum(150)}</span>`;
        chest.classList.add("claimed");
        coins.refresh();
        fx.confetti(120);
      }
    });
    const nextBtn = actionBtn(
      chId < 10 ? T.nextChapter : T.progress,
      "vz-primary vz-cine-btn",
      () => {
        cine.remove();
        if (chId < 10) onNext(chId + 1, 1);
        else onExit();
      },
    );
    inner.append(h1, h2, p, chest, nextBtn);
    cine.append(bgImg, inner);
    screen.append(cine);
    requestAnimationFrame(() => cine.classList.add("show"));
    Audio.sfxChapterUnlock();
    // finale effect
    switch (theme.finale) {
      case "fireworks": case "meteor": fx.fireworks(7); break;
      case "lanterns": case "villageGlow": case "dusk": fx.confetti(90); break;
      default: fx.confetti(70);
    }
  }

  /* ---------- tutorial (mascot narrator + hand tracing real letters) ---------- */

  // steps react to real progress: hand demo → board → world → hint.
  // Each step can be advanced by tap or automatically by finding words.
  const tutHost = (() => {
    if (!(chId === 1 && lvId === 1 && !Save.data.tutorialDone)) return null;

    const tut = h("div", { class: "vz-tutorial" });
    const dim = h("div", { class: "vz-tut-dim dim-wheel" });
    const card = h("div", { class: "vz-tut-card" });
    const row = h("div", { class: "vz-tut-row" });
    const mascot = createMascot(74);
    const txt = h("p", { class: "vz-tut-txt" });
    const dotsNav = h("div", { class: "vz-tut-dots" });
    const nextB = actionBtn(T.next, "vz-primary", () => advance());
    row.append(mascot.el, txt);
    card.append(row, dotsNav, nextB);
    tut.append(dim, card);
    screen.append(tut);

    // glove hand — animated along the REAL letters of the first word (v1.3)
    const hand = h("div", { class: "vz-tut-hand show", "aria-hidden": "true" });
    hand.innerHTML =
      `<svg viewBox="0 0 24 24" width="56" height="56" fill="rgba(255,244,214,0.97)" stroke="#8a5a24" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 5px 12px rgba(0,0,0,.6))">${ICONS.hand}</svg>`;
    tut.append(hand);
    let handAnim: Animation | null = null;

    const stopHandDemo = (): void => {
      handAnim?.cancel();
      handAnim = null;
    };
    const startHandDemo = (): void => {
      stopHandDemo();
      // trace the actual first letters of the first target word
      const target = Array.from(level.words[0]).slice(0, 3);
      const idxs: number[] = [];
      const used = new Set<number>();
      for (const ch of target) {
        for (let i = 0; i < wheel.letterCount(); i++) {
          if (wheel.letterChar(i) === ch && !used.has(i)) { used.add(i); idxs.push(i); break; }
        }
      }
      const tr = tut.getBoundingClientRect();
      const pts = idxs
        .map((i) => wheel.letterCenter(i))
        .filter((p): p is { x: number; y: number } => !!p)
        .map((p) => ({ x: p.x - tr.left, y: p.y - tr.top }));
      if (pts.length < 2) return;
      const off = 28; // half hand size
      // dwell at each letter so the gesture reads clearly
      const frames: Keyframe[] = [];
      pts.forEach((p, i) => {
        frames.push({ transform: `translate(${p.x - off}px, ${p.y - off}px) scale(1.12)`, offset: (i * 2) / (pts.length * 2 - 1) });
        if (i < pts.length - 1)
          frames.push({ transform: `translate(${p.x - off}px, ${p.y - off}px) scale(1)`, offset: (i * 2 + 1) / (pts.length * 2 - 1) });
      });
      frames.push({ transform: `translate(${pts[0].x - off}px, ${pts[0].y - off}px) scale(1.12)` });
      handAnim = hand.animate(frames, {
        duration: 700 * pts.length + 500,
        iterations: Infinity,
        easing: "ease-in-out",
      });
    };
    const onR = (): void => { if (step === 0) startHandDemo(); };
    window.addEventListener("resize", onR);

    const steps: { text: string; dim: string; hand: boolean; pose: "point" | "idle" }[] = [
      { text: T.tutHandStep, dim: "dim-wheel", hand: true, pose: "point" },
      { text: T.tutBoardStep, dim: "dim-board", hand: false, pose: "idle" },
      { text: T.tutWorldStep, dim: "dim-scene", hand: false, pose: "idle" },
      { text: T.tutHintStep, dim: "dim-helpers", hand: false, pose: "point" },
    ];
    let step = 0;
    const render = (): void => {
      txt.textContent = steps[step].text;
      dotsNav.innerHTML = "";
      steps.forEach((_, i) => dotsNav.append(h("span", { class: `vz-tut-dot ${i === step ? "on" : ""}` })));
      dim.className = `vz-tut-dim ${steps[step].dim}`;
      hand.classList.toggle("show", steps[step].hand);
      mascot.setPose(steps[step].pose);
      if (steps[step].hand) startHandDemo(); else stopHandDemo();
      nextB.querySelector(".vz-btn-lb")!.textContent = step === steps.length - 1 ? T.playNow : T.next;
      Audio.sfxClick();
    };
    const finish = (): void => {
      stopHandDemo();
      Save.markTutorialDone();
      tut.classList.add("hide");
      setTimeout(() => tut.remove(), 420);
      window.removeEventListener("resize", onR);
      wheel.pulseLetters(level.words[0], 1200);
    };
    function advance(): void {
      step++;
      if (step < steps.length) render();
      else finish();
    }
    render();
    // friendly greeting from the guide bird
    setTimeout(() => { mascot.say(T.tutWelcome, 4200); }, 700);
    return {
      onWord: (): void => { if (step < steps.length) { step++; if (step < steps.length) render(); else finish(); } },
      hide: (): void => { if (step < steps.length) { step = steps.length; finish(); } },
    };
  })();

  /** called after each found word — lets the tutorial react to real play */
  function tutorialOnWord(foundN: number): void {
    if (!tutHost) return;
    if (foundN === 1 || foundN === 2) tutHost.onWord();
    else if (foundN > 2) tutHost.hide();
  }

  /* ---------- parallax + resize ---------- */

  const onSceneMove = (e: PointerEvent): void => {
    const r = scene.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    bgWrap.style.transform = `translate(${nx * -14}px, ${ny * -10}px) scale(1.06)`;
    propsLayer.style.transform = `translate(${nx * -7}px, ${ny * -5}px)`;
  };
  const onSceneLeave = (): void => {
    bgWrap.style.transform = "translate(0,0) scale(1.06)";
    propsLayer.style.transform = "translate(0,0)";
  };
  scene.addEventListener("pointermove", onSceneMove);
  scene.addEventListener("pointerleave", onSceneLeave);

  const onResize = (): void => {
    fx.resize();
    wheel.resize();
    sizeBoard();
  };
  window.addEventListener("resize", onResize);

  /* ---------- boot ---------- */
  buildBoard();
  renderWordsRow();
  fx.setAmbient(theme.ambient);
  fx.start();
  Audio.ensure();
  Audio.startMusic(theme.music);
  // pre-spawn a couple of ambient props so the scene never feels empty
  setTimeout(() => { if (!destroyed) spawnProp(false); }, 250);
  setTimeout(() => { if (!destroyed) spawnProp(false); }, 600);

  Save.setLast(chId, lvId);

  /* ---------- teardown ---------- */
  return () => {
    destroyed = true;
    fx.stop();
    window.removeEventListener("resize", onResize);
    screen.remove();
  };
}
