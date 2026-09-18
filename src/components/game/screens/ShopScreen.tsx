"use client";
/* ------------------------------------------------------------------
 * ShopScreen — v4 RELEASE MODE (user: «تمام متن های نمایشی در قسمت
 * فروشگاه حذف کن … الکی پول نده حالت نمایشی در بیار … بخش تبلیغات هم
 * از حالت نمایشی در بیار و کلا خاموشش کن تا بعدا فعالش میکنیم»)
 *
 *  • ZERO demo texts, ZERO simulated purchases — every buy routes
 *    through Monetization.purchase(sku); with the native store bridge
 *    (release APK) → real Myket/Bazaar IAP; without it → a polite
 *    «پس از انتشار فعال می‌شود» message and NOTHING is granted.
 *  • ADS are globally OFF → the rewarded-video tab + sim overlay are
 *    gone from this build (Monetization.ADS_ENABLED brings them back).
 *  • A premium night-gold market — exclusive look, zero backdrop-blur,
 *    one-shot compositor-only animations (60 fps on weak phones).
 * Back button returns to where the player came from (GameApp.leaveShop).
 * ------------------------------------------------------------------ */
import { useState } from "react";
import { Sheet, TopBar, Btn, useToast, ToastHost } from "@/components/game/ui/kit";
import { Coin } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { useCoins } from "@/components/game/useSave";
import { Audio } from "@/game/core/audio";
import { Save } from "@/game/core/save";
import {
  SKUS, Sku, ADS_ENABLED, REWARDED_COINS, REWARDED_COOLDOWN_MS,
  purchase,
} from "@/game/core/monetization";

type Tab = "coins" | "special" | "free";

export function ShopScreen({ onBack }: { onBack: () => void }) {
  const coins = useCoins(); /* live balance — only this chip re-renders */
  const { toast, show } = useToast();
  const [tab, setTab] = useState<Tab>("coins");
  const [pending, setPending] = useState<string | null>(null);
  const [adsRemoved, setAdsRemoved] = useState(Save.data.adsRemoved);

  const buy = async (sku: Sku) => {
    if (pending) return;
    setPending(sku.id);
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
    show(`پرداخت موفق — ${faNum(sku.coins ?? 0)} سکه اضافه شد`);
  };

  /* rewarded card state (only mounted while ads are ON) */
  const rewardedReady = Date.now() - Save.data.lastRewardedAd >= REWARDED_COOLDOWN_MS;
  const waitSec = Math.max(0, Math.ceil((Save.data.lastRewardedAd + REWARDED_COOLDOWN_MS - Date.now()) / 1000));

  const watchAd = async () => {
    if (!rewardedReady || pending) return;
    setPending("rewarded");
    const { showRewardedAd } = await import("@/game/core/monetization");
    const completed = await showRewardedAd();
    setPending(null);
    if (!completed) { Audio.sfxWrong(); show("ویدیو کامل نشد"); return; }
    Audio.sfxCoin();
    Save.data.lastRewardedAd = Date.now();
    Save.addCoins(REWARDED_COINS);
    show(`+${faNum(REWARDED_COINS)} سکه هدیهٔ تماشای ویدیو!`);
  };

  const tabs: [Tab, string][] = ADS_ENABLED
    ? [["coins", "سکه‌ها"], ["special", "ویژه"], ["free", "سکهٔ رایگان"]]
    : [["coins", "سکه‌ها"], ["special", "ویژه"]];

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
        {tabs.map(([id, label]) => (
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

          {tab === "free" && ADS_ENABLED && (
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

        </div>
      </div>

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
