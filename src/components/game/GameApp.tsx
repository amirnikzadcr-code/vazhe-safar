"use client";
/* ------------------------------------------------------------------
 * GameApp — screen router + global modals + audio lifecycle
 * ------------------------------------------------------------------ */
import { useEffect, useRef, useState } from "react";
import { useSave } from "@/components/game/useSave";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { CHAPTERS } from "@/game/data/chapters";
import { ToastHost, useToast } from "@/components/game/ui/kit";
import { HomeScreen, isGiftReady } from "@/components/game/screens/HomeScreen";
import { MapScreen } from "@/components/game/screens/MapScreen";
import { PlayScreen } from "@/components/game/screens/PlayScreen";
import { LibraryScreen } from "@/components/game/screens/LibraryScreen";
import { MissionsScreen } from "@/components/game/screens/MissionsScreen";
import { ShopScreen } from "@/components/game/screens/ShopScreen";
import { ChallengeScreen } from "@/components/game/screens/ChallengeScreen";
import { DoneScreen } from "@/components/game/screens/DoneScreen";
import { WelcomeScreen, Splash } from "@/components/game/screens/WelcomeScreen";
import { GiftModal, SettingsModal, AboutModal } from "@/components/game/modals/Overlays";

type View =
  | { k: "splash" }
  | { k: "welcome" }
  | { k: "home" }
  | { k: "map"; ch: number }
  | { k: "play"; ch: number; lv: number; from: "map" | "challenge" }
  | { k: "library" }
  | { k: "missions" }
  | { k: "shop" }
  | { k: "challenge" }
  | { k: "done"; ch: number };

type ModalKind = null | "settings" | "gift" | "privacy" | "about";

export function GameApp() {
  const { data, bump } = useSave();
  const [view, setView] = useState<View>({ k: "splash" });
  const [modal, setModal] = useState<ModalKind>(null);
  const [playKey, setPlayKey] = useState(0);
  const { toast, show } = useToast();
  const musicRef = useRef<string>("");

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

  const coins = data.coins;

  /* ----- navigation ----- */
  const boot = () => {
    const d = Save.data;
    const away = d.lastSeen > 0 && Date.now() - d.lastSeen > 4 * 3600_000;
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

  /* ----- render ----- */
  return (
    <>
      {view.k === "splash" && <Splash onDone={boot} />}

      {view.k === "welcome" && (
        <WelcomeScreen
          onContinue={() => {
            const last = Save.data.last;
            setView({ k: "map", ch: last?.ch ?? 1 });
          }}
          onHome={goHome}
        />
      )}

      {view.k === "home" && (
        <HomeScreen
          coins={coins}
          stars={Save.totalStars()}
          giftReady={isGiftReady()}
          onPlay={() => {
            const last = data.last;
            setView({ k: "map", ch: last?.ch ?? 1 });
          }}
          onGift={() => setModal("gift")}
          onLibrary={() => setView({ k: "library" })}
          onMissions={() => setView({ k: "missions" })}
          onShop={() => setView({ k: "shop" })}
          onSettings={() => setModal("settings")}
        />
      )}

      {view.k === "map" && (
        <MapScreen
          ch={view.ch}
          coins={coins}
          onBack={goHome}
          onShop={() => setView({ k: "shop" })}
          onPlay={(lv) => goPlay(view.ch, lv, "map")}
        />
      )}

      {view.k === "play" && (
        <PlayScreen
          key={`${view.ch}:${view.lv}:${playKey}`}
          ch={view.ch}
          lv={view.lv}
          coins={coins}
          coinsBump={bump}
          onExit={() => setView({ k: "map", ch: view.ch })}
          onNext={() => afterWin(view.ch, view.lv, view.from)}
          onSettings={() => setModal("settings")}
          onShop={() => setView({ k: "shop" })}
        />
      )}

      {view.k === "library" && (
        <LibraryScreen
          coins={coins}
          onBack={goHome}
          onShop={() => setView({ k: "shop" })}
          onOpen={(ch) => setView({ k: "map", ch })}
        />
      )}

      {view.k === "missions" && (
        <MissionsScreen coins={coins} onBack={goHome} onChallenge={() => setView({ k: "challenge" })} />
      )}

      {view.k === "shop" && (
        <ShopScreen coins={coins} onBack={goHome} />
      )}

      {view.k === "challenge" && (
        <ChallengeScreen
          coins={coins}
          onBack={goHome}
          onShop={() => setView({ k: "shop" })}
          onStart={startChallenge}
        />
      )}

      {view.k === "done" && (
        <DoneScreen
          ch={view.ch}
          coins={coins}
          onLibrary={() => setView({ k: "library" })}
          onNext={() => {
            if (view.ch < 10) setView({ k: "map", ch: view.ch + 1 });
            else goHome();
          }}
        />
      )}

      {/* global modals */}
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

      <ToastHost toast={toast} />
    </>
  );
}
