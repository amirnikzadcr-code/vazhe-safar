"use client";
/* ------------------------------------------------------------------
 * MissionsScreen — v3 (session AB, user: «صفحه چالش هم خوشگل تر بکن و
 * آیکون هارو نرم تر و انیمیشن بکن و ماموریت های بیشتری اضافه بکن»)
 *   • 12 tiered missions (words / levels / bonus / stars / streak)
 *   • SOFTER icons: rounded squircle chips, each family its own warm
 *     gradient, all gently floating (transform-only, .lowfx-guarded)
 *   • staggered card entrance + shimmering progress bars + a pulsing
 *     claim button when a reward is ready
 * ------------------------------------------------------------------ */
import { Sheet, TopBar, Btn } from "@/components/game/ui/kit";
import { Target, BookOpen, Sparkles, CalendarDays, Check, Coin, Gift as GiftIc, Star as StarIc } from "@/components/game/icons";
import { Flame } from "lucide-react";
import { Save, SaveData } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { bumpSave, useSave } from "@/components/game/useSave";

type Fam = "target" | "book" | "spark" | "star" | "flame" | "cal";

interface Mission {
  id: string;
  title: string;
  need: number;
  have: number;
  reward: number;
  fam: Fam;
}

const FAM_LOOK: Record<Fam, { bg: string; ring: string; fg: string }> = {
  target: { bg: "linear-gradient(180deg,#ffd9d2,#ffab9e)", ring: "#e2745f", fg: "#a3402e" },
  book:   { bg: "linear-gradient(180deg,#d8ecff,#a9cff5)", ring: "#5f97c9", fg: "#2e5f8f" },
  spark:  { bg: "linear-gradient(180deg,#fff1c4,#ffd97a)", ring: "#d99a26", fg: "#9a6408" },
  star:   { bg: "linear-gradient(180deg,#ffedaa,#ffd257)", ring: "#d99a26", fg: "#8a5f04" },
  flame:  { bg: "linear-gradient(180deg,#ffe0cf,#ffb08a)", ring: "#e2814f", fg: "#a34f1e" },
  cal:    { bg: "linear-gradient(180deg,#dcf9e0,#a9e8b6)", ring: "#3fae5c", fg: "#17722c" },
};

function missionsOf(d: SaveData): Mission[] {
  const stars = Save.totalStars();
  return [
    { id: "w5",   title: "۵ واژه پیدا کن",        need: 5,   have: d.wordsFound,   reward: 50,  fam: "target" },
    { id: "w15",  title: "۱۵ واژه پیدا کن",       need: 15,  have: d.wordsFound,   reward: 100, fam: "target" },
    { id: "w30",  title: "۳۰ واژه پیدا کن",       need: 30,  have: d.wordsFound,   reward: 180, fam: "target" },
    { id: "w100", title: "۱۰۰ واژه پیدا کن",      need: 100, have: d.wordsFound,   reward: 320, fam: "target" },
    { id: "l3",   title: "۳ مرحله بازی کن",       need: 3,   have: d.levelsPlayed, reward: 75,  fam: "book" },
    { id: "l10",  title: "۱۰ مرحله بازی کن",      need: 10,  have: d.levelsPlayed, reward: 150, fam: "book" },
    { id: "l25",  title: "۲۵ مرحله بازی کن",      need: 25,  have: d.levelsPlayed, reward: 260, fam: "book" },
    { id: "b5",   title: "۵ واژه پنهان بساز",     need: 5,   have: d.bonusTotal,   reward: 120, fam: "spark" },
    { id: "b15",  title: "۱۵ واژه پنهان بساز",    need: 15,  have: d.bonusTotal,   reward: 240, fam: "spark" },
    { id: "s10",  title: "۱۰ ستاره جمع کن",       need: 10,  have: stars,          reward: 90,  fam: "star" },
    { id: "s30",  title: "۳۰ ستاره جمع کن",       need: 30,  have: stars,          reward: 200, fam: "star" },
    { id: "c3",   title: "استریک ۳ روزهٔ چالش",   need: 3,   have: d.challenge.streak, reward: 150, fam: "flame" },
  ];
}

function FamIcon({ fam }: { fam: Fam }) {
  const s = 21;
  return fam === "target" ? <Target size={s} />
    : fam === "book" ? <BookOpen size={s} />
    : fam === "spark" ? <Sparkles size={s} />
    : fam === "star" ? <StarIc size={s} />
    : fam === "flame" ? <Flame size={s} />
    : <CalendarDays size={s} />;
}

