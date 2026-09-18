"use client";
/* ------------------------------------------------------------------
 * WelcomeScreen + Splash
 * ------------------------------------------------------------------ */
import { useEffect, useRef, useState } from "react";
import { Btn, Vines } from "@/components/game/ui/kit";
import { Audio } from "@/game/core/audio";
import { preloadAssets } from "@/game/core/preload";
import { MENU_MUSIC } from "@/game/data/chapters";

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
 * the bar jump — it always glides. -------------------------------
 * SESSION Y (user: «اون صفحه لودینگ آبی موقع ورود درست رندر نمیشه و
 * سریع میره تو بازی»):
 *  • FONT GATE — the wordmark/character never paint in a fallback
 *    font: the splash waits for the preloaded Vazirmatn weights
 *    (bounded 2s so a stuck font never blocks boot);
 *  • BRANDING HOLD — minimum 800ms so the scene is SEEN without
 *    wasting the user's time (HH: «لودینگ اولیه کند است» — the old
 *    1.7s hold made boot feel sluggish on top of asset decoding);
 *  • SMOOTH EXIT — the splash fades+scales out over ~330ms BEFORE the
 *    home screen mounts (no more instant jump «سریع میره تو بازی»);
 *  • HH — CLOUDS-OPEN ENTRANCE + floating letters: the sky visibly
 *    blooms open on mount (staggered cloud pop) and luminous Persian
 *    letters drift up through it — pure transform/opacity compositor
 *    motion, frozen on the lowfx tier. */
export function Splash({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  const fillRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(0);
  const shownRef = useRef(0);
  const [out, setOut] = useState(false);
  useEffect(() => { doneRef.current = onDone; }); /* keep latest — never during render */

  useEffect(() => {
    let finished = false;
    let assetsDone = false;
    let fontsDone = false;
    const t0 = Date.now();
    const MIN = 800; /* HH — branding hold, halved: scene is seen, boot stays snappy */

    const finish = () => {
      targetRef.current = 1;
      if (fillRef.current) fillRef.current.style.transform = "scaleX(1)";
      setOut(true); /* 330ms fade+scale curtain, THEN the game mounts */
      setTimeout(() => { doneRef.current(); }, 340);
    };
    const maybeFinish = () => {
      if (finished || !assetsDone || !fontsDone) return;
      finished = true;
      const wait = Math.max(0, MIN - (Date.now() - t0));
      setTimeout(finish, wait);
    };

    /* splash covers only the CRITICAL set (small, fast) — max 6.5s
     * safety. Chapter realms load in the background after boot. */
    preloadAssets((p) => {
      targetRef.current = Math.max(targetRef.current, p);
    }).then(() => {
      targetRef.current = 1;
      assetsDone = true;
      maybeFinish();
    });

    /* Y — FONT GATE (bounded): fonts are <link preload>ed in layout.tsx,
     * so this resolves in ms; the 2s cap is a pure safety net. */
    const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
    if (fonts?.load) {
      Promise.all([
        fonts.load('800 40px Vazirmatn'),
        fonts.load('700 16px Vazirmatn'),
        fonts.load('500 16px Vazirmatn'),
      ])
        .catch(() => { /* font set unavailable → never block boot */ })
        .then(() => { fontsDone = true; maybeFinish(); });
      setTimeout(() => { fontsDone = true; maybeFinish(); }, 2000);
    } else {
      fontsDone = true;
    }
    const cap = setTimeout(() => { assetsDone = true; fontsDone = true; maybeFinish(); }, 6500);

    /* decode the menu theme during the splash so the home screen
     * starts its music instantly (fetchTrack caches the AudioBuffer) */
    if (MENU_MUSIC.track) Audio.preloadTrack(MENU_MUSIC.track);

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
    <div
      className={`vz-page splash-sky ${out ? "splash-out" : ""}`}
      style={{ alignItems: "center", justifyContent: "center" }}
    >
      {/* v8 CLOUD LOADING SCENE (user: «صفحه لودینگ رو حالت ابر بکن که
       * باز میشه ابر خیلی روان و خوشگل، اون صفحه لودینگ آبی حذف کن») —
       * a soft storybook sky: sun glow + 6 drifting cloud layers + عمو
       * دانا riding his own cloud. Every motion is transform-only on
       * its own compositor layer (60fps even on weak phones), and the
       * flat blue page is gone. */}
      <div className="sky-sun" aria-hidden />
      <div className="sky-clouds" aria-hidden>
        <i className="clw c1"><b className="cl" /></i>
        <i className="clw c2"><b className="cl" /></i>
        <i className="clw c3"><b className="cl" /></i>
        <i className="clw c4"><b className="cl" /></i>
        <i className="clw c5"><b className="cl" /></i>
        <i className="clw c6"><b className="cl" /></i>
      </div>

      {/* HH — floating Persian letters drifting up through the sky
           (transform/opacity only, lowfx-hidden) */}
      <div className="sky-letters" aria-hidden>
        {["ا", "ب", "پ", "ت", "س", "ک", "گ"].map((ch, i) => (
          <b
            key={i}
            style={{
              ["--x" as string]: `${9 + i * 12.5}%`,
              ["--d" as string]: `${9.5 + (i % 3) * 2.2}s`,
              ["--dl" as string]: `${i * 0.9}s`,
              ["--sz" as string]: `${15 + (i % 3) * 7}px`,
              ["--o" as string]: `${0.42 - (i % 3) * 0.07}`,
            }}
          >
            {ch}
          </b>
        ))}
      </div>

      <div className="sky-hero">
        <img src="/assets/char/seat.webp" alt="عمو دانا" className="pop-in" />
        <div className="sky-hero-cloud" />
      </div>

      <h1 className="title3d pop-in" data-t="واژه‌سفر" style={{ fontSize: "clamp(44px, 14vw, 64px)", marginTop: 10, animationDelay: ".15s" }}>
        واژه‌سفر
      </h1>

      <div
        className="sky-bar rise-in"
        style={{ animationDelay: ".3s" }}
        aria-hidden
      >
        {/* fill = compositor scaleX, driven by the rAF lerp above */}
        <div ref={fillRef} className="sky-bar-fill" />
      </div>
      <span className="sky-cap">
        برای شروع آماده می‌شویم…
      </span>
    </div>
  );
}
