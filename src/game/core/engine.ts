/* ------------------------------------------------------------------
 *  واژه‌سفر — core/engine.ts
 *  Tiny scene manager: mounts screens with transitions, wires nav,
 *  owns the audio lifecycle. Framework-agnostic (mounts into any div).
 * ------------------------------------------------------------------ */
import { CHAPTERS } from "../data/chapters";
import { Audio } from "./audio";
import { Save } from "./save";
import { T } from "../i18n";
import {
  showSplash, showMenu, showChapters, showLevels,
  showProgress, showRewards, buildSettingsModal, Nav,
} from "../ui/screens";
import { showGameplay } from "../ui/gameplay";

type ScreenName =
  | { kind: "splash" } | { kind: "menu" } | { kind: "chapters" }
  | { kind: "levels"; ch: number } | { kind: "gameplay"; ch: number; lv: number }
  | { kind: "progress" } | { kind: "rewards" };

class Game {
  private root: HTMLElement | null = null;
  private current: { name: ScreenName; cleanup: () => void } | null = null;
  private settingsOpen = false;
  private destroyed = false;

  mount(root: HTMLElement): () => void {
    this.root = root;
    root.classList.add("vz-root");
    // settings toggles → audio engine
    const s = Save.data.settings;
    Audio.setMusicOn(s.music);
    Audio.setSfxOn(s.sfx);
    Audio.setMusicVol(s.musicVol);
    Audio.setSfxVol(s.sfxVol);
    this.go({ kind: "splash" });
    return () => this.destroy();
  }

  private destroy(): void {
    this.destroyed = true;
    this.current?.cleanup();
    this.current = null;
    Audio.stopMusic();
  }

  go(name: ScreenName): void {
    if (!this.root || this.destroyed) return;
    // teardown previous (with tiny fade via CSS on root child)
    this.current?.cleanup();
    this.current = null;

    const nav: Nav = {
      goMenu: () => this.go({ kind: "menu" }),
      goChapters: () => this.go({ kind: "chapters" }),
      goLevels: (ch) => this.go({ kind: "levels", ch }),
      goGameplay: (ch, lv) => this.go({ kind: "gameplay", ch, lv }),
      goProgress: () => this.go({ kind: "progress" }),
      goRewards: () => this.go({ kind: "rewards" }),
      openSettings: () => this.openSettings(),
    };

    let cleanup: (() => void) | null = null;
    const root = this.root!;
    switch (name.kind) {
      case "splash":
        cleanup = showSplash(root, () => { if (!this.destroyed) this.go({ kind: "menu" }); });
        break;
      case "menu":
        cleanup = showMenu(root, nav);
        break;
      case "chapters":
        cleanup = showChapters(root, nav);
        break;
      case "levels":
        cleanup = showLevels(root, nav, name.ch);
        break;
      case "gameplay":
        cleanup = showGameplay(
          root, name.ch, name.lv,
          () => {
            // exit → levels screen of this chapter
            this.go({ kind: "levels", ch: name.ch });
          },
          (ch, lv) => {
            // next level (or next chapter first level)
            this.go({ kind: "gameplay", ch, lv });
          },
          () => this.openSettings(),
        );
        break;
      case "progress":
        cleanup = showProgress(root, nav);
        break;
      case "rewards":
        cleanup = showRewards(root, nav);
        break;
    }
    this.current = { name, cleanup: cleanup ?? (() => {}) };
  }

  openSettings(): void {
    if (!this.root || this.settingsOpen) return;
    this.settingsOpen = true;
    const m = buildSettingsModal(() => { this.settingsOpen = false; });
    this.root.append(m.el);
  }

  /* deep-link helpers for tests */
  debugNavigate(name: ScreenName): void { this.go(name); }
}

export const game = new Game();

/** convenience: start chapter music when needed by non-gameplay screens */
export function chapterMusicFor(ch: number): void {
  const theme = CHAPTERS[ch - 1];
  if (theme) Audio.setMusicConfig(theme.music);
}

void T;
