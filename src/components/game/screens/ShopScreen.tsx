"use client";
/* ------------------------------------------------------------------
 * ShopScreen — coin packs (demo pricing) + special bundle + free bonus
 * ------------------------------------------------------------------ */
import { useEffect, useState } from "react";
import { Sheet, TopBar, Btn, useToast, ToastHost } from "@/components/game/ui/kit";
import { Sparkles, Gift as GiftIc, Play } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Save } from "@/game/core/save";
import { Audio } from "@/game/core/audio";
import { bumpSave } from "@/components/game/useSave";

const PACKS = [
  { coins: 50,   price: "۵۰۰ تومان",  hot: false },
  { coins: 250,  price: "۲٬۴۵۰ تومان", hot: true },
  { coins: 550,  price: "۴٬۹۰۰ تومان", hot: false },
  { coins: 1200, price: "۹٬۹۰۰ تومان", hot: false },
];

const FREE_KEY = "vz_free30_at";
const COOLDOWN = 10 * 60 * 1000;

export function ShopScreen({ coins, onBack }: { coins: number; onBack: () => void }) {
  const { toast, show } = useToast();
  const [, tick] = useState(0);
  const [freeReady, setFreeReady] = useState(false);

  useEffect(() => {
    const calc = () => {
      const last = Number(localStorage.getItem(FREE_KEY) || 0);
      setFreeReady(Date.now() - last >= COOLDOWN);
    };
    calc();
    const t = setInterval(calc, 5000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const grabFree = () => {
    const last = Number(localStorage.getItem(FREE_KEY) || 0);
    if (Date.now() - last < COOLDOWN) return;
    localStorage.setItem(FREE_KEY, String(Date.now()));
    Save.addCoins(30);
    Audio.sfxCoin();
    bumpSave();
    setFreeReady(false);
    show("۳۰ سکه هدیه گرفتید!");
  };

  return (
    <Sheet bg="/assets/bg/home2.webp" bgDim={0.32} blur={2}>
      <TopBar coins={coins} onBack={onBack} title="فروشگاه" />

      <div className="scrolly">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 22 }}>
          {PACKS.map((p) => (
            <div key={p.coins} className="panel" style={{ borderRadius: 20, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <span style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(180deg,#fff3d0,#ffd76e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 -3px 3px rgba(160,100,0,.3)", flex: "none" }}>
                
                <img src="/assets/obj/gift.webp" alt="" style={{ height: 44, objectFit: "contain" }} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "#5d3a12", fontSize: 16 }}>{faNum(p.coins)} سکه</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8a6a3a" }}>{p.price}</div>
              </div>
              {p.hot && (
                <span style={{ position: "absolute", top: -9, right: 14, background: "linear-gradient(180deg,#ff9d9d,#e13f3f)", color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "2px 10px", boxShadow: "0 3px 0 #a31f1f" }}>
                  <Sparkles size={11} style={{ verticalAlign: -1 }} /> محبوب
                </span>
              )}
              <Btn color={p.hot ? "gold" : "green"} style={{ fontSize: 14, padding: ".5em 1.1em" }} onClick={() => show("خرید در نسخهٔ فعلی فعال نیست — جایزهٔ رایگان زیر را از دست نده!")}>
                خرید
              </Btn>
            </div>
          ))}

          {/* special bundle */}
          <div className="panel" style={{ borderRadius: 22, padding: 14, display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(180deg,#fff7e0,#ffe3ae)" }}>
            
            <img src="/assets/obj/chest.webp" alt="بسته ویژه" className="breathe" style={{ height: 74, objectFit: "contain", flex: "none" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: "#7a4a00", fontSize: 16 }}>بستهٔ ویژه</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8a6a3a" }}>امتیاز جذاب، پیشرفت دلت آب می‌شه!</div>
            </div>
            <Btn color="teal" style={{ fontSize: 14, padding: ".5em 1.1em" }} onClick={() => show("به‌زودی در نسخهٔ اندروید!")}>اطلاعات</Btn>
          </div>

          {/* free bonus */}
          <Btn wide color={freeReady ? "gold" : "green"} size="big" onClick={grabFree} disabled={!freeReady}>
            <Play size={20} />
            {freeReady ? "جایزهٔ رایگان: ۳۰ سکه بگیر!" : "جایزهٔ بعدی تا چند دقیقهٔ دیگر"}
          </Btn>

          <p style={{ textAlign: "center", color: "#ffe9c8", fontSize: 12, fontWeight: 600, textShadow: "0 2px 4px rgba(0,0,0,.4)" }}>
            خریدهای واقعی فقط در نسخهٔ اندروید فعال می‌شوند.
          </p>
        </div>
      </div>

      <ToastHost toast={toast} />
    </Sheet>
  );
}
