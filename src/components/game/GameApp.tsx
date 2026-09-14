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
import { useSave } from "@/components/game/useSave";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { CHAPTERS } from "@/game/data/chapters";
import { ToastHost, useToast } from "@/components/game/ui/kit";
import { HomeScreen } from "@/components/game/screens/HomeScreen";
import { MapScreen } from "@/components/game/screens/MapScreen";
import { PlayScreen } from "@/components/game/screens/PlayScreen";
import { LibraryScreen } from "@/components/game/screens/LibraryScreen";
import { MissionsScreen } from "@/components/game/screens/MissionsScreen";
import { ShopScreen } from "@/components/game/screens/ShopScreen";
import { ChallengeScreen } from "@/components/game/screens/ChallengeScreen";
import { DoneScreen } from "@/components/game/screens/DoneScreen";
import { WelcomeScreen, Splash } from "@/components/game/screens/WelcomeScreen";
import { GiftModal, SettingsModal, AboutModal, ExitConfirmModal } from "@/components/game/modals/Overlays";
import { NameAskModal, ProfileModal } from "@/components/game/modals/ProfileModals";
import { PartyScreen } from "@/components/game/screens/PartyScreen";
import { ImgPool } from "@/components/game/ImgPool";

type View =
  | { k: "splash" }
  | { k: "welcome" }
  | { k: "home" }
  | { k: "map"; ch: number }
  | { k: "play"; ch: number; lv: number; from: "map" | "challenge"; resume?: boolean }
  | { k: "library" }
  | { k: "missions" }
  | { k: "shop" }
  | { k: "challenge" }
  | { k: "party" }
  | { k: "done"; ch: number };

type ModalKind = null | "settings" | "gift" | "privacy" | "about" | "exitApp" | "exitMap" | "profile" | "nameAsk";

/* screen depth — used to pick the transition direction */
const ORDER: Record<View["k"], number> = {
  splash: 0, welcome: 1, home: 2, library: 3, missions: 3, shop: 3, challenge: 3, party: 3, map: 4, play: 5, done: 6,
};

const viewKey = (v: View) =>
  v.k === "play" ? `play:${v.ch}:${v.lv}` : v.k === "map" ? `map:${v.ch}` : v.k === "done" ? `done:${v.ch}` : v.k;

export function GameApp() {
  const { data, bump } = useSave();
  const [view, setViewState] = useState<View>({ k: "splash" });
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [modal, setModal] = useState<ModalKind>(null);
  const [playKey, setPlayKey] = useState(0);
  const { toast, show } = useToast();
  const musicRef = useRef<string>("");
  const viewRef = useRef<View>(view);
  const modalRef = useRef<ModalKind>(modal);
  /* v2.0 — where to go back when leaving the shop (play / map / library
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
   * If that play level completed meanwhile (shop opened from the win
   * modal) land on the chapter map instead of a dead board. */
  const leaveShop = useCallback(() => {
    const r = shopReturnRef.current;
    if (r.k === "play") {
      if (Save.data.levels[`${r.ch}:${r.lv}`]) { setView({ k: "map", ch: r.ch }); return; }
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
  }, []);

  /* mark seen whenever we land on home */
  useEffect(() => {
    if (view.k === "home") Save.markSeen();
  }, [view]);

  /* ----- music per screen ----- */
  useEffect(() => {
    let key = "ch01";
    if (view.k === "play") key = `ch${view.ch}`;
    if (view.k === "splash") return; // stay quiet during splash
    const ch = view.k === "play" ? view.ch : view.k === "map" ? view.ch : view.k === "done" ? view.ch : 1;
    const theme = CHAPTERS[ch - 1];
    if (!theme) return;
    if (musicRef.current !== key) {
      musicRef.current = key;
      Audio.setMusicConfig(theme.music);
      Audio.startMusic(theme.music);
    }
  }, [view]);

  /* ----- AUDIO LIFECYCLE — never play while the game is closed ----- */
  useEffect(() => {
    const onVis = () => { if (document.hidden) Audio.pauseAll(); else Audio.resumeAll(); };
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

  const coins = data.coins;

  /* ----- navigation helpers ----- */
  const boot = () => {
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
    let ch = 1;
    for (let c = 10; c >= 1; c--) if (Save.chapterUnlocked(c)) { ch = c; break; }
    let lv = 1;
    for (let l = 10; l >= 1; l--) if (Save.data.levels[`${ch}:${l}`]) { lv = Math.min(10, l + 1); break; }
    goPlay(ch, lv, "challenge");
  };
  const goHome = () => { Save.markSeen(); setView({ k: "home" }); };

  const afterWin = (ch: number, lv: number, from: "map" | "challenge") => {
    if (from === "challenge" && !Save.challengeDoneToday()) {
      const got = Save.completeChallenge();
      bump();
      if (got) show(`چالش روزانه کامل شد! +${"۵۰"} سکه`);
    }
    if (lv >= 10) {
      setView({ k: "done", ch });
    } else {
      goPlay(ch, lv + 1, from);
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
            coins={coins}
            onPlay={() => {
              const last = data.last;
              setView({ k: "map", ch: last?.ch ?? 1 });
            }}
            onParty={() => setView({ k: "party" })}
            onLibrary={() => setView({ k: "library" })}
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
            coins={coins}
            onBack={goHome}
            onShop={() => setView({ k: "shop" })}
            onPlay={(lv) => goPlay(v.ch, lv, "map")}
          />
        );
      case "play":
        return (
          <PlayScreen
            key={`${v.ch}:${v.lv}:${playKey}`}
            ch={v.ch}
            lv={v.lv}
            coins={coins}
            coinsBump={bump}
            resume={v.resume === true}
            onExit={() => setView({ k: "map", ch: v.ch })}
            onNext={() => afterWin(v.ch, v.lv, v.from)}
            onSettings={() => setModal("settings")}
            onShop={() => setView({ k: "shop" })}
          />
        );
      case "library":
        return (
          <LibraryScreen
            coins={coins}
            onBack={goHome}
            onShop={() => setView({ k: "shop" })}
            onOpen={(ch) => setView({ k: "map", ch })}
          />
        );
      case "missions":
        return <MissionsScreen coins={coins} onBack={goHome} onChallenge={() => setView({ k: "challenge" })} onGift={() => setModal("gift")} />;
      case "shop":
        return <ShopScreen coins={coins} onBack={leaveShop} />;
      case "challenge":
        return (
          <ChallengeScreen
            coins={coins}
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
            coins={coins}
            onLibrary={() => setView({ k: "library" })}
            onNext={() => {
              if (v.ch < 10) setView({ k: "map", ch: v.ch + 1 });
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
      {modal === "gift" && <GiftModal onClose={() => { setModal(null); bump(); }} />}
      {modal === "settings" && (
        <SettingsModal
          onClose={() => setModal(null)}
          onAbout={(t) => setModal(t)}
        />
      )}
      {(modal === "about" || modal === "privacy") && (
        <AboutModal tab={modal} onClose={() => setModal(null)} />
      )}
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
