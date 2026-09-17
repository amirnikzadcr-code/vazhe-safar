package ir.vazhesafar.game;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    /* دورهمی WiFi — hotspot LAN play (TCP host/guest + UDP discovery) */
    registerPlugin(LanLinkPlugin.class);
  }
}
