"use client";
/* ------------------------------------------------------------------
 * WinModal — «عالیه!» celebration. Pure CSS animations (no canvas,
 * no backdrop blur) => zero jank. Guide character INLINE in flow:
 * never overlaps the buttons, never leaves the panel frame.
 * ------------------------------------------------------------------ */
import { useMemo } from "react";
import { Btn } from "@/components/game/ui/kit";
import { StarGold, Coin } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";

const CONF_COLORS = ["#ff6b81", "#ffd76e", "#7ce97f", "#7cc9ff", "#e6a1ff", "#ffab6e"];

export function WinModal({
  stars, coins, words, bonus, isLast, replay, onContinue, onShop,
}: {
  stars: number;
  coins: number;
  words: number;
  bonus: number;
  isLast: boolean;
  replay?: boolean; /* v1.21 — level already completed once → nothing pays out */
  onContinue: () => void;
  onShop: () => void;
}) {
  const head = stars === 3 ? "عالیه!" : stars === 2 ? "آفرین!" : "خوب بود!";
  const conf = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        bg: CONF_COLORS[i % CONF_COLORS.length],
        dur: `${2 + ((i * 13) % 14) / 10}s`,
        delay: `${((i * 7) % 12) / 10}s`,
        w: 7 + (i % 4) * 2,
      })),
    [],
  );

  return (
    <div
      className="fade-in"
      style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(10,30,60,.5)", overflow: "hidden" }}
      role="dialog"
      aria-modal="true"
      aria-label="مرحله کامل شد"
    >
      <div className="panel pop-in" style={{ width: "min(100%, 360px)", position: "relative", overflow: "hidden", paddingBottom: 18, maxHeight: "94%", display: "flex", flexDirection: "column" }}>
        {/* confetti */}
        <div className="confetti" aria-hidden>
          {conf.map((c, i) => (
            <i key={i} style={{ left: c.left, background: c.bg, width: c.w, height: c.w * 1.6, animationDuration: c.dur, animationDelay: c.delay }} />
          ))}
        </div>

        <div style={{ position: "relative", textAlign: "center", paddingTop: 14, overflowY: "auto" }}>
          {/* stars — v1.22: three FIXED slots that light from the MIDDLE
              outward (user: «وقتی یک یا دو ستاره‌ست ناتقارنی داره»):
              ۱★ = the big elevated center star only, ۲★ = center + one
              side, ۳★ = all. Elevation lives on the slot (static), the
              pop lives on the inner span — they can never cancel each
              other again. Lit = golden glow + ping ring; dim = engraved. */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 14, marginBottom: 4, minHeight: 62 }}>
            {[0, 1, 2].map((i) => {
              const lit = stars === 3 ? true : stars === 2 ? i !== 2 : i === 1;
              const mid = i === 1;
              return (
                <span key={i} className={`star-slot ${mid ? "mid" : ""} ${lit ? "lit" : "dim"}`}>
                  <span
                    className={lit ? "star-pop" : "fade-in"}
                    style={{ animationDelay: `${0.12 + i * 0.16}s`, display: "inline-flex" }}
                  >
                    <StarGold size={mid ? 58 : 46} className={lit ? "" : "star-ic off"} />
                  </span>
                  {lit && <span className="ping" style={{ animationDelay: `${0.34 + i * 0.16}s` }} />}
                </span>
              );
            })}
          </div>

          <h2 className="title3d" data-t={head} style={{ fontSize: 40, margin: "2px 0 0", lineHeight: 1.2 }}>
            {head}
          </h2>
          <div style={{ color: "#8a6a3a", fontWeight: 700, marginTop: 2 }}>
            {isLast ? "کل فصل را کامل کردی!" : "مرحله کامل شد"}
          </div>

          {/* grandpa — INLINE in flow: bounded height, never overlaps, never clips */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <img
              src="/assets/char/thumb.webp"
              alt="عمو دانا به تو افتخار می‌کند"
              className="float-slow"
              style={{
                height: 100, maxWidth: "52%",
                objectFit: "contain",
                filter: "drop-shadow(0 8px 12px rgba(0,0,0,.28))",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* coin reward — v1.21: replays pay nothing (user: «فقط یکبار
           * سکه بگیره») → a gentle note instead of the +coins chip */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4, minHeight: 34, alignItems: "center" }}>
            {replay ? (
              <span className="chip" style={{ fontSize: 12.5, color: "#8a6a3a" }}>
                این مرحله قبلاً کامل شده — سکه فقط یک‌بار تعلق می‌گیرد
              </span>
            ) : (
              <span className="chip" style={{ fontSize: 16 }}>
                <Coin size={20} />
                ‎+{faNum(coins)}
              </span>
            )}
          </div>

          {/* stats mini row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8, color: "#7a5a2e", fontWeight: 700, fontSize: 13 }}>
            <span className="chip" style={{ fontSize: 12.5 }}>واژه‌ها: {faNum(words)}</span>
            {bonus > 0 && <span className="chip" style={{ fontSize: 12.5 }}>پنهان: {faNum(bonus)}</span>}
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", paddingBottom: 2 }}>
            <Btn size="big" onClick={() => { Audio.sfxClick(); onContinue(); }} style={{ minWidth: 210 }}>
              ادامه
            </Btn>
            <button
              type="button"
              onClick={() => { Audio.sfxClick(); onShop(); }}
              style={{ background: "none", border: "none", color: "#a0690a", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
            >
              فروشگاه سکه
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