export function MissionsScreen({ onBack, onChallenge, onGift }: { onBack: () => void; onChallenge: () => void; onGift: () => void }) {
  const { data } = useSave();
  const missions = missionsOf(data) as Mission[];
  const giftTaken = Save.data.dailyGiftDay === Save.today();
  const readyCount = missions.filter((m) => m.have >= m.need && !data.missionsClaimed.includes(m.id)).length;

  return (
    <Sheet bg="/assets/bg/map2b.webp" bgDim={0.32}>
      <TopBar onBack={onBack} title="ماموریت‌ها" />

      <div className="scrolly">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 }}>
          {readyCount > 0 && (
            <div className="ms-ready pop-in" role="status">
              <Sparkles size={15} />
              {faNum(readyCount)} ماموریت آمادهٔ گرفتن جایزه است!
            </div>
          )}

          {/* daily gift card — the جوایز روزانه button was removed from the
              home screen (user: «اضافیه») → the gift lives here now */}
          <button
            type="button"
            onClick={() => { Audio.sfxClick(); onGift(); }}
            className="panel ms-card"
            style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "right", background: giftTaken ? undefined : "linear-gradient(180deg,#fff2d8,#ffe0a6)" }}
          >
            <span className="ms-ic" style={{ background: "linear-gradient(180deg,#ffb62e,#f79c0d)", color: "#fff", boxShadow: "0 3px 0 #b06e00" }}>
              <GiftIc size={22} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 800, color: "#5d3a12", fontSize: 15 }}>جایزه روزانه</span>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#8a6a3a", marginTop: 2 }}>
                {giftTaken ? "امروز گرفتی! فردا دوباره بیا" : `جعبه هدیه باز کن و ${faNum(50)} سکه بگیر!`}
              </span>
            </span>
            {!giftTaken && <span className="dot ms-dot" style={{ width: 12, height: 12, borderRadius: 999, background: "#ff4757", border: "2px solid #fff", flex: "none" }} />}
            <span style={{ color: "#a0690a", fontWeight: 800 }}>‹</span>
          </button>

          {/* daily challenge banner */}
          <button
            type="button"
            onClick={onChallenge}
            className="panel ms-card"
            style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "right", background: "linear-gradient(180deg,#fff7e0,#ffe3ae)" }}
          >
            <span className="ms-ic" style={{ background: "linear-gradient(180deg,#8cf291,#2ea648)", color: "#fff", boxShadow: "0 3px 0 #1d7c33" }}>
              <CalendarDays size={22} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 800, color: "#5d3a12", fontSize: 15 }}>چالش روزانه</span>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#8a6a3a", marginTop: 2 }}>
                {Save.challengeDoneToday() ? "امروز انجام شد! فردا دوباره بیا" : "تقویم را باز کن و جایزه بگیر!"}
              </span>
            </span>
            <span style={{ color: "#a0690a", fontWeight: 800 }}>‹</span>
          </button>

          {missions.map((m, idx) => {
            const claimed = data.missionsClaimed.includes(m.id);
            const done = m.have >= m.need;
            const pct = Math.min(100, Math.round((m.have / m.need) * 100));
            const look = FAM_LOOK[m.fam];
            return (
              <div
                key={m.id}
                className="panel ms-card ms-stagger"
                style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, animationDelay: `${Math.min(idx * 45, 400)}ms` }}
              >
                <span className="ms-ic ms-float" style={{ background: look.bg, color: look.fg, boxShadow: `0 3px 0 ${look.ring}` }}>
                  <FamIcon fam={m.fam} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: "#5d3a12", fontSize: 15 }}>{m.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span className="pbar blue ms-pbar" style={{ flex: 1 }}>
                      <i style={{ ["--p" as string]: pct / 100 }} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#8a6a3a", flex: "none" }}>
                      {faNum(Math.min(m.have, m.need))}/{faNum(m.need)}
                    </span>
                  </div>
                </div>
                {claimed ? (
                  <span className="chip ms-chip" style={{ fontSize: 12, gap: 4 }}><Check size={14} /> گرفته شد</span>
                ) : done ? (
                  <Btn color="gold" className="ms-claim" style={{ fontSize: 14, padding: ".45em 1em" }} onClick={() => { Save.claimMission(m.id, m.reward); Audio.sfxCoin(); bumpSave(); }}>
                    <Coin size={16} />
                    {faNum(m.reward)}
                  </Btn>
                ) : (
                  <span className="chip ms-chip" style={{ fontSize: 12, gap: 4 }}><Coin size={15} />{faNum(m.reward)}</span>
                )}
              </div>
            );
          })}

          {/* footer stats card */}
          <div className="panel ms-card" style={{ borderRadius: 20, padding: "12px 16px", display: "flex", justifyContent: "space-around", animationDelay: "480ms" }}>
            {[
              ["واژه‌ها", data.wordsFound],
              ["مرحله‌ها", data.levelsPlayed],
              ["واژه پنهان", data.bonusTotal],
              ["ستاره‌ها", Save.totalStars()],
            ].map(([t, v]) => (
              <div key={t as string} style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 19, color: "#c87f06" }}>{faNum(v as number)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8a6a3a" }}>{t as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
