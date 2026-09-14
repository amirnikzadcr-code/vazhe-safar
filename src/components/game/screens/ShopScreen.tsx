"use client";
/* ------------------------------------------------------------------
 * ShopScreen — v3 FULL REDESIGN («فروشگاه رو خوشگل تر و اختصاصی تر بکن»)
 * A premium night-gold market — exclusive look, zero backdrop-blur,
 * one-shot compositor-only animations (60 fps on weak phones).
 *
 * Monetization-ready (user: «آمادش کن در صورت انتشار در مایکت و بازار
 * بشه پرداخت درون برنامه ایی وصل کرد یا بشه تبلیغات گذاشت»):
 *   • every buy button routes through Monetization.purchase(sku)
 *   • with the native bridge (APK) → real Myket/Bazaar IAP
 *   • without it → SIMULATED purchase so the flow is testable
 *   • «سکهٔ رایگان» tab = rewarded-video slot (AdMob-ready; simulated
 *     in web with a small in-page ad overlay)
 *   • «حذف تبلیغات» product persists in the save (Save.data.adsRemoved)
 * Back button returns to where the player came from (GameApp.leaveShop).
 * ------------------------------------------------------------------ */
import { useEffect, useState } from "react";
import { Sheet, TopBar, Btn, useToast, ToastHost } from "@/components/game/ui/kit";
import { Coin, Sparkles } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { useCoins } from "@/components/game/useSave";
import { Audio } from "@/game/core/audio";
import { Save } from "@/game/core/save";
import {
  SKUS, Sku, REWARDED_COINS, REWARDED_COOLDOWN_MS,
  purchase, showRewardedAd, completeSimulatedAd, hasNativeBilling,
} from "@/game/core/monetization";

type Tab = "coins" | "special" | "free";

