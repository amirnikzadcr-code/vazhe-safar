package ir.vazhesafar.game;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import ir.myket.billingclient.IabHelper;
import ir.myket.billingclient.util.IabResult;
import ir.myket.billingclient.util.Inventory;
import ir.myket.billingclient.util.Purchase;

/**
 * VzBilling — پرداخت درون‌برنامه‌ای مایکت (session GG).
 *
 * user: «برو سایت توسعه دهنده مایکت تحقیق کن … برای پرداخت درون برنامه
 * مایکت باید چیکار بکنی همونو اعمال بکن»
 *
 * Implements the EXACT JS bridge contract that src/game/core/monetization.ts
 * has awaited since v4:
 *     VzBilling.purchase(productId) → { ok, orderId?, error? }
 *     VzBilling.owned()             → { ok, owned: string[] }
 * Registered as `VzBilling`, so the existing shop code starts talking
 * to the real store the moment the RSA key is pasted into
 * res/values/strings.xml (myket_rsa_public_key) — zero JS changes.
 *
 * Store research (Myket developer KB):
 *   • SDK  = com.github.myketstore:myket-billing-client:1.18 (JitPack +
 *           maven.myket.ir) — IabHelper v3-style API; signatures verified
 *           against the published AAR bytecode.
 *   • Manifest placeholders (marketApplicationId / marketBindAddress /
 *           marketPermission) are defined in app/build.gradle — the AAR
 *           merges the BILLING permission + <queries> itself.
 *   • The RSA public key comes from the Myket developer panel.
 *   • Coins are CONSUMABLE products → consumed right after a successful
 *     purchase; «حذف تبلیغات» (remove_ads) stays owned forever.
 *
 * Graceful degradation: without the RSA key (or without the Myket app
 * installed) every call resolves { ok:false, error:… } — the shop shows
 * its neutral connection message and NOTHING crashes or hangs (a 15 s
 * watchdog resolves every call exactly once, whatever happens).
 */
@CapacitorPlugin(name = "VzBilling")
public class MyketBillingPlugin extends Plugin {

    private static final String RSA_KEY_RES = "myket_rsa_public_key";
    private static final String NOT_CONNECTED = "اتصال به فروشگاه برقرار نشد؛ کمی بعد دوباره تلاش کن";
    private static final long SETUP_WATCHDOG_MS = 15_000;

    private IabHelper helper;
    private boolean setupTried = false;
    private boolean setupOk = false;

    /* ---------------- setup ---------------- */

    private synchronized IabHelper ensureHelper() {
        if (helper != null) return helper;
        String rsa;
        try {
            int id = getContext().getResources().getIdentifier(RSA_KEY_RES, "string", getContext().getPackageName());
            rsa = id != 0 ? getContext().getString(id) : "";
        } catch (Exception e) {
            rsa = "";
        }
        if (rsa == null || rsa.trim().isEmpty()) return null; /* not configured yet */
        try {
            helper = new IabHelper(getContext(), rsa.trim());
            helper.enableDebugLogging(false); /* never log purchases in release */
        } catch (Exception e) {
            helper = null;
        }
        return helper;
    }

    /** run `whenReady` on the main thread once billing setup succeeded.
     * Returns false when the bridge is unusable (no key) — the caller
     * must answer the call itself in that case. */
    private synchronized boolean whenSetupReady(final Runnable whenReady) {
        final IabHelper h = ensureHelper();
        if (h == null) return false;
        if (setupOk) { whenReady.run(); return true; }
        if (setupTried) return true;  /* setup in flight — watchdog answers */
        setupTried = true;
        try {
            h.startSetup(new IabHelper.OnIabSetupFinishedListener() {
                @Override public void onIabSetupFinished(IabResult result) {
                    synchronized (MyketBillingPlugin.this) {
                        setupOk = result != null && result.isSuccess();
                        if (!setupOk) setupTried = false; /* allow a retry later */
                    }
                    if (setupOk) whenReady.run();
                }
            });
        } catch (Exception e) {
            setupTried = false;
            return false;
        }
        return true;
    }

