"use client";
/* ------------------------------------------------------------------
 * WinModal — «عالیه!» celebration. Pure CSS animations (no canvas,
 * no backdrop blur) => zero jank. Everything bounded inside panel.
 * ------------------------------------------------------------------ */
import { useMemo } from "react";
import { Btn } from "@/components/game/ui/kit";
import { StarGold, Coin } from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";

const CONF_COLORS = ["#ff6b81", "#ffd76e", "#7ce97f", "#7cc9ff", "#e6a1ff", "#ffab6e"];

export function WinModal({
  stars, coins, words, bonus, isLast, onContinue, onShop,
}: {
  stars: number;
  coins: number;
  words: number;
  bonus: number;
  isLast: boolean;
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
      <div className="panel pop-in" style={{ width: "min(100%, 360px)", position: "relative", overflow: "hidden", paddingBottom: 18 }}>
        {/* confetti */}
        <div className="confetti" aria-hidden>
          {conf.map((c, i) => (
            <i key={i} style={{ left: c.left, background: c.bg, width: c.w, height: c.w * 1.6, animationDuration: c.dur, animationDelay: c.delay }} />
          ))}
        </div>

        <div style={{ position: "relative", textAlign: "center", paddingTop: 18 }}>
          {/* stars */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 6, minHeight: 56 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={i < stars ? "star-pop" : "fade-in"}
                style={{ animationDelay: `${0.15 + i * 0.22}s`, display: "inline-flex", transform: i === 1 ? "translateY(-8px)" : undefined }}
              >
                <StarGold size={i === 1 ? 58 : 46} className={i < stars ? "" : "star-ic off"} />
              </span>
            ))}
          </div>

          <h2 className="title3d" data-t={head} style={{ fontSize: 42, margin: "2px 0 0", lineHeight: 1.2 }}>
            {head}
          </h2>
          <div style={{ color: "#8a6a3a", fontWeight: 700, marginTop: 2 }}>
            {isLast ? "کل فصل را کامل کردی!" : "مرحله کامل شد"}
          </div>

          {/* coin reward */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <span className="chip" style={{ fontSize: 16 }}>
              <Coin size={20} />
              ‎+{faNum(coins)}
            </span>
          </div>

          {/* stats mini row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10, color: "#7a5a2e", fontWeight: 700, fontSize: 13 }}>
            <span className="chip" style={{ fontSize: 12.5 }}>واژه‌ها: {faNum(words)}</span>
            {bonus > 0 && <span className="chip" style={{ fontSize: 12.5 }}>پنهان: {faNum(bonus)}</span>}
          </div>

          {/* grandpa — bounded */}
          
          <img
            src="/assets/char/thumb.webp"
            alt="عمو دانا به تو افتخار می‌کند"
            className="float-slow"
            style={{
              position: "absolute",
              bottom: 64,
              left: -6,
              height: 118,
              maxWidth: "44%",
              objectFit: "contain",
              filter: "drop-shadow(0 8px 12px rgba(0,0,0,.28))",
              pointerEvents: "none",
            }}
          />

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
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
