"use client";
/* ------------------------------------------------------------------
 * ProfileModals — v2.4 (user feedback session O):
 *  • «موقه ورود از بقیه اسم فقط بپرس آواتار اختیاری باشه وقتی خودش
 *    کلیک کرد توی پروفایل بالا صفحه» → NameAskModal now asks ONLY the
 *    name. The avatar stays the friendly default cat and can be changed
 *    any time from the profile plate at the top of the home screen.
 *  • «اون پروفایل رو مرتب تر بکن جمع جور تر و آواتار با کادر پروفایل
 *    یکی بکن» → ProfileModal is one tidy card: the avatar lives INSIDE
 *    the profile frame (unified plate: avatar ring + level badge + XP
 *    bar in a single header), name field, compact avatar strip, stats.
 * ------------------------------------------------------------------ */
import { useState } from "react";
import { Modal, Btn } from "@/components/game/ui/kit";
import { AVATARS, AvatarFace } from "@/components/game/avatars";
import { StarGold, Sparkles, BookOpen, Target } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { bumpSave } from "@/components/game/useSave";

/* compact avatar strip (profile editor) */
function AvatarStrip({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return (
    <div className="av-strip" role="radiogroup" aria-label="انتخاب آواتار">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          aria-label={a.label}
          className={`av-strip-cell ${value === a.id ? "sel" : ""}`}
          style={{ ["--ring" as string]: a.ring }}
          onClick={() => { Audio.sfxClick(); onPick(a.id); }}
        >
          <AvatarFace id={a.id} size={44} />
        </button>
      ))}
    </div>
  );
}

/* ---------------- first-entry: ask ONLY the player's name ---------------- */
export function NameAskModal({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const commit = () => {
    /* avatar keeps the default (cat) — user picks one later from the
     * profile plate («آواتار اختیاری باشه») */
    Save.setProfile(name, Save.data.profile.avatar || "cat");
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
      <div className="panel rise-in nameask-panel" style={{ maxWidth: 330 }}>
        <div className="panel-head"><span style={{ flex: 1 }} /><span style={{ position: "relative", zIndex: 1 }}>به سفر خوش آمدی!</span><span style={{ flex: 1 }} /></div>
        <div style={{ padding: "18px 16px 16px", textAlign: "center" }}>
          <div className="nameask-hero">
            <AvatarFace id={Save.data.profile.avatar || "cat"} size={78} />
          </div>
          <p style={{ fontWeight: 800, color: "#5d3a12", fontSize: 15.5, margin: "10px 0 4px" }}>
            اسمت چیه یاورِ عزیز؟
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#a5814e", margin: "0 0 10px" }}>
            اسمت روی پروفایلت ثبت می‌شود
          </p>
          <input
            className="name-input"
            value={name}
            maxLength={14}
            autoFocus
            placeholder="مثلاً: سارا"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            aria-label="اسم بازیکن"
          />
          <Btn color="green" size="big" wide style={{ marginTop: 14 }} onClick={commit}>
            شروع سفرِ واژه‌ها
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- profile editor + stats — ONE tidy card ---------------- */
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
    [<Sparkles size={17} key="i2" />, "پنهان", d.bonusTotal],
    [<BookOpen size={17} key="i3" />, "مرحله‌ها", Object.keys(d.levels).length],
    [<StarGold size={17} key="i4" />, "ستاره", Save.totalStars()],
  ];

  return (
    <Modal title="پروفایل من" onClose={onClose}>
      <div className="prof-card">
        {/* unified header: avatar INSIDE the profile frame */}
        <div className="prof-head">
          <span className="prof-avatar" style={{ ["--ring" as string]: AVATARS.find((a) => a.id === avatar)?.ring }}>
            <AvatarFace id={avatar} size={72} />
            <span className="prof-lvl-corner">{faNum(lvl)}</span>
          </span>
          <span className="prof-head-info">
            <b className="prof-head-name">{name.trim() || "مسافر"}</b>
            <span className="prof-head-xp">
              <span className="prof-xpbar"><i style={{ ["--p" as string]: cur / need }} /></span>
              <span className="prof-xpnum">{faNum(cur)} / {faNum(need)} تا سطح {faNum(lvl + 1)}</span>
            </span>
          </span>
        </div>

        <label className="prof-label" htmlFor="prof-name-in">اسم بازیکن</label>
        <input
          id="prof-name-in"
          className="name-input"
          value={name}
          maxLength={14}
          placeholder="اسمت را بنویس…"
          onChange={(e) => setName(e.target.value)}
          aria-label="اسم بازیکن"
        />

        <label className="prof-label">آواتار</label>
        <AvatarStrip value={avatar} onPick={setAvatar} />

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
