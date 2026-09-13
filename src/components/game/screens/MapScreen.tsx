"use client";
/* ------------------------------------------------------------------
 * MapScreen — storybook village; winding SVG path; level nodes
 * (done = cream + stars, current = pulsing green, locked = gray)
 * ------------------------------------------------------------------ */
import { useMemo } from "react";
import { Sheet, TopBar } from "@/components/game/ui/kit";
import { StarGold, Lock } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { CHAPTERS } from "@/game/data/chapters";

/* waypoints in % of the map canvas (x%, y%) — bottom → top */
const WP: [number, number][] = [
  [52, 93], [30, 83.5], [68, 74], [32, 64.5], [66, 55],
  [30, 45.5], [65, 36], [33, 26.5], [64, 17], [48, 7.5],
];

function pathD(pts: [number, number][]): string {
  // smooth cubic through midpoints (catmull-ish)
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const my = (y0 + y1) / 2;
    d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
  }
  return d;
}

export function MapScreen({
  ch, coins, onBack, onPlay, onShop,
}: {
  ch: number;
  coins: number;
  onBack: () => void;
  onPlay: (lv: number) => void;
  onShop: () => void;
}) {
  const theme = CHAPTERS[ch - 1];
  const d = useMemo(() => pathD(WP), []);

  const highest = useMemo(() => {
    let h = 0;
    for (let lv = 1; lv <= 10; lv++) if (Save.data.levels[`${ch}:${lv}`]) h = lv;
    return h;
  }, [ch, coins]);

  const lines = [
    "هر واژه، یک قدمه تو پیشرفت!",
    "چای رو هم بزن، کلمه‌ها رو هم!",
    "با هر کلمه، روستا قشنگ‌تر می‌شه!",
    "من هستم و گربه‌ام؛ تو هم که بهترینی!",
  ];
  const line = lines[(ch - 1) % lines.length];

  return (
    <Sheet bg={theme.bg} bgDim={0.14}>
      <TopBar coins={coins} onBack={onBack} onShop={onShop} title={`${theme.title}`} />

      <div className="map-scroll">
        <div className="map-inner" style={{ height: 780 }}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            aria-hidden
          >
            <path d={d} fill="none" stroke="rgba(52,132,64,.8)" strokeWidth={27} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.85} />
            <path d={d} fill="none" stroke="#8fd07a" strokeWidth={23} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke="#f2e2bd" strokeWidth={16} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke="#fff7e2" strokeWidth={4.5} strokeDasharray="10 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {WP.map(([x, y], i) => {
            const lv = i + 1;
            const rec = Save.data.levels[`${ch}:${lv}`];
            const unlocked = Save.levelUnlocked(ch, lv);
            const isCur = unlocked && !rec && lv === highest + 1;
            return (
              <div key={lv} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}>
                <button
                  type="button"
                  disabled={!unlocked}
                  className={`map-node ${!unlocked ? "locked" : ""} ${isCur ? "cur" : ""}`}
                  aria-label={`مرحله ${faNum(lv)}${unlocked ? "" : " — قفل"}`}
                  onClick={() => unlocked && onPlay(lv)}
                >
                  {!unlocked ? <Lock size={22} /> : faNum(lv)}
                </button>
                {rec && rec.stars > 0 && (
                  <span className="node-stars" style={{ bottom: -15, left: "50%", width: 74, transform: "translateX(-50%)", justifyContent: "center" }}>
                    {Array.from({ length: 3 }, (_, s) => (
                      <StarGold key={s} size={14} className={s < rec.stars ? "" : "star-ic off"} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* guide bubble */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "0 12px 12px", position: "relative", zIndex: 20 }}>
        
        <img
          src="/assets/char/thumb.webp"
          alt="عمو دانا"
          style={{ width: 64, height: 64, borderRadius: 999, objectFit: "cover", objectPosition: "50% 20%", border: "3px solid #fff", boxShadow: "0 5px 0 #cfa14f, 0 8px 14px rgba(0,0,0,.3)", flex: "none" }}
        />
        <div className="bubble">{line}</div>
      </div>
    </Sheet>
  );
}
