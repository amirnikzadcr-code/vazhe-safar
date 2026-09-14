"use client";
/* ------------------------------------------------------------------
 * ProfileModals — v2.3
 *  • NameAskModal : shown ONCE on first entry — asks the player's
 *    name + lets them pick an avatar (user request: «موقعی که وارد
 *    بازی میشی اول اسمشو از کاربر بپرس») — then saves the profile.
 *  • ProfileModal : opened by tapping the HUD plate — edit name,
 *    switch avatar, see level + full stats.
 * ------------------------------------------------------------------ */
import { useState } from "react";
import { Modal, Btn } from "@/components/game/ui/kit";
import { AVATARS, AvatarFace } from "@/components/game/avatars";
import { StarGold, Sparkles, BookOpen, Target } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { bumpSave } from "@/components/game/useSave";

/* shared avatar picker grid */
function AvatarGrid({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return (
    <div className="av-grid" role="radiogroup" aria-label="انتخاب آواتار">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          className={`av-cell ${value === a.id ? "sel" : ""}`}
          style={{ ["--ring" as string]: a.ring }}
          onClick={() => { Audio.sfxClick(); onPick(a.id); }}
          aria-label={a.label}
        >
          <AvatarFace id={a.id} size={52} />
          <span className="av-name">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- first-entry: ask the player's name ---------------- */
export function NameAskModal({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("cat");
  const commit = () => {
    Save.setProfile(name, avatar);
    Audio.sfxChapterUnlock();
    bumpSave();
    onDone();
  };
  return (
    <div
      className="fade-in"
      style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(12,34,60,.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="خوش آمدگویی"
    >
      <div className="panel rise-in nameask-panel">
        <div className="panel-head"><span style={{ flex: 1 }} /><span style={{ position: "relative", zIndex: 1 }}>به سفر خوش آمدی!</span><span style={{ flex: 1 }} /></div>
        <div style={{ padding: 14, textAlign: "center" }}>
          <AvatarFace id={avatar} size={86} />
          <p style={{ fontWeight: 800, color: "#5d3a12", fontSize: 15.5, margin: "8px 0 4px" }}>
            اسمت چیه یاورِ عزیز؟
          </p>
          <input
            className="name-input"
            value={name}
            maxLength={14}
            placeholder="مثلاً: سارا"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            aria-label="اسم بازیکن"
          />
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#8a6a3a", margin: "10px 0 4px" }}>آواتارت را انتخاب کن:</p>
          <AvatarGrid value={avatar} onPick={setAvatar} />
          <Btn color="green" size="big" wide style={{ marginTop: 12 }} onClick={commit}>
            شروع سفرِ واژه‌ها
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- profile editor + stats ---------------- */
export function ProfileModal({ onClose }: { onClose: () => void }) {
  const prof = Save.data.profile;
  const [name, setName] = useState(prof.name);
  const [avatar, setAvatar] = useState(prof.avatar);
  const d = Save.data;
  const { lvl, cur, need } = Save.levelInfo();

  const save = () => {
    Save.setProfile(name, avatar);
    Audio.sfxSettle();
    bumpSave();
    onClose();
  };

  const stats: [React.ReactNode, string, number][] = [
    [<Target size={17} key="i1" />, "واژه‌ها", d.wordsFound],
    [<Sparkles size={17} key="i2" />, "واژه پنهان", d.bonusTotal],
    [<BookOpen size={17} key="i3" />, "مرحله‌ها", Object.keys(d.levels).length],
    [<StarGold size={17} key="i4" />, "ستاره‌ها", Save.totalStars()],
  ];

  return (
    <Modal title="پروفایل من" onClose={onClose}>
      <div style={{ textAlign: "center" }}>
        {/* level medal + xp */}
        <div className="prof-hero" style={{ ["--ring" as string]: AVATARS.find((a) => a.id === avatar)?.ring }}>
          <AvatarFace id={avatar} size={84} />
          <span className="prof-lvl">سطح {faNum(lvl)}</span>
        </div>
        <div className="prof-xp">
          <div className="prof-xpbar"><i style={{ width: `${Math.round((cur / need) * 100)}%` }} /></div>
          <div className="prof-xpnum">
            {faNum(cur)} / {faNum(need)} تا سطح بعد
          </div>
        </div>

        <input
          className="name-input"
          value={name}
          maxLength={14}
          placeholder="اسمت را بنویس…"
          onChange={(e) => setName(e.target.value)}
          aria-label="اسم بازیکن"
        />
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#8a6a3a", margin: "8px 0 2px" }}>آواتارت را عوض کن:</p>
        <AvatarGrid value={avatar} onPick={setAvatar} />

        <div className="prof-stats">
          {stats.map(([ic, t, v]) => (
            <div key={t} className="prof-stat">
              <span className="ic">{ic}</span>
              <b>{faNum(v)}</b>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <Btn color="green" size="big" wide style={{ marginTop: 10 }} onClick={save}>
          ذخیره پروفایل
        </Btn>
      </div>
    </Modal>
  );
}
