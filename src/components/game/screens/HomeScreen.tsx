"use client";
/* ------------------------------------------------------------------
 * HomeScreen — v1.19 (user session T):
 *   • کتابخانه removed everywhere (user: «بخش کتاب خانه حذف کن») —
 *     the bottom dock is now فروشگاه · ماموریت‌ها · تنظیمات.
 *   • «دکمه مرحله بعدی رو یخورده بیار پایین با اون تابلو تداخل داره»
 *     → the next-level card left its absolute position and became a
 *     WIDE board card in the flow BELOW the logo: it can never
 *     overlap the wordmark again, and it's far juicier to tap.
 *   • left fabs removed (فروشگاه/ماموریت‌ها were duplicated in the
 *     bottom dock) → cleaner scene, more room for the buttons.
 * PERF: zero idle animations; whole scene = ONE preloaded image.
 * ------------------------------------------------------------------ */
import { PlayerHud } from "@/components/game/ui/kit";
import { ImgIcon } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { isDecoded } from "@/game/core/preload";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { CHAPTERS } from "@/game/data/chapters";
import { lvPerCh, globalLevel, TOTAL_LEVELS } from "@/game/data/levelsIndex";
import { useState } from "react";

export function HomeScreen({
  onPlay, onParty, onMissions, onShop, onSettings, onProfile,
}: {
  onPlay: () => void;
  onParty: () => void;
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
    for (let l = 1; l <= lvPerCh(c); l++) {
      if (Save.levelUnlocked(c, l) && !Save.data.levels[`${c}:${l}`]) { next = { c, l }; break; }
    }
  }
  const nextNo = next ? globalLevel(next.c, next.l) : TOTAL_LEVELS;
  const nextTheme = CHAPTERS[(next?.c ?? 1) - 1];
  const allDone = !next;

  return (
    <div className="vz-page">
      <StableHomeBg />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <PlayerHud gear="bronze" onGear={onSettings} onPlus={onShop} onProfile={onProfile} />

        {/* logo — painted banner + crisp golden text */}
        <div className="logo-wrap">
          <img className="logo-banner" src="/assets/img/logo_banner.webp" alt="" draggable={false} />
          <div className="logo-text">واژه‌سفر</div>
          <span className="logo-tag">کلمه بساز؛ حالِ خوب بچین!</span>
        </div>

        {/* wide next-level board — IN FLOW below the logo (no overlap) */}
        <button
          type="button"
          className="next-board"
          onClick={() => { Audio.sfxClick(); onPlay(); }}
          aria-label="مرحله بعدی"
        >
          <img
            className="nb-thumb"
            src={`/assets/map/m${String(next?.c ?? 1).padStart(2, "0")}.webp`}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.src = "/assets/bg/home3.webp"; }}
          />
          <span className="nb-body">
            <span className="nb-label">{allDone ? "همهٔ فصل‌ها کامل شد!" : "مرحله بعدی"}</span>
            <span className="nb-num">
              <i className="nb-medal">{faNum(nextNo)}</i>
              <i className="nb-ch">{allDone ? "با استارها دوباره بازی کن" : `فصل ${faNum(next?.c ?? 1)} · ${nextTheme.title}`}</i>
            </span>
          </span>
          <span className="nb-go" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24">
              <path d="M15.5 4.5 L8 12 L15.5 19.5" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
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

        {/* bottom dock — v1.19 gorgeous wood-and-gold (کتابخانه removed) */}
        <nav className="navbar2" aria-label="منوی اصلی">
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onShop(); }}>
            <span className="nav2-orb gold"><ImgIcon name="shop" size={32} /></span>
            <span className="nav2-label">فروشگاه</span>
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onMissions(); }}>
            <span className="nav2-orb coral"><ImgIcon name="tasks" size={32} /></span>
            <span className="nav2-label">ماموریت‌ها</span>
          </button>
          <button type="button" className="nav2-item" onClick={() => { Audio.sfxClick(); onSettings(); }}>
            <span className="nav2-orb sky"><ImgIcon name="gear" size={32} /></span>
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
  /* decode gate without effects: sync seed + onLoad (lint-clean) */
  const [ready, setReady] = useState(() => isDecoded("/assets/bg/home3.webp"));
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#9fd9ff 0%,#6cc0f5 40%,#a8e08b 70%,#7ccb62 100%)" }} />
      <img
        src="/assets/bg/home3.webp"
        alt=""
        className="vz-fill"
        style={{ opacity: ready ? 1 : 0, transition: ready ? "none" : "opacity .18s ease" }}
        onLoad={() => setReady(true)}
        fetchPriority="high"
        decoding="async"
      />
    </>
  );
}

export function isGiftReady(): boolean {
  return Save.data.dailyGiftDay !== Save.today();
}
