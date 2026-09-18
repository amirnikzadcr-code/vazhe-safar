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
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * LanLink — دورهمی WiFi over a phone HOTSPOT (no internet, no server).
 *
 * Architecture (user: «کسی که اتاق ایجاد میکنه نقطه اتصال گوشیش رو
 * روشن میکنه و هرکس بهش وصل شه وارد اتاق میشه و دستگاه‌ها لیست میشن»):
 *
 *   HOST  = the phone whose hotspot everyone joins. startHost() opens
 *           a TCP ServerSocket (game protocol: newline-delimited JSON)
 *           plus a UDP responder that answers discovery broadcasts.
 *   GUEST = connect()s to the host (IP found via discoverHost: UDP
 *           broadcast → v7 SUBNET TCP SCAN → direct fallback IP), then
 *           speaks the same newline-JSON line protocol.
 *
 * v7 BUG-FIX ROUND (user: «قسمت دورهمی نقطه اتصال درست کار نمیکنه،
 * پر باگه»):
 *   1. discoverHost no longer NPEs when called before any host/connect
 *      call created the executor (guests hit exactly this path → the
 *      JS promise never settled → «هیچ اتفاقی نمی‌افته»).
 *   2. discoverHost now ALSO sweeps the device's own /24 subnet for
 *      the game TCP port — modern ROMs randomize the hotspot subnet
 *      (192.168.x.1), the old UDP/192.168.43.1-only discovery missed
 *      them entirely.
 *   3. startHost walks a small port range when 48765 is busy (a stale
 *      previous session no longer bricks room creation) and reports
 *      the ACTUAL bound port back to JS.
 *   4. connect() to the SAME host:port while already linked now
 *      RESOLVES instead of rejecting — the join flow could race its
 *      own live socket and report a failure that wasn't one.
 *   5. openWifiSettings opens the TETHER (hotspot) panel first.
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
    private volatile String lastHost = null;
    private volatile int lastPort = -1;
    private final Map<String, PrintWriter> writers = new ConcurrentHashMap<>();

    /** lazily-created executor — v7 fix: EVERY method may be the first
     * user of the pool (guests call discoverHost before anything else) */
    private synchronized ExecutorService exec() {
        if (pool == null) pool = Executors.newCachedThreadPool();
        return pool;
    }

    /* ------------------------------------------------------------------
     * HOST
     * ------------------------------------------------------------------ */

    @PluginMethod
    public void startHost(PluginCall call) {
        if (hosting.get()) { call.resolve(); return; }
        exec();
        acquireMulticastLock();
        hosting.set(true);
        pool.execute(() -> runTcpServer(call.getInt("port", DEFAULT_TCP_PORT), call));
    }

    private void runTcpServer(int port, PluginCall call) {
        try {
            ServerSocket ss = new ServerSocket();
            ss.setReuseAddress(true);
            /* v7 — bind with a small port walk: a lingering previous
             * session (or another app) on 48765 must not brick the room */
            int bound = -1;
            for (int i = 0; i < 12; i++) {
                try { ss.bind(new InetSocketAddress(port + i)); bound = port + i; break; }
                catch (Exception e) { /* next port */ }
            }
            if (bound < 0) {
                try { ss.close(); } catch (Exception ignored) {}
                hosting.set(false);
                call.reject("no port available");
                return;
            }
            serverSocket = ss;
            JSObject ready = new JSObject();
            ready.put("port", bound);
            notifyListeners("hostReady", ready);
            JSObject out = new JSObject();
            out.put("port", bound);
            call.resolve(out);
            pool.execute(() -> runUdpResponder(bound));
            while (hosting.get() && !ss.isClosed()) {
                final Socket s = ss.accept();
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
            DatagramSocket us = new DatagramSocket(null);
            us.setReuseAddress(true);
            us.setBroadcast(true);
            us.bind(new InetSocketAddress(UDP_PORT));
            udpSocket = us;
            byte[] buf = new byte[64];
            while (hosting.get() && !us.isClosed()) {
                DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                us.receive(pkt);
                String msg = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8).trim();
                if (!PING.equals(msg)) continue;
                byte[] pong = (PONG_PREFIX + tcpPort).getBytes(StandardCharsets.UTF_8);
                DatagramPacket res = new DatagramPacket(pong, pong.length, pkt.getAddress(), pkt.getPort());
                us.send(res);
            }
        } catch (Exception ignored) { /* responder dies with the host */ }
    }

    /* ------------------------------------------------------------------
     * GUEST
     * ------------------------------------------------------------------ */

    @PluginMethod
    public void discoverHost(final PluginCall call) {
        final int timeout = call.getInt("timeoutMs", 4000);
        exec();
        pool.execute(() -> {
            try { acquireMulticastLock(); } catch (Exception ignored) {}
            /* pass 1 — UDP broadcast (fast when it works) */
            if (udpProbe(call, timeout)) return;
            /* pass 2 — v7 SUBNET SWEEP: hotspot subnets vary by ROM
             * (192.168.43.x / 192.168.157.x / …). Probe every address
             * of the device's OWN /24 for the game port — the boss is
             * always the hotspot gateway on the guest's subnet. */
            String hit = tcpScan(DEFAULT_TCP_PORT);
            if (hit != null) {
                JSObject out = new JSObject();
                out.put("ip", hit);
                out.put("port", DEFAULT_TCP_PORT);
                call.resolve(out);
                return;
            }
            call.reject("host not found");
        });
    }

    /** UDP ping/pong discovery; resolves the call and returns true on hit */
    private boolean udpProbe(PluginCall call, int timeout) {
        DatagramSocket ds = null;
        try {
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
                        return true;
                    }
                } catch (java.net.SocketTimeoutException ignored) { /* keep waiting */ }
            }
        } catch (Exception ignored) { /* fall through to the subnet sweep */ }
        finally {
            if (ds != null && !ds.isClosed()) ds.close();
        }
        return false;
    }

    /** sweep for the boss: the gateway (.1) is probed on the game port
     * AND its walk-neighbours first (startHost may have shifted the
     * port when 48765 was busy), then every /24 address on the game
     * port (~32 probes in parallel, 90ms connect timeout — a full pass
     * costs ≈1.2s). Returns the winning IP or null. */
    private String tcpScan(int port) {
        String self = localIpv4();
        if (self == null) return null;
        String[] oct = self.split("\\.");
        if (oct.length != 4) return null;
        String prefix = oct[0] + "." + oct[1] + "." + oct[2] + ".";
        /* gateway first — cheapest high-probability hit, port range too */
        String gw = prefix + "1";
        for (int k = 0; k < 4; k++) if (probeTcp(gw, port + k)) return gw;
        final AtomicReference<String> hit = new AtomicReference<>(null);
        ExecutorService sp = Executors.newFixedThreadPool(32);
        try {
            for (int i = 2; i <= 254 && hit.get() == null; i++) {
                final String ip = prefix + i;
                final int p = port;
                sp.execute(() -> {
                    if (hit.get() != null) return;
                    if (probeTcp(ip, p)) hit.compareAndSet(null, ip);
                });
            }
            /* wait up to 1.8s for a hit */
            long end = System.currentTimeMillis() + 1800;
            while (hit.get() == null && System.currentTimeMillis() < end) {
                try { Thread.sleep(40); } catch (Exception ignored) {}
            }
        } finally {
            sp.shutdownNow();
        }
        return hit.get();
    }

    private boolean probeTcp(String ip, int port) {
        Socket s = new Socket();
        try {
            s.connect(new InetSocketAddress(ip, port), 90);
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            try { s.close(); } catch (Exception ignored) {}
        }
    }

    /** the device's own site-local IPv4 (hotspot client side) */
    private String localIpv4() {
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis != null && nis.hasMoreElements()) {
                Enumeration<InetAddress> addrs = nis.nextElement().getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress a = addrs.nextElement();
                    if (a.isSiteLocalAddress() && !a.isLoopbackAddress() && a.getHostAddress().indexOf(':') < 0) {
                        return a.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) { /* no wifi yet */ }
        return null;
    }

    @PluginMethod
    public void connect(final PluginCall call) {
        final String host = call.getString("host", "");
        final int port = call.getInt("port", DEFAULT_TCP_PORT);
        if (host == null || host.length() == 0) { call.reject("host ip required"); return; }
        /* v7 — reconnecting to the SAME host:port while linked is a
         * success (the join flow can race its own live socket); a
         * DIFFERENT target tears the old link down first */
        if (clientUp.get() && host.equals(lastHost) && port == lastPort) { call.resolve(); return; }
        if (clientUp.get()) stopAll();
        exec();
        acquireMulticastLock();
        pool.execute(() -> {
            try {
                final Socket s = new Socket();
                s.connect(new InetSocketAddress(host, port), 3500);
                s.setTcpNoDelay(true);
                clientUp.set(true);
                lastHost = host;
                lastPort = port;
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
        exec();
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

    private boolean tryStart(String action) {
        try {
            Intent intent = new Intent(action);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** open Android's hotspot/wifi settings — v7: the TETHER (نقطه اتصال)
     * panel first, then wireless, then general settings */
    @PluginMethod
    public void openWifiSettings(PluginCall call) {
        if (tryStart("android.settings.TETHER_SETTINGS")
                || tryStart(Settings.ACTION_WIRELESS_SETTINGS)
                || tryStart(Settings.ACTION_SETTINGS)) {
            call.resolve();
        } else {
            call.reject("settings unavailable");
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
        lastHost = null;
        lastPort = -1;
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