    /** resolve exactly once + a watchdog so the JS promise NEVER hangs */
    private static final class Once {
        final PluginCall call;
        final AtomicBoolean done = new AtomicBoolean(false);
        Once(PluginCall call) {
            this.call = call;
            new Handler(Looper.getMainLooper()).postDelayed(() -> resolve(fail(NOT_CONNECTED)), SETUP_WATCHDOG_MS);
        }
        void resolve(JSObject r) {
            if (done.compareAndSet(false, true)) call.resolve(r);
        }
    }

    private static JSObject fail(String msg) {
        JSObject r = new JSObject();
        r.put("ok", false);
        r.put("error", msg);
        return r;
    }

    /* ---------------- bridge methods ---------------- */

    /** purchase(productId) → { ok, orderId?, error? } */
    @PluginMethod
    public void purchase(final PluginCall call) {
        final String sku = call.getString("productId");
        final Once once = new Once(call);
        if (sku == null || sku.isEmpty()) { once.resolve(fail("شناسهٔ محصول نامعتبر است")); return; }
        final Activity activity = getActivity();
        if (activity == null) { once.resolve(fail(NOT_CONNECTED)); return; }
        boolean dispatched = whenSetupReady(new Runnable() {
            @Override public void run() {
                try {
                    helper.launchPurchaseFlow(activity, sku, new IabHelper.OnIabPurchaseFinishedListener() {
                        @Override public void onIabPurchaseFinished(final IabResult result, final Purchase purchase) {
                            activity.runOnUiThread(new Runnable() {
                                @Override public void run() {
                                    if (result != null && result.isSuccess() && purchase != null) {
                                        JSObject r = new JSObject();
                                        r.put("ok", true);
                                        r.put("orderId", purchase.getOrderId());
                                        r.put("sku", purchase.getSku());
                                        once.resolve(r);
                                        /* coins are consumable → free the token
                                         * right away so the user can buy again */
                                        try {
                                            helper.consumeAsync(purchase, new IabHelper.OnConsumeFinishedListener() {
                                                @Override public void onConsumeFinished(Purchase p, IabResult cResult) { /* done */ }
                                            });
                                        } catch (Exception ignored) { /* grant already delivered */ }
                                    } else {
                                        once.resolve(fail(NOT_CONNECTED));
                                    }
                                }
                            });
                        }
                    }, "vz:" + sku);
                } catch (Exception e) {
                    /* IabHelper throws IllegalStateException on async/illegal states */
                    once.resolve(fail(NOT_CONNECTED));
                }
            }
        });
        if (!dispatched) once.resolve(fail(NOT_CONNECTED));
    }

    /** owned() → { ok, owned: string[] } */
    @PluginMethod
    public void owned(final PluginCall call) {
        final Once once = new Once(call);
        boolean dispatched = whenSetupReady(new Runnable() {
            @Override public void run() {
                try {
                    helper.queryInventoryAsync(true, new ArrayList<String>(), new IabHelper.QueryInventoryFinishedListener() {
                        @Override public void onQueryInventoryFinished(IabResult result, Inventory inv) {
                            JSObject r = new JSObject();
                            if (result != null && result.isSuccess() && inv != null) {
                                List<Purchase> all = inv.getAllPurchases();
                                List<String> ids = new ArrayList<>();
                                for (Purchase p : all) if (p != null) ids.add(p.getSku());
                                r.put("ok", true);
                                r.put("owned", new JSONArray(ids));
                            } else {
                                r.put("ok", false);
                                r.put("owned", new JSONArray());
                            }
                            once.resolve(r);
                        }
                    });
                } catch (Exception e) {
                    once.resolve(fail(NOT_CONNECTED));
                }
            }
        });
        if (!dispatched) once.resolve(fail(NOT_CONNECTED));
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            if (helper != null) helper.dispose();
        } catch (Exception ignored) { /* noop */ }
        helper = null;
        setupOk = false;
        setupTried = false;
    }
}
