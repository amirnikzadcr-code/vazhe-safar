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
    super.onCreate(savedInstanceState);
    /* دورهمی WiFi — hotspot LAN play (TCP host/guest + UDP discovery) */
    registerPlugin(LanLinkPlugin.class);

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
