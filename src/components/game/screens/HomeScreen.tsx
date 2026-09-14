"use client";
/* ------------------------------------------------------------------
 * HomeScreen — v2.3 (user feedback session N):
 *   • «دکمه جایزه رو پاک کن اضافیه»  → daily-gift fab REMOVED (the gift
 *     now lives in ماموریت‌ها so the feature stays reachable)
 *   • «دکمه خونه هم پاکش کن اضافیه»  → خانه + جوایز removed from the
 *     bottom nav (کتابخانه · ماموریت‌ها · تنظیمات)
 *   • «عکس اون پیرمرده ک زده سلام کلا حذف کن» → grandpa chip GONE
 *   • NEW: festive «بازی دورهمی» button right ABOVE «شروع بازی»
 *   • HUD is the real profile (name/avatar/level) — tap opens editor
 * PERF: zero idle animations; whole scene = ONE preloaded image.
 * ------------------------------------------------------------------ */
import { useEffect, useState } from "react";
import { PlayerHud } from "@/components/game/ui/kit";
import { ImgIcon } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { isDecoded } from "@/game/core/preload";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { CHAPTERS } from "@/game/data/chapters";

export function HomeScreen({
  coins, onPlay, onParty, onLibrary, onMissions, onShop, onSettings, onProfile,
}: {
  coins: number;
  onPlay: () => void;
  onParty: () => void;
  onLibrary: () => void;
  onMissions: () => void;
  onShop: () => void;
  onSettings: () => void;
  onProfile: () => void;
}) {
  /* next level = first unlocked-not-done level (same rule as the map) */
  const N = CHAPTERS.length;
  let next: { c: number; l: number } | null = null;
  for (let c = 1; c <= N && !next; c++) {
    if (!Save.chapterUnlocked(c)) continue;
    for (let l = 1; l <= 10; l++) {
      if (Save.levelUnlocked(c, l) && !Save.data.levels[`${c}:${l}`]) { next = { c, l }; break; }
    }
  }
  const nextNo = next ? (next.c - 1) * 10 + next.l : N * 10;

  return (
    <div className="vz-page">
      <StableHomeBg />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <PlayerHud coins={coins} gear="bronze" onGear={onSettings} onPlus={onShop} onProfile={onProfile} />

        {/* logo — painted banner + crisp golden text */}
        <div className="logo-wrap">
          <img className="logo-banner" src="/assets/img/logo_banner.webp" alt="" draggable={false} />
          <div className="logo-text">واژه‌سفر</div>
          <span className="logo-tag">کلمه بساز؛ حالِ خوب بچین!</span>
        </div>

        {/* left column fabs (جوایز روزانه removed → lives in ماموریت‌ها) */}
        <div className="home-menu-col">
          <button type="button" className="menu-fab" onClick={() => { Audio.sfxClick(); onShop(); }}>
            <span className="fab-orb"><ImgIcon name="shop" size={40} /></span>
            <span className="fab-label">فروشگاه</span>
          </button>
          <button type="button" className="menu-fab" onClick={() => { Audio.sfxClick(); onMissions(); }}>
            <span className="fab-orb"><ImgIcon name="mission" size={40} /></span>
            <span className="fab-label">ماموریت‌ها</span>
          </button>
        </div>

        {/* right: next-level card */}
        <button type="button" className="next-card" onClick={() => { Audio.sfxClick(); onPlay(); }} aria-label="مرحله بعدی">
          <span className="next-head">مرحله بعدی</span>
          <span className="next-num">{faNum(nextNo)}</span>
          <img className="next-thumb" src="/assets/map/m01.webp" alt="" draggable={false} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.src = "/assets/bg/home3.webp"; }} />
        </button>

        {/* spacer — grandpa hello chip removed (user request) */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* center stack: بازی دورهمی ABOVE شروع بازی (user request) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, margin: "0 0 12px", position: "relative", zIndex: 25 }}>
          <button type="button" className="party-big" onClick={() => { Audio.sfxChapterUnlock(); onParty(); }}>
            <span className="pb-balloons" aria-hidden>
              <svg width="30" height="38" viewBox="0 0 30 38">
                <ellipse cx="9" cy="9" rx="7" ry="8.6" fill="#ff8fab" />
                <ellipse cx="9" cy="6.4" rx="2.6" ry="3" fill="#ffb1c6" opacity=".85" />
                <path d="M9 17.6 q-2.4 3.4 0 6.4" stroke="#e25c78" strokeWidth="1.4" fill="none" />
                <ellipse cx="22" cy="13" rx="6.2" ry="7.6" fill="#7cc9ff" />
                <ellipse cx="22" cy="10.8" rx="2.2" ry="2.6" fill="#b5e2ff" opacity=".9" />
                <path d="M22 20.6 q-2 2.8 0 5.4" stroke="#3d8fd0" strokeWidth="1.3" fill="none" />
                <path d="M9 24 q6 5 13 2" stroke="#c9a1ff" strokeWidth="1.3" fill="none" />
              </svg>
            </span>
            بازی دورهمی
            <span className="pb-dot" aria-hidden>!</span>
          </button>

          <button type="button" className="play-big" onClick={() => { Audio.sfxClick(); onPlay(); }}>
            <span className="tri" />
            شروع بازی
          </button>
        </div>

        {/* bottom nav — خانه/جوایز removed (redundant, user request) */}
        <nav className="navbar2" aria-label="منوی اصلی">
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onLibrary(); }}>
            <span className="nav2-orb"><ImgIcon name="books" size={32} /></span>
            <span className="nav2-label">کتابخانه</span>
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onMissions(); }}>
            <span className="nav2-orb"><ImgIcon name="tasks" size={32} /></span>
            <span className="nav2-label">ماموریت‌ها</span>
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onSettings(); }}>
            <span className="nav2-orb"><ImgIcon name="gear" size={32} /></span>
            <span className="nav2-label">تنظیمات</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

/* stable home background — decode-gated so returning home never flashes.
 * v2.2: preloaded during splash → the sync isDecoded() check makes the
 * very first paint already show the full image (no sky-blue flash). */
function StableHomeBg() {
  const [ready, setReady] = useState(() => isDecoded("/assets/bg/home3.webp"));
  useEffect(() => { if (isDecoded("/assets/bg/home3.webp")) setReady(true); }, []);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#9fd9ff 0%,#6cc0f5 40%,#a8e08b 70%,#7ccb62 100%)" }} />
      <img
        src="/assets/bg/home3.webp"
        alt=""
        className="vz-fill"
        style={{ opacity: ready ? 1 : 0, transition: ready ? "none" : "opacity .18s ease" }}
        fetchPriority="high"
        decoding="async"
      />
    </>
  );
}

export function isGiftReady(): boolean {
  return Save.data.dailyGiftDay !== Save.today();
}
