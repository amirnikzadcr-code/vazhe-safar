package ir.vazhesafar.game;

import android.content.Intent;
import android.net.wifi.WifiManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * LanLink — دورهمی WiFi over a phone HOTSPOT (no internet, no server).
 *
 * Architecture (user: «کسی که اتاق ایجاد میکنه نقطه اتصال گوشیش رو
 * روشن میکنه و هرکس بهش وصل شه وارد اتاق میشه و دستگاه‌ها لیست میشن»):
 *
 *   HOST  = the phone whose hotspot everyone joins. startHost() opens
 *           a TCP ServerSocket (game protocol: newline-delimited JSON)
 *           plus a UDP responder that answers discovery broadcasts.
 *   GUEST = connect()s to the host (IP found via discoverHost UDP
 *           broadcast, or a direct fallback IP), then speaks the same
 *           newline-JSON line protocol.
 *
 * The plugin is transport-DUMB: it moves UTF-8 text lines and reports
 * lifecycle events. ALL game logic (rooms, roster, word claims) lives
 * in TypeScript — src/game/net/lanHub.ts runs IN the host's WebView.
 *
 * Events emitted to JS:
 *   hostReady      {port}                     — TCP server listening
 *   hostDown       {reason}                   — server stopped/failed
 *   clientUp       {id}                       — a device connected (host side)
 *   clientDown     {id}                       — a device dropped (host side)
 *   lanUp          {ip,port}                  — guest linked to host
 *   lanDown        {reason}                   — guest link lost
 *   lanMessage     {id,text}                  — one line of protocol
 */
@CapacitorPlugin(name = "LanLink")
public class LanLinkPlugin extends Plugin {

    private static final int DEFAULT_TCP_PORT = 48765;
    private static final int UDP_PORT = 48766;
    private static final String PING = "VZHS_PING";
    private static final String PONG_PREFIX = "VZHS_PONG:";

    private final AtomicBoolean hosting = new AtomicBoolean(false);
    private final AtomicBoolean clientUp = new AtomicBoolean(false);
    private final AtomicInteger nextId = new AtomicInteger(1);

    private ServerSocket serverSocket;
    private DatagramSocket udpSocket;
    private WifiManager.MulticastLock multicastLock;
    private ExecutorService pool;
    private final Map<String, PrintWriter> writers = new ConcurrentHashMap<>();

    /* ------------------------------------------------------------------
     * HOST
     * ------------------------------------------------------------------ */

    @PluginMethod
    public void startHost(PluginCall call) {
        if (hosting.get()) { call.resolve(); return; }
        int port = call.getInt("port", DEFAULT_TCP_PORT);
        pool = Executors.newCachedThreadPool();
        try {
            acquireMulticastLock();
            hosting.set(true);
            final int tcpPort = port;
            pool.execute(() -> runUdpResponder(tcpPort));
            pool.execute(() -> runTcpServer(tcpPort, call));
        } catch (Exception e) {
            hosting.set(false);
            call.reject("startHost failed: " + e.getMessage());
        }
    }

    private void runTcpServer(int port, PluginCall call) {
        try {
            serverSocket = new ServerSocket();
            serverSocket.setReuseAddress(true);
            serverSocket.bind(new InetSocketAddress(port));
            JSObject ready = new JSObject();
            ready.put("port", port);
            notifyListeners("hostReady", ready);
            call.resolve();
            while (hosting.get() && !serverSocket.isClosed()) {
                final Socket s = serverSocket.accept();
                final String id = "p" + nextId.getAndIncrement();
                s.setTcpNoDelay(true);
                PrintWriter w = new PrintWriter(new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);
                writers.put(id, w);
                final BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                JSObject up = new JSObject(); up.put("id", id);
                notifyListeners("clientUp", up);
                pool.execute(() -> {
                    try {
                        String line;
                        while (hosting.get() && (line = r.readLine()) != null) {
                            if (line.isEmpty()) continue;
                            JSObject m = new JSObject(); m.put("id", id); m.put("text", line);
                            notifyListeners("lanMessage", m);
                        }
                    } catch (Exception ignored) { /* drop */ }
                    writers.remove(id);
                    try { s.close(); } catch (Exception ignored) {}
                    JSObject down = new JSObject(); down.put("id", id);
                    notifyListeners("clientDown", down);
                });
            }
        } catch (Exception e) {
            if (hosting.get()) {
                hosting.set(false);
                JSObject down = new JSObject(); down.put("reason", e.getMessage());
                notifyListeners("hostDown", down);
            }
        }
    }

