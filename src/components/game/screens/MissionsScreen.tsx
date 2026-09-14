"use client";
/* ------------------------------------------------------------------
 * MissionsScreen — lifetime mission cards + chapter chest banner
 * ------------------------------------------------------------------ */
import { Sheet, TopBar, Btn } from "@/components/game/ui/kit";
import { Target, BookOpen, Sparkles, CalendarDays, Check, Coin, Gift as GiftIc } from "@/components/game/icons";
import { Save, SaveData } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { bumpSave, useSave } from "@/components/game/useSave";

interface Mission {
  id: string;
  title: string;
  need: number;
  have: number;
  reward: number;
  icon: React.ReactNode;
}

function missionsOf(d: SaveData): Mission[] {
  return [
    { id: "w5",  title: "۵ واژه پیدا کن",      need: 5,  have: d.wordsFound,   reward: 50,  icon: <Target size={20} /> },
    { id: "w15", title: "۱۵ واژه پیدا کن",     need: 15, have: d.wordsFound,   reward: 100, icon: <Target size={20} /> },
    { id: "w30", title: "۳۰ واژه پیدا کن",     need: 30, have: d.wordsFound,   reward: 180, icon: <Target size={20} /> },
    { id: "l3",  title: "۳ مرحله بازی کن",     need: 3,  have: d.levelsPlayed, reward: 75,  icon: <BookOpen size={20} /> },
    { id: "l10", title: "۱۰ مرحله بازی کن",    need: 10, have: d.levelsPlayed, reward: 150, icon: <BookOpen size={20} /> },
    { id: "b5",  title: "۵ واژه پنهان بساز",   need: 5,  have: d.bonusTotal,   reward: 120, icon: <Sparkles size={20} /> },
    { id: "c1",  title: "چالش روزانه را کامل کن", need: 1, have: d.challenge.streak, reward: 60, icon: <CalendarDays size={20} /> },
  ];
}

export function MissionsScreen({ onBack, onChallenge, onGift }: { onBack: () => void; onChallenge: () => void; onGift: () => void }) {
  const { data } = useSave();
  const missions = missionsOf(data) as Mission[];
  const giftTaken = Save.data.dailyGiftDay === Save.today();

  return (
    <Sheet bg="/assets/bg/map2b.webp" bgDim={0.32}>
      <TopBar onBack={onBack} title="ماموریت‌ها" />

      <div className="scrolly">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 }}>
          {/* daily gift card — the جوایز روزانه button was removed from the
              home screen (user: «اضافیه») → the gift lives here now */}
          <button
            type="button"
            onClick={() => { Audio.sfxClick(); onGift(); }}
            className="panel"
            style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "right", background: giftTaken ? undefined : "linear-gradient(180deg,#fff2d8,#ffe0a6)" }}
          >
            <span style={{ width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#ffb62e,#f79c0d)", color: "#fff", flex: "none", boxShadow: "0 3px 0 #b06e00" }}>
              <GiftIc size={22} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 800, color: "#5d3a12", fontSize: 15 }}>جایزه روزانه</span>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#8a6a3a", marginTop: 2 }}>
                {giftTaken ? "امروز گرفتی! فردا دوباره بیا" : `جعبه هدیه باز کن و ${faNum(50)} سکه بگیر!`}
              </span>
            </span>
            {!giftTaken && <span className="dot" style={{ width: 12, height: 12, borderRadius: 999, background: "#ff4757", border: "2px solid #fff", flex: "none" }} />}
            <span style={{ color: "#a0690a", fontWeight: 800 }}>‹</span>
          </button>
          {/* daily challenge banner */}
          <button
            type="button"
            onClick={onChallenge}
            className="panel"
            style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "right", background: "linear-gradient(180deg,#fff7e0,#ffe3ae)" }}
          >
            <span style={{ width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#8cf291,#2ea648)", color: "#fff", flex: "none", boxShadow: "0 3px 0 #1d7c33" }}>
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
          {missions.map((m) => {
            const claimed = data.missionsClaimed.includes(m.id);
            const done = m.have >= m.need;
            const pct = Math.min(100, Math.round((m.have / m.need) * 100));
            return (
              <div key={m.id} className="panel" style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <span className="ic" style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#ffe9b0,#ffcf6a)", color: "#a0690a", flex: "none", boxShadow: "inset 0 -2px 2px rgba(160,100,0,.25)" }}>
                  {m.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: "#5d3a12", fontSize: 15 }}>{m.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span className="pbar blue" style={{ flex: 1 }}>
                      <i style={{ ["--p" as string]: pct / 100 }} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#8a6a3a", flex: "none" }}>
                      {faNum(Math.min(m.have, m.need))}/{faNum(m.need)}
                    </span>
                  </div>
                </div>
                {claimed ? (
                  <span className="chip" style={{ fontSize: 12, gap: 4 }}><Check size={14} /> گرفته شد</span>
                ) : done ? (
                  <Btn color="gold" style={{ fontSize: 14, padding: ".45em 1em" }} onClick={() => { Save.claimMission(m.id, m.reward); Audio.sfxCoin(); bumpSave(); }}>
                    <Coin size={16} />
                    {faNum(m.reward)}
                  </Btn>
                ) : (
                  <span className="chip" style={{ fontSize: 12, gap: 4 }}><Coin size={15} />{faNum(m.reward)}</span>
                )}
              </div>
            );
          })}

          {/* footer stats card */}
          <div className="panel" style={{ borderRadius: 20, padding: "12px 16px", display: "flex", justifyContent: "space-around" }}>
            {[
              ["واژه‌ها", data.wordsFound],
              ["مرحله‌ها", data.levelsPlayed],
              ["واژه پنهان", data.bonusTotal],
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
