"use client";
/* ------------------------------------------------------------------
 * WelcomeScreen + Splash
 * ------------------------------------------------------------------ */
import { useEffect, useRef, useState } from "react";
import { Btn, Vines } from "@/components/game/ui/kit";
import { Audio } from "@/game/core/audio";
import { preloadAssets } from "@/game/core/preload";

/* ---------- Welcome back ---------- */
export function WelcomeScreen({
  onContinue, onHome,
}: {
  onContinue: () => void;
  onHome: () => void;
}) {
  return (
    <div className="vz-page fade-in">

      <img src="/assets/bg/home2b.webp" alt="" className="vz-fill" />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,50,90,.35), rgba(20,50,90,.55))" }} />
      <Vines />
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", padding: 22, gap: 6 }}>

        <div
          style={{
            height: "min(36vh, 258px)", width: "min(88%, 300px)", overflow: "hidden",
            borderRadius: "26px", border: "3px solid #fff", outline: "2px solid #e5c07b",
            boxShadow: "0 16px 26px rgba(0,0,0,.4)", flex: "none",
          }}
        >
          <img
            src="/assets/char/rest.webp"
            alt="عمو دانا در حال استراحت"
            className="float-slow"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }}
          />
        </div>
        <h2 className="title3d" data-t="برگشتی!" style={{ fontSize: 40, margin: "4px 0 0" }}>
          برگشتی!
        </h2>
        <p style={{ color: "#fff3dd", textAlign: "center", fontWeight: 700, lineHeight: 2, margin: "2px 8px 10px", textShadow: "0 2px 6px rgba(20,10,0,.55)" }}>
          مدتی نبودی! چای تازه دم کردیم؛
          <br />
          کلمه‌ها همین‌جا منتظرت بودند…
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", width: "100%" }}>
          <Btn color="gold" size="big" style={{ minWidth: 250 }} onClick={onContinue}>
            دوباره بازی کن
          </Btn>
          <Btn color="teal" style={{ minWidth: 250 }} onClick={onHome}>
            صفحه اصلی
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------- Splash: preloads EVERY image with real progress ----------
 * v6 SMOOTH BAR (user: «صفحات لودینگ قشنگ اون نوار ها روان پر بشن یهو
 * پرش نکنن») — the fill is driven by a per-frame lerp toward the real
 * target and painted with a DIRECT transform write (compositor-only,
 * zero React re-renders). Image completion bursts can no longer make
 * the bar jump — it always glides. ------------------------------- */
export function Splash({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  const fillRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(0);
  const shownRef = useRef(0);
  useEffect(() => { doneRef.current = onDone; }); /* keep latest — never during render */

  useEffect(() => {
    let finished = false;
    const t0 = Date.now();
    const finish = () => {
      if (finished) return;
      finished = true;
      doneRef.current();
    };
    /* splash covers only the CRITICAL set (small, fast) — min
     * 1.2s branding, max 6s safety. Chapter realms load in the
     * background after boot (startDeferredPreload in GameApp). */
    preloadAssets((p) => {
      targetRef.current = Math.max(targetRef.current, p);
      const minTime = 1200;
      const elapsed = Date.now() - t0;
      if (p >= 1 && elapsed >= minTime) finish();
      else if (p >= 1) setTimeout(finish, minTime - elapsed);
    }).then(() => {
      targetRef.current = 1;
      const elapsed = Date.now() - t0;
      if (elapsed < 1200) setTimeout(finish, 1200 - elapsed);
      else finish();
    });
    const cap = setTimeout(finish, 6000);
    /* decode the menu theme during the splash so the home screen
     * starts its music instantly (fetchTrack caches the AudioBuffer) */
    Audio.preloadTrack("menu2");

    /* the smooth-bar animator — lerp toward the target each frame,
     * paint via direct transform (compositor thread, no layout) */
    let raf = 0;
    const tick = () => {
      const t = targetRef.current;
      const s = shownRef.current;
      if (t > s && fillRef.current) {
        /* step = big-gap catch-up + small floor → continuous glide */
        const next = Math.min(t, s + Math.max(0.006, (t - s) * 0.085));
        shownRef.current = next;
        fillRef.current.style.transform = `scaleX(${Math.max(0.08, next)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cap);
    };
  }, []);

  return (
    <div className="vz-page" style={{ background: "linear-gradient(180deg,#8fd0ff 0%,#5cb2ef 55%,#3d9df0 100%)", alignItems: "center", justifyContent: "center" }}>
      <Vines />

      <img src="/assets/char/seat.webp" alt="عمو دانا" className="pop-in" style={{ height: "min(34vh, 240px)", objectFit: "contain", filter: "drop-shadow(0 16px 22px rgba(10,30,60,.35))" }} />
      <h1 className="title3d pop-in" data-t="واژه‌سفر" style={{ fontSize: "clamp(44px, 14vw, 64px)", marginTop: 6, animationDelay: ".15s" }}>
        واژه‌سفر
      </h1>
      <div
        className="rise-in"
        style={{ marginTop: 14, width: 170, height: 12, borderRadius: 999, background: "rgba(255,255,255,.4)", overflow: "hidden", border: "2px solid rgba(255,255,255,.7)", animationDelay: ".3s", padding: 2 }}
        aria-hidden
      >
        {/* fill = compositor scaleX, driven by the rAF lerp above */}
        <div ref={fillRef} style={{ width: "100%", height: "100%", borderRadius: 999, background: "linear-gradient(180deg,#ffe08a,#f79c0d)", transform: "scaleX(0.08)", transformOrigin: "100% 50%", willChange: "transform" }} />
      </div>
      <span style={{ position: "absolute", bottom: 24, color: "rgba(255,255,255,.9)", fontWeight: 700, fontSize: 13, textShadow: "0 2px 4px rgba(0,0,0,.3)" }}>
        برای شروع آماده می‌شویم…
      </span>
    </div>
  );
}