export function ShopScreen({ onBack }: { onBack: () => void }) {
  const coins = useCoins(); /* live balance — only this chip re-renders */
  const { toast, show } = useToast();
  const [tab, setTab] = useState<Tab>("coins");
  const [pending, setPending] = useState<string | null>(null);
  const [adsRemoved, setAdsRemoved] = useState(Save.data.adsRemoved);
  const [simAd, setSimAd] = useState(false);
  const [adTick, setAdTick] = useState(0); /* re-render for the cooldown text */

  /* cooldown ticker for the rewarded card (only while the tab is open) */
  useEffect(() => {
    if (tab !== "free") return;
    const id = setInterval(() => setAdTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [tab]);

  const rewardedReady = Date.now() - Save.data.lastRewardedAd >= REWARDED_COOLDOWN_MS;
  const waitSec = Math.max(0, Math.ceil((Save.data.lastRewardedAd + REWARDED_COOLDOWN_MS - Date.now()) / 1000));

  /* simulated rewarded video (web/preview — native uses real AdMob) */
  useEffect(() => {
    const open = () => setSimAd(true);
    window.addEventListener("vz:sim-rewarded-ad", open);
    return () => window.removeEventListener("vz:sim-rewarded-ad", open);
  }, []);

  const buy = async (sku: Sku) => {
    if (pending) return;
    setPending(sku.id);
    show("در حال اتصال به فروشگاه…");
    const r = await purchase(sku);
    setPending(null);
    if (!r.ok) { Audio.sfxWrong(); show(r.error); return; }
    Audio.sfxCoin();
    if (sku.kind === "removeads") {
      Save.data.adsRemoved = true;
      Save.persist();
      setAdsRemoved(true);
      show("تبلیغات حذف شد! 🎉");
      return;
    }
    Save.addCoins(sku.coins ?? 0);
    show(r.simulated
      ? `خرید نمایشی موفق — ${faNum(sku.coins ?? 0)} سکه اضافه شد`
      : `پرداخت موفق — ${faNum(sku.coins ?? 0)} سکه اضافه شد`);
  };

  const watchAd = async () => {
    if (!rewardedReady || pending) return;
    setPending("rewarded");
    const completed = await showRewardedAd();
    setPending(null);
    if (!completed) { Audio.sfxWrong(); show("ویدیو کامل نشد"); return; }
    Audio.sfxCoin();
    Save.data.lastRewardedAd = Date.now();
    Save.addCoins(REWARDED_COINS);
    setAdTick((t) => t + 1);
    show(`+${faNum(REWARDED_COINS)} سکه هدیهٔ تماشای ویدیو!`);
  };

  return (
    <Sheet bg="/assets/bg/sunset2.webp" bgDim={0.56}>
      <TopBar onBack={onBack} title="فروشگاه" />

      {/* golden hero — exclusive shop identity */}
      <div className="shop2-hero" key="hero">
        <span className="shop2-hero-medal"><Coin size={46} /></span>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div className="shop2-hero-title">بازار واژه‌سفر</div>
          <div className="shop2-hero-sub">سکه جمع کن، راهنماها همیشه همراهت!</div>
        </div>
        <span className="chip shop2-balance">
          <span className="coin-ic" style={{ width: 16, height: 16 }} />
          {faNum(coins)}
        </span>
      </div>

      {/* segmented tabs */}
      <div className="shop2-tabs" role="tablist">
        {([
          ["coins", "سکه‌ها"],
          ["special", "ویژه"],
          ["free", "سکهٔ رایگان"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`shop2-tab ${tab === id ? "on" : ""}`}
            onClick={() => { Audio.sfxClick(); setTab(id); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* tab content — keyed remount = one-shot entrance animation */}
      <div className="scrolly" style={{ paddingBottom: 20 }}>
        <div key={tab} className="shop2-body">

          {tab === "coins" && SKUS.filter((s) => s.kind === "coins").map((s, i) => (
            <ShopCard key={s.id} sku={s} i={i} pending={pending} onBuy={buy} />
          ))}

          {tab === "special" && (
            <>
              <ShopCard
                sku={SKUS.find((s) => s.id === "golden_bundle")!}
                i={0}
                pending={pending}
                onBuy={buy}
                sub="همهٔ آنچه یک مسافر طلایی لازم دارد"
              />
              <div className="shop2-card" style={{ ["--i" as string]: 1 }}>
                <span className="shop2-medal shop2-medal-ad">
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#ffe9a8" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" />
                    <path fill="none" stroke="#8a5a00" strokeWidth="2" d="m8.6 12.2 2.3 2.3 4.5-4.7" />
                  </svg>
                </span>
                <div style={{ flex: 1 }}>
                  <div className="shop2-card-title">حذف تبلیغات</div>
                  <div className="shop2-card-sub">بازی برای همیشه بدون تبلیغ</div>
                </div>
                {adsRemoved ? (
                  <span className="shop2-owned">فعال است ✓</span>
                ) : (
                  <Btn
                    color="gold"
                    style={{ fontSize: 14, padding: ".45em 1.1em" }}
                    disabled={pending !== null}
                    onClick={() => buy(SKUS.find((s) => s.id === "remove_ads")!)}
                  >
                    {pending === "remove_ads" ? "…" : SKUS.find((s) => s.id === "remove_ads")!.price}
                  </Btn>
                )}
              </div>
            </>
          )}

          {tab === "free" && (
            adsRemoved ? (
              <div className="shop2-quiet">تبلیغات حذف شده — تو نسخهٔ پرمیوم هستی ✨</div>
            ) : (
              <>
                <div className="shop2-card shop2-free" style={{ ["--i" as string]: 0 }}>
                  <span className="shop2-medal shop2-medal-play">
                    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="3" fill="#7cc9ff" stroke="#2d6da8" strokeWidth="1.6" />
                      <path d="M10.4 9.2v5.6l5-2.8-5-2.8z" fill="#fff" />
                    </svg>
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="shop2-card-title">تماشای ویدیو</div>
                    <div className="shop2-card-sub">
                      {rewardedReady ? `ویدیوی کوتاه ببین، +${faNum(REWARDED_COINS)} سکه بگیر` : `دوباره تا ${faNum(Math.ceil(waitSec / 60))}:${faNum(waitSec % 60).padStart(2, "۰")} فرصت صبر`}
                    </div>
                  </div>
                  <Btn
                    color={rewardedReady ? "green" : "teal"}
                    style={{ fontSize: 14, padding: ".45em 1.1em" }}
                    disabled={!rewardedReady || pending !== null}
                    onClick={watchAd}
                  >
                    {pending === "rewarded" ? "…" : "دریافت"}
                  </Btn>
                </div>
                <p className="shop2-note">
                  تبلیغات باعث می‌شود بازی برای همه رایگان بماند — ممنون که همراه ما هستی!
                </p>
              </>
            )
          )}

          <p className="shop2-note">
            پرداخت امن از طریق
            <b> مایکت </b>و<b> کافه‌بازار</b>
            {hasNativeBilling() ? "" : " — در این نسخه، خرید نمایشی است"}
          </p>
        </div>
      </div>

      {/* simulated rewarded video — only when the native ads SDK is absent */}
      {simAd && <SimAdOverlay onDone={(ok) => { setSimAd(false); completeSimulatedAd(ok); }} />}

      <ToastHost toast={toast} />
    </Sheet>
  );
}

function ShopCard({
  sku, i, pending, onBuy, sub,
}: {
  sku: Sku;
  i: number;
  pending: string | null;
  onBuy: (sku: Sku) => void;
  sub?: string;
}) {
  return (
    <div className="shop2-card" style={{ ["--i" as string]: i }}>
      <span className="shop2-medal">
        <Coin size={sku.kind === "bundle" ? 44 : 36} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="shop2-card-title">
          {sku.title}
          {sku.hot && <span className="shop2-ribbon">پرفروش‌ترین</span>}
        </div>
        <div className="shop2-card-sub">
          <b className="shop2-coins">{faNum(sku.coins ?? 0)} سکه</b>
          {sku.bonus && <span className="shop2-bonus">{sku.bonus}</span>}
          {sub && <span> · {sub}</span>}
        </div>
      </div>
      <Btn
        color={sku.hot || sku.kind === "bundle" ? "gold" : "green"}
        style={{ fontSize: 14, padding: ".45em 1.1em" }}
        disabled={pending !== null}
        onClick={() => onBuy(sku)}
      >
        {pending === sku.id ? "…" : sku.price}
      </Btn>
    </div>
  );
}

/* ---- simulated rewarded video (web/preview only; native = real AdMob) ---- */
function SimAdOverlay({ onDone }: { onDone: (completed: boolean) => void }) {
  const [left, setLeft] = useState(4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="sim-ad" role="dialog" aria-modal="true" aria-label="نمایش ویدیو">
      <div className="sim-ad-frame">
        <div className="sim-ad-head">ویدیوی حامی بازی</div>
        <div className="sim-ad-art">
          <Sparkles size={44} />
          <div style={{ fontWeight: 800, marginTop: 6 }}>جای ویدیوی تبلیغ</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>نسخهٔ اندروید: ویدیوی واقعی</div>
        </div>
        {left > 0 ? (
          <div className="sim-ad-count">{faNum(left)}</div>
        ) : (
          <Btn size="big" color="gold" onClick={() => { Audio.sfxClick(); onDone(true); }}>
            دریافت سکه
          </Btn>
        )}
        <button type="button" className="sim-ad-close" onClick={() => onDone(left <= 0)}>
          {left > 0 ? "رد کردن (سکه‌ای نمی‌گیری)" : "بستن"}
        </button>
      </div>
    </div>
  );
}
