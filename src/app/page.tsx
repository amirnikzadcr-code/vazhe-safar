import { GameApp } from "@/components/game/GameApp";

/**
 * v2.4 — INSTANT BOOT SHELL (user: «موقع لود کنده … صفحه آبی گیر میکنه
 * چند ثانیه»). This is a SERVER component: the branded splash paints the
 * moment the WebView shows HTML — BEFORE any JavaScript parses/hydrates.
 * The old client-only mount left a blank void during bundle boot on weak
 * phones (read as a "stuck blue screen"). GameApp renders its own live
 * splash (with the real progress bar) on top of this static shell.
 */
export default function Home() {
  return (
    <main className="vz-body" dir="rtl" lang="fa" aria-label="واژه‌سفر — بازی پازل کلمات ایرانی">
      <div className="vz-phone">
        {/* static splash shell — pure HTML/CSS, paints instantly */}
        <div className="boot-shell" aria-hidden>
          <div className="boot-sky" />
          <div className="boot-inner">
            <div className="boot-logo">واژه‌سفر</div>
            <div className="boot-bar"><i /></div>
            <div className="boot-hint">برای شروع آماده می‌شویم…</div>
          </div>
        </div>
        <GameApp />
      </div>
    </main>
  );
}
