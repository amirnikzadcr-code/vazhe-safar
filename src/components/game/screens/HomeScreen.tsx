"use client";
/* ------------------------------------------------------------------
 * HomeScreen — EXACT reference redesign (user's photo #2):
 *   HUD top (avatar+plate / coins+gear)
 *   left column: فروشگاه · ماموریت‌ها · جوایز روزانه (3D icon fabs)
 *   center: painted logo banner «واژه‌سفر» + tagline
 *   right: «مرحله بعدی» card with level roundel + preview
 *   grandpa + cat live INSIDE the painted background (no DOM img!)
 *   big green «شروع بازی» + cream bottom nav (5 colorful items)
 * PERF: zero idle animations — only :active feedback. The whole scene
 * is ONE background image; DOM holds just the interactive layer.
 * ------------------------------------------------------------------ */
import { useEffect, useState } from "react";
import { PlayerHud } from "@/components/game/ui/kit";
import { ImgIcon } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";

export function HomeScreen({
  coins, onPlay, onGift, onLibrary, onMissions, onShop, onSettings, giftReady,
}: {
  coins: number;
  onPlay: () => void;
  onGift: () => void;
  onLibrary: () => void;
  onMissions: () => void;
  onShop: () => void;
  onSettings: () => void;
  giftReady: boolean;
}) {
  /* next level = first unlocked-not-done level (same rule as the map) */
  let next: { c: number; l: number } | null = null;
  for (let c = 1; c <= 10 && !next; c++) {
    if (!Save.chapterUnlocked(c)) continue;
    for (let l = 1; l <= 10; l++) {
      if (Save.levelUnlocked(c, l) && !Save.data.levels[`${c}:${l}`]) { next = { c, l }; break; }
    }
  }
  const nextNo = next ? (next.c - 1) * 10 + next.l : 100;

  return (
    <div className="vz-page">
      <StableHomeBg />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <PlayerHud coins={coins} gear="bronze" onGear={onSettings} onPlus={onShop} />

        {/* logo — painted banner + crisp golden text */}
        <div className="logo-wrap">
          <img className="logo-banner" src="/assets/img/logo_banner.png" alt="" draggable={false} />
          <div className="logo-text">واژه‌سفر</div>
          <span className="logo-tag">کلمه بساز؛ حالِ خوب بچین!</span>
        </div>

        {/* left column fabs (reference: فروشگاه / ماموریت‌ها / جوایز روزانه) */}
        <div className="home-menu-col">
          <button type="button" className="menu-fab" onClick={() => { Audio.sfxClick(); onShop(); }}>
            <span className="fab-orb"><ImgIcon name="shop" size={40} /></span>
            <span className="fab-label">فروشگاه</span>
          </button>
          <button type="button" className="menu-fab" onClick={() => { Audio.sfxClick(); onMissions(); }}>
            <span className="fab-orb"><ImgIcon name="mission" size={40} /></span>
            <span className="fab-label">ماموریت‌ها</span>
          </button>
          <button type="button" className="menu-fab" style={{ position: "relative" }} onClick={() => { Audio.sfxClick(); onGift(); }}>
            <span className="fab-orb"><ImgIcon name="chest" size={40} /></span>
            {giftReady && <span className="dot" />}
            <span className="fab-label">جوایز روزانه</span>
          </button>
        </div>

        {/* right: next-level card */}
        <button type="button" className="next-card" onClick={() => { Audio.sfxClick(); onPlay(); }} aria-label="مرحله بعدی">
          <span className="next-head">مرحله بعدی</span>
          <span className="next-num">{faNum(nextNo)}</span>
          <img className="next-thumb" src="/assets/map/m01.webp" alt="" draggable={false} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.src = "/assets/bg/home3.webp"; }} />
        </button>

        {/* spacer — the painted grandpa shows through */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* play */}
        <div style={{ display: "flex", justifyContent: "center", margin: "0 0 10px", position: "relative", zIndex: 25 }}>
          <button type="button" className="play-big" onClick={() => { Audio.sfxClick(); onPlay(); }}>
            <span className="tri" />
            شروع بازی
          </button>
        </div>

        {/* bottom nav — خانه / کتابخانه / ماموریت‌ها / فروشگاه / تنظیمات */}
        <nav className="navbar2" aria-label="منوی اصلی">
          <button type="button" className="nav2-item active">
            <span className="nav2-orb"><ImgIcon name="house" size={30} /></span>
            خانه
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onLibrary(); }}>
            <span className="nav2-orb"><ImgIcon name="books" size={30} /></span>
            کتابخانه
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onMissions(); }}>
            <span className="nav2-orb"><ImgIcon name="tasks" size={30} /></span>
            ماموریت‌ها
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onShop(); }}>
            <span className="nav2-orb"><ImgIcon name="gift" size={30} /></span>
            جوایز
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onSettings(); }}>
            <span className="nav2-orb"><ImgIcon name="gear" size={30} /></span>
            تنظیمات
          </button>
        </nav>
      </div>
    </div>
  );
}

/* stable home background — decode-gated so returning home never flashes */
function StableHomeBg() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let dead = false;
    const img = new Image();
    img.src = "/assets/bg/home3.webp";
    img.decode()
      .then(() => { if (!dead) setReady(true); })
      .catch(() => { if (!dead) setReady(true); });
    return () => { dead = true; };
  }, []);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#9fd9ff 0%,#6cc0f5 40%,#a8e08b 70%,#7ccb62 100%)" }} />
      <img
        src="/assets/bg/home3.webp"
        alt=""
        className="vz-fill"
        style={{ opacity: ready ? 1 : 0, transition: "opacity .18s ease" }}
        fetchPriority="high"
        decoding="async"
      />
    </>
  );
}

export function isGiftReady(): boolean {
  return Save.data.dailyGiftDay !== Save.today();
}
