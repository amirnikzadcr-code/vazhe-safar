"use client";
/* ------------------------------------------------------------------
 * HomeScreen — happy city + blue sky + عمو دانا at his tea table,
 * gold 3D title, big green PLAY, bottom nav (gift/library/missions/shop)
 * ------------------------------------------------------------------ */
import { Btn, IconBtn, CoinChip, Vines } from "@/components/game/ui/kit";
import { Gear, GiftIcon, BookIcon, TrophyIcon, BagIcon, PlayGold, Star } from "@/components/game/icons";
import { Coin } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";

export function HomeScreen({
  coins, onPlay, onGift, onLibrary, onMissions, onShop, onSettings, giftReady, stars,
}: {
  coins: number;
  onPlay: () => void;
  onGift: () => void;
  onLibrary: () => void;
  onMissions: () => void;
  onShop: () => void;
  onSettings: () => void;
  giftReady: boolean;
  stars: number;
}) {
  return (
    <div className="vz-page fade-in">
      {/* sky + city */}
      <img src="/assets/bg/home2.webp" alt="" className="vz-fill" />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(30,80,140,0) 55%, rgba(20,50,90,.35) 100%)" }} />
      <Vines />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* top bar: coins LEFT / gear RIGHT (matches reference; RTL flex) */}
        <div className="topbar">
          <IconBtn label="تنظیمات" onClick={onSettings}><span className="anim-gear"><Gear size={22} /></span></IconBtn>
          <CoinChip value={coins} plus onPlus={onShop} />
        </div>

        {/* title block — each line in its own block box */}
        <div style={{ textAlign: "center", marginTop: 2, position: "relative", zIndex: 12 }}>
          <div>
            <h1 className="title3d" data-t="واژه‌سفر" style={{ fontSize: "clamp(44px, 13vw, 60px)", margin: 0, lineHeight: 1.15 }}>
              واژه‌سفر
            </h1>
          </div>
          <div style={{ marginTop: 6 }}>
            <span
              className="float-slow"
              style={{
                display: "inline-block",
                background: "linear-gradient(180deg,#fffdf6,#ffefd0)",
                border: "2.5px solid #fff", outline: "2px solid #e5c07b",
                borderRadius: 999, padding: "5px 16px",
                color: "#7a5a2e", fontWeight: 700, fontSize: 13.5,
                boxShadow: "0 4px 0 #dcb87a, 0 8px 14px rgba(0,0,0,.22)",
              }}
            >
              کلمه بساز، حالِ خوب بچین!
            </span>
          </div>
        </div>

        {/* stars total pill */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <span className="chip" style={{ fontSize: 13 }}>
            <Star className="star-ic" style={{ width: 17, height: 17 }} />
            {faNum(stars)}
          </span>
        </div>

        {/* grandpa scene — wrapper centers (no transform conflicts with floatY) */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div style={{ position: "absolute", bottom: -6, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 5 }}>
            <img
              src="/assets/char/seat.webp"
              alt="عمو دانا پشت میز چای همراه گربه"
              className="float-slow"
              style={{
                height: "min(50vh, 370px)", maxWidth: "98%", objectFit: "contain",
                /* NOTE: no CSS filter here — drop-shadow on an animated
                   image re-rasterizes every frame and lags the phone */
              }}
            />
          </div>
          {/* floating coin accents */}
          <span style={{ position: "absolute", top: "6%", right: "8%", animation: "floatY 2.6s ease-in-out infinite", display: "flex" }}><Coin size={24} /></span>
          <span style={{ position: "absolute", top: "16%", left: "10%", animation: "floatY 3.4s ease-in-out .5s infinite", display: "flex" }}><Coin size={19} /></span>
        </div>

        {/* play button — juicy breathing ring (no white glow) */}
        <div style={{ display: "flex", justifyContent: "center", margin: "2px 0 10px", position: "relative", zIndex: 20 }}>
          <Btn size="big" onClick={onPlay} className="play-juicy" style={{ minWidth: 240, fontSize: 22 }}>
            <PlayGold size={24} />
            شروع بازی
          </Btn>
        </div>

        {/* bottom nav */}
        <nav className="navbar" aria-label="منوی اصلی">
          <button type="button" className="nav-item" onClick={() => { Audio.sfxClick(); onGift(); }}>
            <span className="nav-orb c-pink">
              <GiftIcon size={26} />
              {giftReady && <span className="dot" />}
            </span>
            جایزه
          </button>
          <button type="button" className="nav-item" onClick={() => { Audio.sfxClick(); onLibrary(); }}>
            <span className="nav-orb c-blue"><BookIcon size={26} /></span>
            کتابخانه
          </button>
          <button type="button" className="nav-item" onClick={() => { Audio.sfxClick(); onMissions(); }}>
            <span className="nav-orb c-violet"><TrophyIcon size={26} /></span>
            ماموریت‌ها
          </button>
          <button type="button" className="nav-item" onClick={() => { Audio.sfxClick(); onShop(); }}>
            <span className="nav-orb c-orange"><BagIcon size={26} /></span>
            فروشگاه
          </button>
        </nav>
      </div>
    </div>
  );
}

export function isGiftReady(): boolean {
  return Save.data.dailyGiftDay !== Save.today();
}
