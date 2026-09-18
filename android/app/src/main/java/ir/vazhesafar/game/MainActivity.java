package ir.vazhesafar.game;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    /* EE — CRITICAL LAN FIX (user: «در دورهمی وقتی میزنم روی ساخت اتاق
     * میزنه روی دستگاه شما ممکن نبود خطا میده»): BridgeActivity.onCreate
     * (i.e. super.onCreate) BUILDS the bridge — it consumes every plugin
     * registered so far via this.load() at its very end. registerPlugin()
     * called AFTER super.onCreate() appended to a builder whose bridge
     * was already created → the LanLink plugin was NEVER registered →
     * EVERY native LAN call (startHost/discoverHost/connect/send)
     * rejected with "not implemented" → «ساخت اتاق روی این دستگاه
     * ممکن نشد» on EVERY device. Registering BEFORE super.onCreate()
     * puts the plugin inside the bridge build — the actual Capacitor
     * documented order for custom plugins. */
    registerPlugin(LanLinkPlugin.class);
    /* GG — پرداخت درون‌برنامه‌ای مایکت: registers the `VzBilling` bridge
     * (the contract src/game/core/monetization.ts already calls). Safe
     * before super.onCreate for the same reason as LanLink above. */
    registerPlugin(MyketBillingPlugin.class);
    super.onCreate(savedInstanceState);

    /* v7 PERF — WebView tuning for the «APK خیلی کنده» complaints:
     *  • never overscroll (no edge-glow repaints on fling)
     *  • explicit hardware layer on the WebView (some OEM WebViews
     *    boot software-composited until first GPU hint)
     *  • renderer kept at IMPORTANT: the renderer process is never
     *    deprioritized mid-game, so frames are not dropped when the
     *    OS trims background processes. */
    try {
      WebView wv = this.bridge.getWebView();
      wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
      wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
      }
      wv.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
    } catch (Exception ignored) {
      /* older bridges — tuning is best-effort */
    }
  }
}
