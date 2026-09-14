/* ------------------------------------------------------------------
 *  واژه‌سفر — core/monetization.ts  (v3)
 *  پرداخت درون‌برنامه‌ای + تبلیغات — آماده برای مایکت و کافه‌بازار
 *  (user: «آمادش کن در صورت انتشار در مایکت و بازار بشه پرداخت
 *   درون برنامه ایی وصل کرد یا بشه تبلیغات گذاشت تو بازی»)
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
 *     • Ads       → Google AdMob (rewarded + interstitial), or the
 *       stores' own ad networks.
 *
 *  3) Product IDs below MUST match the IDs defined in each store's
 *     console (they are intentionally identical across stores).
 *
 *  UNTIL the native plugin ships, everything runs in SIMULATION mode:
 *  the shop flow is fully testable (buttons, toasts, coin grants) and
 *  the game is 100% functional without it.
 * ------------------------------------------------------------------ */

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

/** live inventory — single source of truth for the shop + billing */
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
/** true → the native ads SDK is connected */
export function hasNativeAds(): boolean {
  return adsBridge() != null;
}

export type PurchaseResult =
  | { ok: true; simulated: boolean; sku: Sku }
  | { ok: false; error: string; sku: Sku };

/** purchase a SKU through the native store — or simulate in dev/web */
export async function purchase(sku: Sku): Promise<PurchaseResult> {
  const bridge = billingBridge();
  if (bridge) {
    try {
      const r = await bridge.purchase(sku.id);
      if (r?.ok) return { ok: true, simulated: false, sku };
      return { ok: false, error: r?.error || "خرید انجام نشد", sku };
    } catch {
      return { ok: false, error: "اتصال به فروشگاه برقرار نشد", sku };
    }
  }
  /* SIMULATION — keeps the whole flow testable before the native
   * plugin is wired (release builds connect it in ~30 lines). */
  await new Promise((res) => setTimeout(res, 650));
  return { ok: true, simulated: true, sku };
}

/* ---------------- rewarded / interstitial ads ---------------- */

let simAdResolver: ((completed: boolean) => void) | null = null;

/**
 * Show a rewarded ad. Resolves true ONLY when the video was watched.
 * • native → real AdMob rewarded video
 * • sim    → dispatches `vz:sim-rewarded-ad`; the caller (shop) renders
 *   a small simulated ad overlay and calls completeSimulatedAd(true).
 */
export function showRewardedAd(): Promise<boolean> {
  const bridge = adsBridge();
  if (bridge) {
    return bridge
      .showRewarded()
      .then((r) => !!r?.completed)
      .catch(() => false);
  }
  return new Promise((resolve) => {
    simAdResolver = resolve;
    try { window.dispatchEvent(new CustomEvent("vz:sim-rewarded-ad")); } catch { resolve(false); }
  });
}

/** the simulated-ad overlay calls this when the fake video ends */
export function completeSimulatedAd(completed: boolean): void {
  const r = simAdResolver;
  simAdResolver = null;
  r?.(completed);
}

/** interstitial (future: between chapter transitions when ads are on) */
export function showInterstitialAd(): Promise<boolean> {
  const bridge = adsBridge();
  if (bridge) return bridge.showInterstitial?.().then((r) => !!r?.ok).catch(() => false) ?? Promise.resolve(false);
  return Promise.resolve(false); /* never fake an interstitial */
}
