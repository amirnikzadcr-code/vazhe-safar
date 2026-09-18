"use client";
/* ------------------------------------------------------------------
 * GameApp — screen router + global modals + audio lifecycle
 * v1.9:
 *  • beautiful direction-aware page transitions (slide + fade +
 *    golden streak) — no more dead jumps between screens
 *  • Android hardware back (Capacitor App plugin) + web popstate:
 *      - a modal is open        → close it
 *      - during the game        → ASK «به صفحهٔ اصلی برگردم؟»
 *      - on the home screen     → ASK «از بازی خارج شوم؟»
 *      - other screens          → back to home
 *  • app sent to background / restored → music + sfx fully paused
 *    and resumed (Audio.pauseAll / resumeAll)
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useRef, useState } from "react";
import { Save } from "@/game/core/save";
import { hasProgress, flushProgress } from "@/game/core/progress";
import { Audio } from "@/game/core/audio";
import { CHAPTERS, MENU_MUSIC, PARTY_MUSIC } from "@/game/data/chapters";
import { lvPerCh } from "@/game/data/levelsIndex";
import { ToastHost, useToast } from "@/components/game/ui/kit";
import { HomeScreen } from "@/components/game/screens/HomeScreen";
import { MapScreen } from "@/components/game/screens/MapScreen";
import { PlayScreen } from "@/components/game/screens/PlayScreen";
import { MissionsScreen } from "@/components/game/screens/MissionsScreen";
import { ShopScreen } from "@/components/game/screens/ShopScreen";
import { ChallengeScreen } from "@/components/game/screens/ChallengeScreen";
import { DoneScreen } from "@/components/game/screens/DoneScreen";
import { WelcomeScreen, Splash } from "@/components/game/screens/WelcomeScreen";
import { GiftModal, SettingsModal, ExitConfirmModal } from "@/components/game/modals/Overlays";
import { NameAskModal, ProfileModal } from "@/components/game/modals/ProfileModals";
import { PartyScreen } from "@/components/game/screens/PartyScreen";
import { ImgPool } from "@/components/game/ImgPool";
import { startDeferredPreload, preloadImage } from "@/game/core/preload";
import { startFpsGuard } from "@/game/core/perf";
import { startStageScaler } from "@/game/core/stage";

type View =
  | { k: "splash" }
  | { k: "welcome" }
  | { k: "home" }
  | { k: "map"; ch: number }
  | { k: "play"; ch: number; lv: number; from: "map" | "challenge"; resume?: boolean }
  | { k: "missions" }
  | { k: "shop" }
  | { k: "challenge" }
  | { k: "party" }
  | { k: "done"; ch: number };

/* v1.21 — privacy/about removed from Settings (user request): the
 * modal kinds "privacy" and "about" no longer exist. */
type ModalKind = null | "settings" | "gift" | "exitApp" | "exitMap" | "profile" | "nameAsk";

/* screen depth — used to pick the transition direction */
const ORDER: Record<View["k"], number> = {
  splash: 0, welcome: 1, home: 2, missions: 3, shop: 3, challenge: 3, party: 3, map: 4, play: 5, done: 6,
};

const viewKey = (v: View) =>
  v.k === "play" ? `play:${v.ch}:${v.lv}` : v.k === "map" ? `map:${v.ch}` : v.k === "done" ? `done:${v.ch}` : v.k;

