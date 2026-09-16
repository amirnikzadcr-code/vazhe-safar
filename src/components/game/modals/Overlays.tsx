"use client";
/* Pause / Settings / Daily Gift / About modals */
import { useEffect, useState } from "react";
import { Modal, Btn } from "@/components/game/ui/kit";
import { Music, Volume2, Vibrate, Gift as GiftIc } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { bumpSave } from "@/components/game/useSave";

/* ---------------- Pause ----------------
 * Z (user: «دکمه هاش رنگی بی روحن — کارتونی خوشگل طرح دار بکن بهشون
 * روح بده»): every button gets a chunky wooden-plank texture, a
 * stitched inner border, its own cartoon glyph and a springy
 * press-in feel (CSS .b3.fancy). */
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
        <Btn wide className="fancy" onClick={onResume}>
          <PauseGlyph tone="#2ea648" />
          ادامه بازی
        </Btn>
        <Btn wide color="gold" className="fancy" onClick={onRestart}>
          <PauseGlyph tone="#e8940a" />
          شروع دوباره
        </Btn>
        <Btn wide color="blue" className="fancy" onClick={onSettings}>
          <PauseGlyph tone="#2a83d8" />
          تنظیمات
        </Btn>
        <Btn wide color="red" className="fancy" onClick={onExit}>
          <PauseGlyph tone="#d0342c" />
          خروج به نقشه
        </Btn>
      </div>
    </Modal>
  );
}

/* Z — chunky cartoon glyphs for the pause buttons (flag / restart
 * arrow / gear / door) so each action reads at a glance. */
function PauseGlyph({ tone }: { tone: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ flex: "none" }}>
      {tone === "#2ea648" && (
        <path d="M8 5.5 18 12 8 18.5Z" fill={tone} stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      )}
      {tone === "#e8940a" && (
        <g fill="none" stroke={tone} strokeWidth="2.6" strokeLinecap="round">
          <path d="M19 12a7 7 0 1 1-2.1-5" />
          <path d="M17.6 2.9l.3 4.2-4.1-.6" strokeLinejoin="round" />
        </g>
      )}
      {tone === "#2a83d8" && (
        <g fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9" />
        </g>
      )}
      {tone === "#d0342c" && (
        <g fill="none" stroke={tone} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 3.5h-6a1.6 1.6 0 0 0-1.6 1.6v13.8a1.6 1.6 0 0 0 1.6 1.6h6" />
          <path d="M10 12h11M17.5 8.5 21 12l-3.5 3.5" />
        </g>
      )}
    </svg>
  );
}

/* ---------------- Exit confirmation (hardware back button) ----------------
 * user request: pressing the phone's back/exit button must ASK first —
 *   • during the game → «می‌خواهی به صفحهٔ اصلی برگردی؟»
 *   • on the home screen → «می‌خواهی از بازی خارج شوی؟»              */
export function ExitConfirmModal({
  mode, onClose, onConfirm,
}: {
  mode: "app" | "map";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={mode === "app" ? "خروج از بازی" : "بازگشت"} onClose={onClose}>
      <div style={{ textAlign: "center" }}>
        <img
          src="/assets/char/thumb.webp"
          alt="عمو دانا"
          className="breathe"
          style={{ width: 84, height: 84, borderRadius: 999, objectFit: "cover", objectPosition: "50% 20%", border: "3px solid #fff", boxShadow: "0 5px 0 #cfa14f, 0 8px 14px rgba(0,0,0,.25)", margin: "2px auto 10px", display: "block" }}
        />
        <p style={{ fontWeight: 800, color: "#5d3a12", fontSize: 16.5, margin: "0 0 14px" }}>
          {mode === "app" ? "می‌خواهی از بازی خارج شوی؟" : "می‌خواهی به صفحهٔ اصلی برگردی؟"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn wide color="red" onClick={onConfirm}>
            {mode === "app" ? "بله، خارج می‌شوم" : "بله، به صفحهٔ اصلی"}
          </Btn>
          <Btn wide color="green" onClick={onClose}>نه، ادامه می‌دهم</Btn>
        </div>
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

/* ---------------- Settings ----------------
 * v1.21 (user: «در بخش تنظیمات حریم خصوصی و درباره بازی رو حذف کن») —
 * the modal is now JUST the three functional toggles. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
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

/* ---------------- About / Privacy (kept for store-review builds —
 * no longer linked from Settings, v1.21) ---------------- */
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
            <p style={{ fontSize: 12.5, opacity: 0.75 }}>نسخهٔ ۱.۹.۰ — ساخته‌شده با عشق برای واژه‌بازهای ایرانی</p>
          </>
        )}
      </div>
    </Modal>
  );
}
