"use client";
/* ------------------------------------------------------------------
 * ShopScreen — v2.0 full visual upgrade (user request: «صفحه فروشگاه
 * رو خوشگل تر بکن ارتقا بده»):
 *   • golden hero banner with glossy sheen sweep
 *   • cartoon pack cards: coin-badge with animated coin face, price
 *     pill, springy staggered entrance, bobbing badges
 *   • pulsing «محبوب» ribbon
 *   • purple special bundle with twinkling sparkles
 * Back button returns to where the player came from (GameApp.leaveShop).
 * ------------------------------------------------------------------ */
import { Sheet, TopBar, Btn, useToast, ToastHost } from "@/components/game/ui/kit";
import { Coin, Sparkles } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";

const PACKS = [
  { coins: 50,   price: "۵۰۰ تومان",   hot: false },
  { coins: 250,  price: "۲٬۴۵۰ تومان", hot: true },
  { coins: 550,  price: "۴٬۹۰۰ تومان", hot: false },
  { coins: 1200, price: "۹٬۹۰۰ تومان", hot: false },
];

export function ShopScreen({ coins, onBack }: { coins: number; onBack: () => void }) {
  const { toast, show } = useToast();

  return (
    <Sheet bg="/assets/bg/home2.webp" bgDim={0.34}>
      <TopBar coins={coins} onBack={onBack} title="فروشگاه" />

      {/* golden hero banner */}
      <div className="shop-hero">
        <span style={{ display: "inline-flex", filter: "drop-shadow(0 3px 4px rgba(120,60,0,.4))" }}>
          <Coin size={44} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#5d2c04", fontSize: 17, textShadow: "0 1px 0 rgba(255,255,255,.45)" }}>
            بستهٔ سکه
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#7a4a10" }}>
            برای راهنما و ادامهٔ بازی سکه جمع کن!
          </div>
        </div>
        <span className="chip" style={{ fontSize: 13, gap: 5, padding: "3px 10px" }}>
          <span className="coin-ic" style={{ width: 15, height: 15 }} />
          {faNum(coins)}
        </span>
      </div>

      <div className="scrolly">
        <div style={{ display: "flex", flexDirection: "column", gap: 13, paddingBottom: 22 }}>

          {/* coin packs — cartoon cards */}
          {PACKS.map((p, i) => (
            <div key={p.coins} className="shop-pack" style={{ ["--i" as string]: i }}>
              <span className="pack-badge" style={{ ["--i" as string]: i }}>
                <Coin size={36} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "#5d3a12", fontSize: 16.5, display: "flex", alignItems: "center", gap: 6 }}>
                  {faNum(p.coins)} سکه
                </div>
                <span className="price-pill">
                  <Sparkles size={11} style={{ verticalAlign: -1 }} />
                  {p.price}
                </span>
              </div>
              {p.hot && <span className="ribbon">🔥 محبوب‌ترین</span>}
              <Btn color={p.hot ? "gold" : "green"} style={{ fontSize: 14.5, padding: ".5em 1.15em" }} onClick={() => show("خرید در نسخهٔ فعلی فعال نیست — به‌زودی در نسخهٔ اندروید!")}>
                خرید
              </Btn>
            </div>
          ))}

          {/* special bundle — purple mystery chest */}
          <div className="shop-bundle">
            <img src="/assets/obj/chest.webp" alt="بسته ویژه" className="breathe" style={{ height: 76, objectFit: "contain", flex: "none", filter: "drop-shadow(0 4px 6px rgba(20,0,60,.45))" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: "#fff", fontSize: 16.5, textShadow: "0 2px 3px rgba(40,0,90,.5)" }}>بستهٔ ویژه</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#ecdcff" }}>شگفتی‌های جذاب، پیشرفت دلت آب می‌شه!</div>
            </div>
            <Btn color="gold" style={{ fontSize: 14.5, padding: ".5em 1.15em" }} onClick={() => show("به‌زودی در نسخهٔ اندروید!")}>اطلاعات</Btn>
          </div>

          <p className="shop-note">
            خریدهای واقعی فقط در نسخهٔ اندروید فعال می‌شوند.
          </p>
        </div>
      </div>

      <ToastHost toast={toast} />
    </Sheet>
  );
}