export function GameApp() {
  /* v3 PERF: GameApp NO LONGER subscribes to Save — every coin bump used
   * to re-render this whole router (and with it the entire active screen:
   * wheel, board, HUD → the “word-guess lag”). Screens that show live
   * save data subscribe with their own narrow hooks (useCoins/useSave).
   * Save.data is still read directly here — it is fresh at every render,
   * and route changes (the only thing this component reacts to) always
   * re-render it. */
  const [view, setViewState] = useState<View>({ k: "splash" });
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [modal, setModal] = useState<ModalKind>(null);
  const [playKey, setPlayKey] = useState(0);
  const { toast, show } = useToast();
  const musicRef = useRef<string>("");
  const musicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef<View>(view);
  const modalRef = useRef<ModalKind>(modal);
  /* v2.0 — where to go back when leaving the shop (play / map
   * / challenge / home). Fixes: hint w/o coins → shop → back dumped the
   * player on the home screen instead of the level. */
  const shopReturnRef = useRef<View>({ k: "home" });

  useEffect(() => { modalRef.current = modal; }, [modal]);

  /* ----- navigation WITH transition ----- */
  const setView = useCallback((next: View) => {
    const cur = viewRef.current;
    const curK = viewKey(cur);
    const nextK = viewKey(next);
    if (nextK === curK) return;
    if (next.k === "shop" && cur.k !== "shop") shopReturnRef.current = cur;
    viewRef.current = next;
    setDir(ORDER[next.k] >= ORDER[cur.k] ? "fwd" : "back");
    setViewState(next);
  }, []);

  /* v2.0 — leaving the shop → return where the player came from.
   * v1.20 FIX (user: «از صفحه بازی روی سکه‌ها میزنه میره فروشگاه و
   * دکمه برگشت میزنه بازی میپره صفحه اصلی یا تو مرحله‌ها»): the old
   * check redirected to the map whenever a level RECORD existed —
   * including a REPLAY of a completed level visited mid-progress!
   * Now: redirect to the map ONLY when the level is finished AND no
   * live in-level snapshot exists (i.e. the shop was opened from the
   * win modal). Any replay with progress returns INTO the replay. */
  const leaveShop = useCallback(() => {
    const r = shopReturnRef.current;
    if (r.k === "play") {
      const finished = !!Save.data.levels[`${r.ch}:${r.lv}`];
      const live = hasProgress(`${r.ch}:${r.lv}`);
      if (finished && !live) { setView({ k: "map", ch: r.ch }); return; }
      setView({ ...r, resume: true });
      return;
    }
    setView(r.k === "shop" ? { k: "home" } : r);
  }, [setView]);

  /* ----- boot: audio settings; first-screen decided by Splash timer ----- */
  useEffect(() => {
    const s = Save.data.settings;
    Audio.setMusicOn(s.music);
    Audio.setSfxOn(s.sfx);
    Audio.setMusicVol(s.musicVol);
    Audio.setSfxVol(s.sfxVol);
    /* v2.4 — moved from page.tsx (now a server component): unlock the
     * audio context on the first user gesture (mobile autoplay policy) */
    const resume = () => { Audio.ensure(); };
    window.addEventListener("pointerdown", resume, { once: true });
    /* v3 — automatic low-power tier on weak phones (kills residual
     * decorative animations so the game NEVER lags) */
    startFpsGuard();
    /* v7 — Unity-style canvas scaler: identical proportions on every
     * phone (user: «سایز بندی گوشی‌های مختلف فرق داره») */
    startStageScaler();
    return () => window.removeEventListener("pointerdown", resume);
  }, []);

  /* mark seen whenever we land on home */
  useEffect(() => {
    if (view.k === "home") Save.markSeen();
  }, [view]);
  useEffect(() => () => { if (musicTimerRef.current) clearTimeout(musicTimerRef.current); }, []);

  /* ----- music per SECTION (user: «موسیقی بساز برای هربخش») -----
   * • صفحه اصلی + منوها → warm menu theme (menu.ogg)
   * • داخل بازی (map/play/done) → that chapter's own track
   * • بازی دورهمی → its own festive party theme
   * The key check keeps a section's music playing uninterrupted when
   * you move between screens of the same section (no re-start). */
  useEffect(() => {
    if (view.k === "splash") return; // stay quiet during splash
    let key: string;
    let cfg: typeof MENU_MUSIC;
    if (view.k === "party") { key = "party"; cfg = PARTY_MUSIC; }
    else if (view.k === "play" || view.k === "map" || view.k === "done") {
      const ch = view.ch;
      key = `ch${ch}`;
      cfg = CHAPTERS[ch - 1]?.music ?? MENU_MUSIC;
    } else { key = "menu"; cfg = MENU_MUSIC; }
    if (!cfg) return;
    if (musicRef.current !== key) {
      musicRef.current = key;
      /* v7 PERF — the section-switch frame is the most expensive frame
       * in the game (whole screen remount). setMusicConfig→playTrack
       * fetch+decode the OGG ON that frame (the APK's lowfx tier skips
       * the idle pre-warm, so the decode always landed here) and froze
       * weak phones on EVERY page switch. Defer the whole swap a beat —
       * the screen paints first, the track fades in ~0.4s later (a
       * natural crossfade beat). */
      if (musicTimerRef.current) clearTimeout(musicTimerRef.current);
      musicTimerRef.current = setTimeout(() => {
        musicTimerRef.current = null;
        Audio.setMusicConfig(cfg);
        Audio.startMusic(cfg);
      }, 400);
    }
  }, [view]);

  /* ----- AUDIO LIFECYCLE — never play while the game is closed ----- */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        Audio.pauseAll();
        flushProgress(); /* v1.20 — in-level progress survives the freeze */
      } else Audio.resumeAll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* ----- HARDWARE BACK BUTTON (Android) + web browser back ----- */
  const exitApp = useCallback(() => {
    Audio.pauseAll();
    import("@capacitor/app")
      .then(({ App }) => { void App.exitApp(); })
      .catch(() => { window.close(); });
  }, []);

  const backAction = useCallback(() => {
    if (modalRef.current) { setModal(null); return; }
    const v = viewRef.current;
    if (v.k === "shop") { leaveShop(); return; }                     // shop → where you came from
    if (v.k === "play") { setModal("exitMap"); return; }          // ask before leaving the level
    if (v.k === "party") { setModal("exitMap"); return; }         // ask before abandoning the party
    if (v.k === "splash" || v.k === "welcome" || v.k === "home") { setModal("exitApp"); return; } // ask before quitting
    Save.markSeen();
    setView({ k: "home" });
  }, [setView, leaveShop]);

  useEffect(() => {
    let dead = false;
    const subs: { remove: () => Promise<void> | void }[] = [];
    import("@capacitor/app")
      .then(({ App }) => {
        if (dead) return;
        void App.addListener("backButton", backAction).then((s) => { subs.push(s); });
        void App.addListener("appStateChange", (st) => {
          if (st.isActive) Audio.resumeAll(); else Audio.pauseAll();
        }).then((s) => { subs.push(s); });
      })
      .catch(() => { /* web build — plugin listeners unavailable */ });
    return () => { dead = true; void Promise.all(subs.map((s) => s.remove())); };
  }, [backAction]);

  /* web fallback: browser/phone back inside a normal browser session */
  useEffect(() => {
    try { history.pushState({ vz: 1 }, "", location.href); } catch { /* noop */ }
    const onPop = () => {
      try { history.pushState({ vz: 1 }, "", location.href); } catch { /* noop */ }
      backAction();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [backAction]);

  const coins = Save.data.coins;

  /* ----- navigation helpers ----- */
  const boot = () => {
    /* v2.4 — chapter realm art + poses keep loading in the background
     * AFTER the game is interactive (boot is never blocked by them).
     * HH — but NOT in the same second as the first home paint: the
     * deferred waves used to start immediately on boot and competed
     * with the user's first taps (»وقتی برای اولین بار وارد بازی میشی
     * لگیه«). A 1.6s grace lets the home screen settle first. */
    setTimeout(() => { startDeferredPreload(); }, 1600);
    /* HH — prewarm the player's CURRENT chapter (play backdrop + music
     * OGG) during idle: the first map→play entry then paints and sings
     * with zero decode stalls on weak phones. */
    const warmCh = Save.data.last?.ch ?? 1;
    const warm = () => {
      void preloadImage(`/assets/bg/ch${String(warmCh).padStart(2, "0")}.webp`);
      const m = CHAPTERS[warmCh - 1]?.music;
      if (m?.track) Audio.preloadTrack(m.track);
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 3000 });
    else setTimeout(warm, 1400);
    const d = Save.data;
    const away = d.lastSeen > 0 && Date.now() - d.lastSeen > 4 * 3600_000;
    if (!d.profile.name) {
      /* v2.3 — first entry: ask the player's name BEFORE anything
         (user: «اول اسمشو از کاربر بپرس ک توی پروفایلش ثبت بشه») */
      setView({ k: "home" });
      setModal("nameAsk");
      return;
    }
    if (away && d.levelsPlayed > 0 && d.welcomeShownDay !== Save.today()) {
      Save.data.welcomeShownDay = Save.today();
      Save.persist();
      setView({ k: "welcome" });
    } else {
      setView({ k: "home" });
    }
  };

  const goPlay = (ch: number, lv: number, from: "map" | "challenge" = "map") => {
    setPlayKey((k) => k + 1);
    setView({ k: "play", ch, lv, from });
  };
  const startChallenge = () => {
    /* random unlocked level from the highest reachable chapter */
    const N = CHAPTERS.length;
    let ch = 1;
    for (let c = N; c >= 1; c--) if (Save.chapterUnlocked(c)) { ch = c; break; }
    const per = lvPerCh(ch);
    let lv = 1;
    for (let l = per; l >= 1; l--) if (Save.data.levels[`${ch}:${l}`]) { lv = Math.min(per, l + 1); break; }
    goPlay(ch, lv, "challenge");
  };
  const goHome = () => { Save.markSeen(); setView({ k: "home" }); };

  /* v1.19 (user session T): «وقتی هر مرحله رو تموم می‌کنه و ستاره
   * جایزش می‌گیره و روی ادامه میزنه انتقالش بده به صفحه مرحله و
   * مرحله جدید انتخاب کنه» — the continue button now lands on the
   * chapter's level-select page (next level glowing), NOT an
   * auto-launched level. Finishing the chapter's last level still
   * opens the big celebration screen. */
  const afterWin = (ch: number, lv: number, from: "map" | "challenge") => {
    if (from === "challenge" && !Save.challengeDoneToday()) {
      const got = Save.completeChallenge();
      if (got) show(`چالش روزانه کامل شد! +${"۵۰"} سکه`);
    }
    if (lv >= lvPerCh(ch)) {
      setView({ k: "done", ch });
    } else {
      setView({ k: "map", ch });
    }
  };

  /* ----- screen renderer ----- */
  const renderScreen = (v: View) => {
    switch (v.k) {
      case "splash":
        return <Splash onDone={boot} />;
      case "welcome":
        return (
          <WelcomeScreen
            onContinue={() => {
              const last = Save.data.last;
              setView({ k: "map", ch: last?.ch ?? 1 });
            }}
            onHome={goHome}
          />
        );
      case "home":
        return (
          <HomeScreen
            onPlay={() => {
              const last = Save.data.last;
              setView({ k: "map", ch: last?.ch ?? 1 });
            }}
            onParty={() => setView({ k: "party" })}
            onMissions={() => setView({ k: "missions" })}
            onShop={() => setView({ k: "shop" })}
            onSettings={() => setModal("settings")}
            onProfile={() => setModal("profile")}
          />
        );
      case "map":
        return (
          <MapScreen
            ch={v.ch}
            onBack={goHome}
            onShop={() => setView({ k: "shop" })}
            /* v1.19 — every node carries its OWN chapter (the old map
             * used the map's chapter for every realm → tapping a high
             * realm's node opened chapter-1's level in the unlocked
             * build) */
            onPlay={(c, lv) => goPlay(c, lv, "map")}
            onNav={(c) => setView({ k: "map", ch: c })}
          />
        );
      case "play":
        return (
          <PlayScreen
            key={`${v.ch}:${v.lv}:${playKey}`}
            ch={v.ch}
            lv={v.lv}
            resume={v.resume === true}
            onExit={() => setView({ k: "map", ch: v.ch })}
            onNext={() => afterWin(v.ch, v.lv, v.from)}
            onSettings={() => setModal("settings")}
            onShop={() => setView({ k: "shop" })}
            onProfile={() => setModal("profile")}
          />
        );
      case "missions":
        return <MissionsScreen onBack={goHome} onChallenge={() => setView({ k: "challenge" })} onGift={() => setModal("gift")} />;
      case "shop":
        return <ShopScreen onBack={leaveShop} />;
      case "challenge":
        return (
          <ChallengeScreen
            onBack={goHome}
            onShop={() => setView({ k: "shop" })}
            onStart={startChallenge}
          />
        );
      case "party":
        return <PartyScreen onExit={goHome} />;
      case "done":
        return (
          <DoneScreen
            ch={v.ch}
            onNext={() => {
              if (v.ch < CHAPTERS.length) setView({ k: "map", ch: v.ch + 1 });
              else goHome();
            }}
          />
        );
    }
  };

  const curKey = viewKey(view);

  /* ----- render ----- */
  return (
    <>
      {/* v2.3 — permanent resident image pool: keeps every decoded bitmap
          alive so ANY screen paints its background instantly (no blue
          flash, no «زمینه‌ها با تاخیر لود میشن»). Mounted OUTSIDE the
          keyed remount div → never torn down. */}
      <ImgPool />

      {/* the active screen — remounts with a soft cross-fade */}
      <div key={curKey} className={`page-enter ${dir}`}>
        {renderScreen(view)}
      </div>

      {/* global modals */}
      {modal === "nameAsk" && <NameAskModal onDone={() => setModal(null)} />}
      {modal === "profile" && <ProfileModal onClose={() => setModal(null)} />}
      {modal === "gift" && <GiftModal onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal(null)} />}
      {modal === "exitApp" && (
        <ExitConfirmModal mode="app" onClose={() => setModal(null)} onConfirm={exitApp} />
      )}
      {modal === "exitMap" && (
        <ExitConfirmModal
          mode="map"
          onClose={() => setModal(null)}
          onConfirm={() => { setModal(null); goHome(); }}
        />
      )}

      <ToastHost toast={toast} />
    </>
  );
}