    /** answer discovery broadcasts so guests can find this hotspot's boss */
    private void runUdpResponder(final int tcpPort) {
        try {
            udpSocket = new DatagramSocket(null);
            udpSocket.setReuseAddress(true);
            udpSocket.setBroadcast(true);
            udpSocket.bind(new InetSocketAddress(UDP_PORT));
            byte[] buf = new byte[64];
            while (hosting.get() && !udpSocket.isClosed()) {
                DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                udpSocket.receive(pkt);
                String msg = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8).trim();
                if (!PING.equals(msg)) continue;
                byte[] pong = (PONG_PREFIX + tcpPort).getBytes(StandardCharsets.UTF_8);
                DatagramPacket res = new DatagramPacket(pong, pong.length, pkt.getAddress(), pkt.getPort());
                udpSocket.send(res);
            }
        } catch (Exception ignored) { /* responder dies with the host */ }
    }

    /* ------------------------------------------------------------------
     * GUEST
     * ------------------------------------------------------------------ */

    @PluginMethod
    public void discoverHost(final PluginCall call) {
        final int timeout = call.getInt("timeoutMs", 4000);
        pool.execute(() -> {
            DatagramSocket ds = null;
            try {
                acquireMulticastLock();
                ds = new DatagramSocket();
                ds.setSoTimeout(600);
                ds.setBroadcast(true);
                byte[] ping = PING.getBytes(StandardCharsets.UTF_8);
                long deadline = System.currentTimeMillis() + timeout;
                while (System.currentTimeMillis() < deadline) {
                    try {
                        DatagramPacket pkt = new DatagramPacket(
                                ping, ping.length,
                                InetAddress.getByName("255.255.255.255"), UDP_PORT);
                        ds.send(pkt);
                        /* one directed retry to the classic hotspot gateway */
                        try {
                            DatagramPacket pkt2 = new DatagramPacket(
                                    ping, ping.length,
                                    InetAddress.getByName("192.168.43.1"), UDP_PORT);
                            ds.send(pkt2);
                        } catch (Exception ignored) {}
                    } catch (Exception ignored) {}
                    byte[] buf = new byte[64];
                    try {
                        DatagramPacket res = new DatagramPacket(buf, buf.length);
                        ds.receive(res);
                        String msg = new String(res.getData(), 0, res.getLength(), StandardCharsets.UTF_8).trim();
                        if (msg.startsWith(PONG_PREFIX)) {
                            JSObject out = new JSObject();
                            out.put("ip", res.getAddress().getHostAddress());
                            out.put("port", Integer.parseInt(msg.substring(PONG_PREFIX.length()).trim()));
                            call.resolve(out);
                            ds.close();
                            return;
                        }
                    } catch (Exception ignored) { /* keep waiting */ }
                }
                call.reject("host not found");
            } catch (Exception e) {
                call.reject("discover failed: " + e.getMessage());
            } finally {
                if (ds != null && !ds.isClosed()) ds.close();
            }
        });
    }

    @PluginMethod
    public void connect(final PluginCall call) {
        if (clientUp.get()) { call.reject("already connected"); return; }
        final String host = call.getString("host", "");
        final int port = call.getInt("port", DEFAULT_TCP_PORT);
        if (host == null || host.length() == 0) { call.reject("host ip required"); return; }
        if (pool == null) pool = Executors.newCachedThreadPool();
        acquireMulticastLock();
        pool.execute(() -> {
            try {
                final Socket s = new Socket();
                s.connect(new InetSocketAddress(host, port), 3500);
                s.setTcpNoDelay(true);
                clientUp.set(true);
                PrintWriter w = new PrintWriter(new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);
                writers.put("host", w);
                final BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                JSObject up = new JSObject();
                up.put("ip", host); up.put("port", port);
                notifyListeners("lanUp", up);
                call.resolve();
                try {
                    String line;
                    while (clientUp.get() && (line = r.readLine()) != null) {
                        if (line.isEmpty()) continue;
                        JSObject m = new JSObject(); m.put("id", "host"); m.put("text", line);
                        notifyListeners("lanMessage", m);
                    }
                } catch (Exception ignored) { /* drop */ }
                clientUp.set(false);
                writers.remove("host");
                try { s.close(); } catch (Exception ignored) {}
                JSObject down = new JSObject(); down.put("reason", "closed");
                notifyListeners("lanDown", down);
            } catch (Exception e) {
                call.reject("connect failed: " + e.getMessage());
            }
        });
    }

    /* ------------------------------------------------------------------
     * COMMON
     * ------------------------------------------------------------------ */

    /** send a text line — host: {peerId} or broadcast when omitted; guest: always to host */
    @PluginMethod
    public void send(final PluginCall call) {
        final String text = call.getString("text", "");
        final String peerId = call.getString("peerId");
        if (text.length() == 0) { call.resolve(); return; }
        pool.execute(() -> {
            if (peerId != null && peerId.length() > 0) {
                PrintWriter w = writers.get(peerId);
                if (w != null) w.println(text);
            } else {
                for (PrintWriter w : writers.values()) w.println(text);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAll();
        call.resolve();
    }

    /** open Android's WiFi settings so the user can toggle the hotspot */
    @PluginMethod
    public void openWifiSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e2) {
                call.reject("settings unavailable");
            }
        }
    }

    private void acquireMulticastLock() {
        if (multicastLock != null && multicastLock.isHeld()) return;
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(android.content.Context.WIFI_SERVICE);
            if (wm == null) return;
            multicastLock = wm.createMulticastLock("vzhs_lan");
            multicastLock.setReferenceCounted(false);
            multicastLock.acquire();
        } catch (Exception ignored) { /* emulators & some ROMs — discovery may still work */ }
    }

    private void stopAll() {
        hosting.set(false);
        clientUp.set(false);
        try { if (serverSocket != null && !serverSocket.isClosed()) serverSocket.close(); } catch (Exception ignored) {}
        try { if (udpSocket != null && !udpSocket.isClosed()) udpSocket.close(); } catch (Exception ignored) {}
        for (PrintWriter w : writers.values()) { try { w.close(); } catch (Exception ignored) {} }
        writers.clear();
        if (multicastLock != null) { try { multicastLock.release(); } catch (Exception ignored) {} }
    }

    @Override
    protected void handleOnDestroy() {
        stopAll();
        if (pool != null) pool.shutdownNow();
        super.handleOnDestroy();
    }
}
