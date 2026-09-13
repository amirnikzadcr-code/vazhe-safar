"use client";
/* Pause / Settings / Daily Gift / About modals */
import { useEffect, useState } from "react";
import { Modal, Btn } from "@/components/game/ui/kit";
import { Music, Volume2, Vibrate, Languages, ShieldCheck, Info, Gift as GiftIc } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { bumpSave } from "@/components/game/useSave";

/* ---------------- Pause ---------------- */
export function PauseModal({
  onResume, onRestart, onExit, onSettings,
}: {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  onSettings: () => void;
}) {
  return (
    <Modal title="توقف" onClose={onResume}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn wide onClick={onResume}>ادامه بازی</Btn>
        <Btn wide color="gold" onClick={onRestart}>شروع دوباره</Btn>
        <Btn wide color="blue" onClick={onSettings}>تنظیمات</Btn>
        <Btn wide color="red" onClick={onExit}>خروج به نقشه</Btn>
      </div>
    </Modal>
  );
}

/* ---------------- toggle ---------------- */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => { Audio.sfxClick(); onChange(!on); }}
      style={{
        width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer", flex: "none",
        background: on ? "linear-gradient(180deg,#7ce97f,#2ea648)" : "#d9cbaa",
        boxShadow: on ? "0 3px 0 #1d7c33" : "0 3px 0 #b9a87e",
        position: "relative", transition: "background .2s",
      }}
    >
      <span
        style={{
          position: "absolute", top: 3, right: on ? 25 : 3,
          width: 24, height: 24, borderRadius: 999,
          background: "radial-gradient(circle at 36% 30%, #fff, #f2e6c8)",
          boxShadow: "0 2px 4px rgba(0,0,0,.3)",
          transition: "right .18s ease",
        }}
      />
    </button>
  );
}

function SetRow({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <span className="ic">{icon}</span>
      <span style={{ flex: 1, fontWeight: 700, color: "#5d3a12" }}>{title}</span>
      {children}
    </div>
  );
}

/* ---------------- Settings ---------------- */
export function SettingsModal({ onClose, onAbout }: { onClose: () => void; onAbout: (tab: "privacy" | "about") => void }) {
  const s = Save.data.settings;
  const [tick, setTick] = useState(0);
  const refresh = () => { bumpSave(); setTick((t) => t + 1); };
  void tick;
  return (
    <Modal title="تنظیمات" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SetRow icon={<Music size={20} />} title="موسیقی">
          <Toggle
            label="موسیقی"
            on={s.music}
            onChange={(v) => { Save.setSetting("music", v); Audio.setMusicOn(v); refresh(); }}
          />
        </SetRow>
        <SetRow icon={<Volume2 size={20} />} title="صداهای بازی">
          <Toggle
            label="صداها"
            on={s.sfx}
            onChange={(v) => { Save.setSetting("sfx", v); Audio.setSfxOn(v); refresh(); }}
          />
        </SetRow>
        <SetRow icon={<Vibrate size={20} />} title="لرزش">
          <Toggle label="لرزش" on={s.haptics} onChange={(v) => { Save.setSetting("haptics", v); refresh(); }} />
        </SetRow>
        <SetRow icon={<Languages size={20} />} title="زبان">
          <span className="chip" style={{ fontSize: 13 }}>فارسی</span>
        </SetRow>
        <SetRow icon={<ShieldCheck size={20} />} title="حریم خصوصی">
          <Btn color="blue" onClick={() => onAbout("privacy")} style={{ fontSize: 14, padding: ".45em 1.1em" }}>مشاهده</Btn>
        </SetRow>
        <SetRow icon={<Info size={20} />} title="درباره بازی">
          <Btn color="teal" onClick={() => onAbout("about")} style={{ fontSize: 14, padding: ".45em 1.1em" }}>مشاهده</Btn>
        </SetRow>
      </div>
    </Modal>
  );
}

/* ---------------- Daily gift ---------------- */
export function GiftModal({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0);
  const claimed = Save.data.dailyGiftDay === Save.today();
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!claimed) return;
    const t = setInterval(() => {
      const now = new Date();
      const mid = new Date(now); mid.setHours(24, 0, 0, 0);
      const ms = mid.getTime() - now.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setRemaining(`${faNum(h)} ساعت و ${faNum(m)} دقیقه`);
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [claimed]);

  return (
    <Modal title="جایزه روزانه" onClose={onClose}>
      <div style={{ textAlign: "center" }}>
        
        <img
          src="/assets/obj/gift.webp"
          alt="جعبه هدیه پر از سکه"
          className="breathe"
          style={{ height: 168, objectFit: "contain", margin: "2px auto 6px", display: "block" }}
        />
        {claimed ? (
          <>
            <p style={{ fontWeight: 700, color: "#6b4a1e", margin: "4px 0 14px" }}>
              جایزه امروز را گرفتی! فردا دوباره بیا.
            </p>
            <div className="chip" style={{ fontSize: 14 }}>زمان جایزه بعدی: {remaining}</div>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, color: "#6b4a1e", margin: "4px 0 14px", fontSize: 16 }}>
              امروز <b style={{ color: "#c87f06" }}>{faNum(50)} سکه</b> دریافت کن!
            </p>
            <Btn
              color="gold"
              size="big"
              onClick={() => {
                const got = Save.claimDailyGift();
                if (got) { Audio.sfxCoin(); bumpSave(); }
                onClose();
              }}
            >
              <GiftIc size={20} />
              دریافت جایزه
            </Btn>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- About / Privacy ---------------- */
export function AboutModal({ tab, onClose }: { tab: "privacy" | "about"; onClose: () => void }) {
  return (
    <Modal title={tab === "privacy" ? "حریم خصوصی" : "درباره بازی"} onClose={onClose}>
      <div style={{ color: "#6b4a1e", fontSize: 14.5, lineHeight: 2, fontWeight: 500 }}>
        {tab === "privacy" ? (
          <>
            <p>واژه‌سفر هیچ داده‌ای از شما جمع‌آوری نمی‌کند. همه چیز — سکه‌ها، ستاره‌ها و تنظیمات — فقط روی همین دستگاه و در حافظه محلی مرورگر ذخیره می‌شود.</p>
            <p>نه حساب کاربری داریم، نه تبلیغ، نه اجازهٔ دسترسی به مخاطبین یا موقعیت مکانی. بازی کاملاً آفلاین کار می‌کند.</p>
          </>
        ) : (
          <>
            <p><b>واژه‌سفر</b> — سفری واژه‌به‌واژه در سرزمین قصه‌ها؛ ۱۰ فصل، ۱۰۰ مرحله، با همراهی عمو دانا و گربه‌اش.</p>
            <p>همهٔ گرافیک‌ها و موسیقی‌های این بازی اصلی و اختصاصی‌اند: موسیقی به‌صورت زنده و رویه‌ای با گام‌های دستگاهی ایرانی (شور، همایون، سه‌گاه و…) ساخته می‌شود و تصاویر با هوش مصنوعی برای همین بازی تولید شده‌اند.</p>
            <p style={{ fontSize: 12.5, opacity: 0.75 }}>نسخهٔ ۱.۵.۰ — ساخته‌شده با عشق برای واژه‌بازهای ایرانی</p>
          </>
        )}
      </div>
    </Modal>
  );
}
