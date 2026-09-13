"use client";
/* ------------------------------------------------------------------
 * WelcomeScreen + Splash
 * ------------------------------------------------------------------ */
import { useEffect } from "react";
import { Btn, Vines } from "@/components/game/ui/kit";
import { Audio } from "@/game/core/audio";

/* ---------- Welcome back ---------- */
export function WelcomeScreen({
  onContinue, onHome,
}: {
  onContinue: () => void;
  onHome: () => void;
}) {
  return (
    <div className="vz-page fade-in">
      
      <img src="/assets/bg/home2.webp" alt="" className="vz-fill" style={{ filter: "blur(3px) brightness(.92)" }} />
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

/* ---------- Splash ---------- */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="vz-page" style={{ background: "linear-gradient(180deg,#8fd0ff 0%,#5cb2ef 55%,#3d9df0 100%)", alignItems: "center", justifyContent: "center" }}>
      <Vines />
      
      <img src="/assets/char/seat.webp" alt="" className="pop-in" style={{ height: "min(34vh, 240px)", objectFit: "contain", filter: "drop-shadow(0 16px 22px rgba(10,30,60,.35))" }} />
      <h1 className="title3d pop-in" data-t="واژه‌سفر" style={{ fontSize: "clamp(44px, 14vw, 64px)", marginTop: 6, animationDelay: ".15s" }}>
        واژه‌سفر
      </h1>
      <div
        className="rise-in"
        style={{ marginTop: 14, width: 150, height: 10, borderRadius: 999, background: "rgba(255,255,255,.4)", overflow: "hidden", animationDelay: ".3s" }}
        aria-hidden
      >
        <div style={{ width: "40%", height: "100%", borderRadius: 999, background: "#fff", animation: "shimmer 1.1s ease-in-out infinite alternate" }} />
      </div>
      <style>{`@keyframes shimmer { from { transform: translateX(-60%);} to { transform: translateX(190%);} }`}</style>
      <span style={{ position: "absolute", bottom: 24, color: "rgba(255,255,255,.9)", fontWeight: 700, fontSize: 13, textShadow: "0 2px 4px rgba(0,0,0,.3)" }}>
        برای شروع آماده می‌شویم…
      </span>
    </div>
  );
}
