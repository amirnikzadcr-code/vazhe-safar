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
import { getLevel, COMMON_BONUS } from "../data/levelsIndex";
import { makeCrossword, CrosswordLayout } from "../crossword";
import { ParticleFX } from "../fx/particles";
import { makeProp } from "../fx/props";
import { T } from "../i18n";
import { createWheel, WheelHandle } from "./wheel";
import { actionBtn, iconBtn, ICONS, coinBadge, modal, toast, starRow } from "./components";

export interface GameplayResult { done: boolean }

export function showGameplay(
  container: HTMLElement,
  chId: number,
  lvId: number,
  onExit: () => void,
  onNext: (ch: number, lv: number) => void,
  onOpenSettings: () => void,
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

  /* bottom controls + wheel */
  const bottom = h("div", { class: "vz-bottom" });
  const controls = h("div", { class: "vz-controls" });
  const shuffleBtn = actionBtn(T.shuffle, "vz-mini-btn", () => {
    wheel.shuffle();
    Audio.sfxShuffle();
  }, ICONS.shuffle);
  const undoBtn = actionBtn(T.undo, "vz-mini-btn", () => {
    wheel.clearPath();
  }, ICONS.undo);
  const hintBtn = actionBtn(`${T.hint} · ${faNum(COSTS.hint)}`, "vz-mini-btn vz-hint-btn", () => useHint(), ICONS.bulb);
  controls.append(shuffleBtn, undoBtn, hintBtn);
  const wheelHost = h("div", { class: "vz-wheel-host" });
  bottom.append(controls, wheelHost);

  screen.append(scene, board, bottom);
  container.append(screen);

  /* ---------- state ---------- */
  const wheel: WheelHandle = createWheel(level.id * 977 + chId * 31, level.wheel);
  wheelHost.append(wheel.el);

  const fx = new ParticleFX(canvas);
  Audio_cue.firework = () => { /* firework sfx handled inside fireworks() via Audio below */ Audio.sfxCoin(); };

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
    const availW = screen.clientWidth - 24;
    const availH = Math.max(90, board.clientHeight - 8);
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

  const allBonusSet = (): Set<string> => {
    const s = new Set<string>(level.bonus);
    for (const w of COMMON_BONUS) s.add(w);
    return s;
  };

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
      Save.addCoins(REWARDS.perWord);
      coins.refresh();
      buzz([15, 30, 15], Save.data.settings.haptics);
      spawnProp(true);
      floatWord(word, false);
      if (foundWords.size === level.words.length) {
        setTimeout(() => completeLevel(), 900);
      }
      return;
    }
    if (allBonusSet().has(word) && canBuild(word, level.wheel)) {
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
    const exit = actionBtn(T.exit, "vz-secondary", () => {
      m.close();
      onExit();
    }, ICONS.home);
    btns.append(resume, restart, settingsB, exit);
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
    wheel.shuffle();
  };

  /* ---------- level complete ---------- */

  async function completeLevel(): Promise<void> {
    if (finished) return;
    finished = true;
    const noMistakes = mistakes === 0;
    const stars = noMistakes && bonusFound.size > 0 ? 3 : noMistakes || bonusFound.size > 0 ? 2 : 1;
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
      s.innerHTML = ICONS.starFill;
      s.style.animationDelay = `${i * 280}ms`;
      starsEl.append(s);
    }
    content.append(starsEl);
    if (noMistakes) content.append(h("div", { class: "vz-perfect", text: noMistakes && bonusFound.size ? T.perfectLevel : T.noMistakes }));

    const earned = REWARDS.perStar * stars;
    content.append(h("div", { class: "vz-reward-line" },
      h("span", { text: `+${faNum(earned)} 🪙` })));
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
    chest.innerHTML = `<span class="vz-chest-emoji">🎁</span><span class="vz-chest-lb">${T.claimReward}</span>`;
    chest.addEventListener("click", () => {
      if (Save.claimChest(chId)) {
        Audio.sfxCoin();
        chest.innerHTML = `<span class="vz-chest-emoji">🪙</span><span class="vz-chest-lb">+${faNum(150)}</span>`;
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

  /* ---------- tutorial ---------- */

  if (chId === 1 && lvId === 1 && !Save.data.tutorialDone) {
    const tut = h("div", { class: "vz-tutorial" });
    const card = h("div", { class: "vz-tut-card" });
    card.append(h("h3", { class: "vz-modal-title", text: T.tutorialTitle }));
    const steps = [T.tutorial1, T.tutorial2, T.tutorial3];
    let step = 0;
    const txt = h("p", { class: "vz-tut-txt", text: steps[0] });
    const dots = h("div", { class: "vz-tut-dots" });
    for (let i = 0; i < 3; i++) dots.append(h("span", { class: `vz-tut-dot ${i === 0 ? "on" : ""}` }));
    const nextB = actionBtn(T.gotIt, "vz-primary", () => {
      step++;
      if (step < steps.length) {
        txt.textContent = steps[step];
        dots.querySelectorAll(".vz-tut-dot").forEach((d, i) => d.classList.toggle("on", i === step));
        Audio.sfxClick();
      } else {
        Save.markTutorialDone();
        tut.classList.add("hide");
        setTimeout(() => tut.remove(), 420);
        // demonstrate on the wheel
        wheel.pulseLetters(level.words[0], 1200);
      }
    });
    card.append(txt, dots, nextB);
    tut.append(h("div", { class: "vz-tut-dim" }), card);
    screen.append(tut);
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
