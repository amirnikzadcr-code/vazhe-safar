/* ------------------------------------------------------------------
 *  واژه‌سفر — core/monetization.ts  (v4 — RELEASE MODE)
 *  پرداخت درون‌برنامه‌ای + تبلیغات — آماده برای مایکت و کافه‌بازار
 *
 *  v4 (user: «الکی پول نده حالت نمایشی در بیار… بخش تبلیغات هم از
 *  حالت نمایشی در بیار و کلا خاموشش کن تا بعدا فعالش میکنیم»):
 *   • NO simulation anywhere — without the native store bridge a
 *     purchase simply reports «پس از انتشار فعال می‌شود» and NEVER
 *     grants fake coins.
 *   • ADS are globally OFF (ADS_ENABLED = false) — the rewarded-video
 *     tab, the simulated ad overlay, every ad UI is removed from the
 *     release build. Flip the flag when the ad SDK is connected.
 *
 *  ─────────────────────────────────────────────────────────────────
 *  HOW THE REAL STORES CONNECT (native side — future tiny plugin):
 *
 *  1) Add a small Capacitor plugin (Java/Kotlin) that registers two
 *     bridge objects with EXACTLY this JSON contract:
 *       VzBilling.purchase(productId) → { ok, orderId?, error? }
 *       VzBilling.owned()             → { ok, owned: string[] }
 *       VzAds.showRewarded()          → { completed: boolean }
 *       VzAds.showInterstitial()      → { ok: boolean }
 *     Accessible as `window.VzBilling` / `window.VzAds`, or through
 *     Capacitor's registry (`Capacitor.Plugins.VzBilling`).
 *
 *  2) Store SDKs behind the bridge:
 *     • کافه‌بازار → Poolakey (ir.cafebazaar.poolakey) IAB
 *     • مایکت    → Myket In-App Billing (com.myket.android.billing)
 *     • Ads       → Tapsell / Google AdMob (rewarded + interstitial)
 *
 *  3) Product IDs below MUST match the IDs defined in each store's
 *     console (they are intentionally identical across stores).
 * ------------------------------------------------------------------ */

/** MASTER SWITCH — ads are OFF for the store release. Turn this on
 * after the ad SDK (Tapsell/AdMob) is wired through the VzAds bridge
 * and the «حذف تبلیغات» product should go live. */
export const ADS_ENABLED = false;

export type SkuKind = "coins" | "removeads" | "bundle";

export interface Sku {
  id: string;
  kind: SkuKind;
  title: string;
  price: string;      // Toman display price (matches store console)
  coins?: number;     // granted on success
  hot?: boolean;      // «پرفروش‌ترین» ribbon
  bonus?: string;     // value badge, e.g. «+۱۵٪ هدیه»
}

/** live inventory — single source of truth for the shop + billing.
 * IDs match the products registered in the Myket / Bazaar consoles. */
export const SKUS: Sku[] = [
  { id: "coins_50",   kind: "coins", title: "کیسهٔ سکه",       price: "۵٬۰۰۰ تومان",   coins: 50 },
  { id: "coins_250",  kind: "coins", title: "صندوق سکه",      price: "۱۹٬۰۰۰ تومان",  coins: 250, hot: true, bonus: "+۱۵٪ هدیه" },
  { id: "coins_550",  kind: "coins", title: "خمرهٔ سکه",      price: "۳۹٬۰۰۰ تومان",  coins: 550, bonus: "+۲۵٪ هدیه" },
  { id: "coins_1200", kind: "coins", title: "گنج سکه",        price: "۷۹٬۰۰۰ تومان",  coins: 1200, bonus: "+۴۰٪ هدیه" },
  { id: "golden_bundle", kind: "bundle", title: "بستهٔ طلایی مسافر", price: "۱۲۹٬۰۰۰ تومان", coins: 2000 },
  { id: "remove_ads", kind: "removeads", title: "حذف تبلیغات",  price: "۲۹٬۰۰۰ تومان" },
];

export const REWARDED_COINS = 30;
/** minimum gap between rewarded payouts (3 minutes) */
export const REWARDED_COOLDOWN_MS = 3 * 60_000;

/* ---------------- bridges (native contract) ---------------- */

interface BillingBridge {
  purchase(productId: string): Promise<{ ok: boolean; orderId?: string; error?: string }>;
  owned?(): Promise<{ ok: boolean; owned: string[] }>;
}
interface AdsBridge {
  showRewarded(): Promise<{ completed: boolean }>;
  showInterstitial?(): Promise<{ ok: boolean }>;
}

function billingBridge(): BillingBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.VzBilling ?? w.Capacitor?.Plugins?.VzBilling ?? null) as BillingBridge | null;
}
function adsBridge(): AdsBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.VzAds ?? w.Capacitor?.Plugins?.VzAds ?? null) as AdsBridge | null;
}

/** true → the native store billing is connected (APK with the plugin) */
export function hasNativeBilling(): boolean {
  return billingBridge() != null;
}
/** true → the native ads SDK is connected AND ads are switched on */
export function hasNativeAds(): boolean {
  return ADS_ENABLED && adsBridge() != null;
}

export type PurchaseResult =
  | { ok: true; sku: Sku }
  | { ok: false; error: string; sku: Sku };

/** v5 — NO «پس از انتشار فعال می‌شود» demo texts anywhere (user: «اون
 * متن هایی ک نوشتی تو فروشگاه پرداخت وقتی منتشر شود فعال می‌شود رو پاک
 * کن»). A tap without the native store bridge is just a normal failed
 * connection — a neutral transient error, nothing is granted, and no
 * meta-commentary about release state ever reaches the player. */
export const BILLING_UNAVAILABLE_MSG = "اتصال به فروشگاه برقرار نشد؛ کمی بعد دوباره تلاش کن";

/** purchase a SKU through the native store. Without the bridge nothing
 * is granted — the shop shows a neutral connection error. */
export async function purchase(sku: Sku): Promise<PurchaseResult> {
  const bridge = billingBridge();
  if (!bridge) return { ok: false, error: BILLING_UNAVAILABLE_MSG, sku };
  try {
    const r = await bridge.purchase(sku.id);
    if (r?.ok) return { ok: true, sku };
    return { ok: false, error: r?.error || "خرید انجام نشد", sku };
  } catch {
    return { ok: false, error: "اتصال به فروشگاه برقرار نشد", sku };
  }
}

/* ---------------- rewarded / interstitial ads ----------------
 * Ads are OFF in this build (ADS_ENABLED = false): showRewardedAd
 * resolves false immediately and NO overlay/event ever fires. When the
 * ad SDK ships behind the VzAds bridge, flip the flag — the shop UI
 * (free-coins tab) comes back automatically. */

/**
 * Show a rewarded ad. Resolves true ONLY when the video was watched.
 * • ads OFF            → resolves false instantly (no UI)
 * • native + ads ON    → real rewarded video through the bridge
 */
export function showRewardedAd(): Promise<boolean> {
  if (!ADS_ENABLED) return Promise.resolve(false);
  const bridge = adsBridge();
  if (bridge) {
    return bridge
      .showRewarded()
      .then((r) => !!r?.completed)
      .catch(() => false);
  }
  return Promise.resolve(false);
}

/** interstitial (future: between chapter transitions when ads are on) */
export function showInterstitialAd(): Promise<boolean> {
  if (!ADS_ENABLED) return Promise.resolve(false);
  const bridge = adsBridge();
  if (bridge) return bridge.showInterstitial?.().then((r) => !!r?.ok).catch(() => false) ?? Promise.resolve(false);
  return Promise.resolve(false);
}
