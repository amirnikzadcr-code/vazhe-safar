"use client";
/* ------------------------------------------------------------------
 * DoneScreen — v1.19 CHAPTER CELEBRATION (user session T):
 * «وقتی هر فصلی رو تموم کرد اتوماتیک یه جشن گرفته بشه براش با تشویق
 *  و متن‌های انیمیشینی، و قفل کلید فصل بعد روی صفحه انیمیشنی باز شه
 *  و بنویسه براش بریم فصل بعد»
 *
 *  • the chapter's OWN painted backdrop (compatible with the realm)
 *  • confetti storm + synthesized crowd APPLAUSE (Audio.sfxCheer)
 *  • animated texts: title pop → chapter chip → poem line → stats
 *  • the next chapter's padlock WIGGLES, then POPS OPEN with a golden
 *    glow + «فصل بعد باز شد!» → big bouncing «بریم فصل بعد» button
 *  • chapter chest (150 coins) kept — one juicy final reward
 * All animations are one-shot CSS (transform/opacity only) — zero
 * canvas, zero layout thrash, safe on weak phones.
 * ------------------------------------------------------------------ */
import { useEffect } from "react";
import { Sheet, Btn } from "@/components/game/ui/kit";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { CHAPTERS } from "@/game/data/chapters";
import { lvPerCh, globalLevel } from "@/game/data/levelsIndex";
import { useSave } from "@/components/game/useSave";
import { StarGold } from "@/components/game/icons";

const CONF_COLORS = ["#ff6b81", "#ffd76e", "#7ce97f", "#7cc9ff", "#e6a1ff", "#ffab6e"];

export function DoneScreen({
  ch, onNext,
}: {
  ch: number;
  onNext: () => void;
}) {
  /* full save subscription: claiming the chest must flip this panel to
     «گرفتی ✓» instantly; the coin chip refreshes with the same tick */
  const coins = useSave().data.coins;
  const theme = CHAPTERS[ch - 1];
  const canChest = !Save.hasChest(ch);
  const hasNext = ch < CHAPTERS.length;

  /* chapter stats */
  const n = lvPerCh(ch);
  let stars = 0, words = 0;
  for (let l = 1; l <= n; l++) {
    const rec = Save.data.levels[`${ch}:${l}`];
    if (rec) { stars += rec.stars; words++; }
  }

  /* celebration audio: applause on entry + the unlock fanfare right
   * when the padlock pops open (CSS delay ≈ 1.9s) */
  useEffect(() => {
    Audio.sfxCheer();
    const t = window.setTimeout(() => { if (hasNext) Audio.sfxChapterUnlock(); }, 1950);
    return () => window.clearTimeout(t);
  });

  const conf = Array.from({ length: 38 }, (_, i) => ({
    left: `${(i * 29 + 7) % 100}%`,
    bg: CONF_COLORS[i % CONF_COLORS.length],
    dur: `${2.2 + ((i * 13) % 16) / 10}s`,
    delay: `${((i * 7) % 18) / 10}s`,
    w: 7 + (i % 4) * 2.5,
  }));

  return (
    <Sheet bg={theme.bg} bgDim={0.3}>
      {/* confetti storm */}
      <div className="confetti celeb-confetti" aria-hidden>
        {conf.map((c, i) => (
          <i key={i} style={{ left: c.left, background: c.bg, width: c.w, height: c.w * 1.7, animationDuration: c.dur, animationDelay: c.delay }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "flex-end", padding: 14, gap: 8, overflowY: "auto" }}>
        {/* animated title */}
        <div className="celeb-head">
          <h2 className="title3d celeb-title" data-t="جشن فصل!">جشن فصل!</h2>
          <span className="chip celeb-chip">فصل {faNum(ch)} — {theme.title} کامل شد!</span>
          <span className="celeb-stats">
            <span className="chip"><StarGold size={15} /> {faNum(stars)}/{faNum(n * 3)}</span>
            <span className="chip">مرحله‌ها: {faNum(words)}/{faNum(n)}</span>
          </span>
        </div>

        <p className="celeb-poem">«{theme.finaleText}»</p>

        {/* chest */}
        {canChest ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <img src="/assets/obj/chest.webp" alt="صندوقچه پایان فصل" className="breathe" style={{ height: 104, objectFit: "contain" }} />
            <Btn
              color="gold"
              onClick={() => {
                if (Save.claimChest(ch)) { Audio.sfxBoom(); Audio.sfxCoin(); }
              }}
            >
              صندوقچه: {faNum(150)} سکه بگیر!
            </Btn>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span className="chip">صندوقچهٔ این فصل را گرفتی ✓</span>
          </div>
        )}

        {/* ===== next-chapter LOCK-OPENING animation ===== */}
        {hasNext ? (
          <div className="unlock-zone">
            <span className="unlock-lock" aria-hidden>
              <svg width="64" height="80" viewBox="0 0 72 84">
                <defs>
                  <linearGradient id="ulg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffe08a" />
                    <stop offset=".55" stopColor="#f0b23c" />
                    <stop offset="1" stopColor="#c07f12" />
                  </linearGradient>
                </defs>
                <g className="ul-shackle">
                  <path d="M22 32 v-8 a14 14 0 0 1 28 0 v8" fill="none" stroke="#d8c08a" strokeWidth="9" strokeLinecap="round" />
                </g>
                <g className="ul-body">
                  <rect x="12" y="32" width="48" height="42" rx="11" fill="url(#ulg)" stroke="#8a5a10" strokeWidth="2.5" />
                  <circle cx="36" cy="50" r="6.5" fill="#7a5210" />
                  <rect x="33.4" y="50" width="5.2" height="13" rx="2.4" fill="#7a5210" />
                </g>
              </svg>
              <span className="ul-glow" />
            </span>
            <div className="unlock-text pop-in">فصل {faNum(ch + 1)} باز شد!</div>
            <div className="unlock-sub">مرحلهٔ {faNum(globalLevel(ch + 1, 1))} منتظرته…</div>
            <Btn
              size="big"
              color="gold"
              className="unlock-go"
              onClick={() => { Audio.sfxClick(); onNext(); }}
            >
              بریم فصل بعد!
            </Btn>
          </div>
        ) : (
          <div className="unlock-zone">
            <div className="unlock-text pop-in">همهٔ فصل‌ها را کامل کردی! 👑</div>
            <div className="unlock-sub">تو یک قهرمان واژه‌ای!</div>
            <Btn size="big" color="gold" className="unlock-go" onClick={() => { Audio.sfxClick(); onNext(); }}>
              بازگشت به خانه
            </Btn>
          </div>
        )}

        <div style={{ height: "calc(2px + env(safe-area-inset-bottom))" }} />
      </div>

      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 30 }}>
        <span className="chip" style={{ fontSize: 14 }}>
          <span className="coin-ic" style={{ width: 18, height: 18 }} />
          {faNum(coins)}
        </span>
      </div>
    </Sheet>
  );
}
