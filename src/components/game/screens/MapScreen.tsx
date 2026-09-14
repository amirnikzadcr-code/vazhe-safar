"use client";
/* ------------------------------------------------------------------
 * MapScreen — joyful storybook village map
 *  • AUTO-SCROLLS to the current level on entry (level 1 at the
 *    bottom is immediately visible — no "starts at top" confusion)
 *  • static vines + instant-rendered background → zero jitter
 *  • colorful animated scenery (flowers, bushes, butterflies,
 *    clouds, bunting) on top of the happy meadow background
 *  • winding SVG path; done = cream + stars, current = pulsing
 *    green, locked = gray
 * ------------------------------------------------------------------ */
import { useEffect, useMemo, useRef } from "react";
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

/* ================= colorful animated scenery ================= */
const FLOWER_COLORS = ["#ff5d73", "#ffb302", "#ff8fb0", "#9a6bf4", "#ff7a1a", "#f43f77", "#ffd94e"];

function Flower({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* inner g carries the CSS sway (never on the positioned element —
        CSS transform would override the attribute transform) */}
      <g className="map-flower">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="0" cy="-2.6" rx="1.7" ry="2.6" fill={c} transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="1.35" fill="#fff6d8" />
      </g>
    </g>
  );
}

function Butterfly({ x, y, delay, hue }: { x: number; y: number; delay: number; hue: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="map-butterfly" style={{ animationDelay: `${delay}s` }}>
        <g className="bf-wing-l"><ellipse cx="-2.1" cy="-0.6" rx="2.1" ry="1.45" fill={hue} transform="rotate(-24)" /></g>
        <g className="bf-wing-r"><ellipse cx="2.1" cy="-0.6" rx="2.1" ry="1.45" fill={hue} transform="rotate(24)" /></g>
        <ellipse cx="0" cy="0" rx="0.55" ry="1.7" fill="#5d3a12" />
      </g>
    </g>
  );
}

function Scenery() {
  /* viewBox 0 0 100 100 — flowers/bushes near the left+right margins,
   * clear of the level nodes (path swings x 30–68) */
  const flowers: [number, number, number, number][] = [
    [11, 91, 0.62, 0], [88, 90, 0.58, 3], [15, 81, 0.5, 5], [86, 79, 0.66, 1],
    [10, 69, 0.58, 2], [89, 66, 0.5, 4], [13, 57, 0.66, 3], [87, 53, 0.6, 0],
    [11, 45, 0.52, 1], [88, 43, 0.63, 5], [14, 33, 0.6, 4], [86, 31, 0.52, 2],
    [12, 22, 0.55, 0], [87, 20, 0.6, 3], [18, 12, 0.5, 5], [80, 11, 0.55, 1],
  ];
  const petals: [number, number, string, number][] = [
    [20, 95, "#ff8fb0", 0.55], [78, 96, "#ffd94e", 0.5], [24, 87, "#ffb302", 0.45],
    [74, 85, "#ff5d73", 0.5], [17, 74, "#9a6bf4", 0.45], [82, 71, "#ff8fb0", 0.48],
    [21, 62, "#ffd94e", 0.5], [79, 59, "#ff7a1a", 0.45], [18, 50, "#ff5d73", 0.48],
    [83, 47, "#ffb302", 0.5], [22, 38, "#ff8fb0", 0.45], [80, 36, "#9a6bf4", 0.48],
    [19, 27, "#ffd94e", 0.5], [84, 25, "#ff5d73", 0.45], [25, 17, "#ffb302", 0.45],
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
      aria-hidden
    >
      {/* drifting clouds (top sky) */}
      <g className="map-cloud" style={{ animationDuration: "95s" }} fill="#ffffff" opacity="0.85">
        <ellipse cx="16" cy="4.6" rx="7" ry="2.1" />
        <ellipse cx="20" cy="3.6" rx="4.6" ry="1.8" />
      </g>
      <g className="map-cloud cloud-alt" style={{ animationDuration: "130s" }} fill="#ffffff" opacity="0.7">
        <ellipse cx="84" cy="6.4" rx="5.6" ry="1.7" />
        <ellipse cx="87" cy="5.6" rx="3.6" ry="1.4" />
      </g>

      {/* festive bunting across the top */}
      <g className="map-bunting">
        <path d="M6 3 Q 50 8.4 94 3" fill="none" stroke="#a05a2c" strokeWidth="0.55" />
        {Array.from({ length: 11 }, (_, i) => {
          const t = i / 10;
          const x = 6 + t * 88;
          const y = 3 + Math.sin(Math.PI * t) * 5.1;
          const c = FLOWER_COLORS[i % FLOWER_COLORS.length];
          return <path key={i} d={`M ${x - 2.1} ${y} L ${x + 2.1} ${y} L ${x} ${y + 3.4} Z`} fill={c} stroke="#ffffff" strokeWidth="0.28" />;
        })}
      </g>

      {/* colorful bushes along the margins */}
      {([[9, 86], [91, 84], [8, 52], [92, 50]] as [number, number][]).map(([bx, by], i) => (
        <g key={`bush${i}`} transform={`translate(${bx} ${by}) scale(0.72)`}>
          <circle cx="-1.9" cy="0.4" r="2.5" fill="#2f8f4e" />
          <circle cx="1.9" cy="0.4" r="2.5" fill="#3fae5c" />
          <circle cx="0" cy="-1.2" r="2.6" fill="#43b962" />
          <circle cx="-0.8" cy="-1.9" r="0.7" fill="#ff8fb0" />
          <circle cx="1.6" cy="0" r="0.6" fill="#ffd94e" />
        </g>
      ))}

      {/* petals scattered on the grass */}
      {petals.map(([px, py, pc, pr], i) => (
        <circle key={`pt${i}`} cx={px} cy={py} r={pr} fill={pc} opacity="0.75" />
      ))}

      {/* happy flowers (gentle sway) */}
      {flowers.map(([fx, fy, fs, ci], i) => (
        <Flower key={`fl${i}`} x={fx} y={fy} s={fs} c={FLOWER_COLORS[ci]} />
      ))}

      {/* butterflies */}
      <Butterfly x={22} y={59} delay={0} hue="#ff8fb0" />
      <Butterfly x={76} y={41} delay={1.3} hue="#9a6bf4" />
      <Butterfly x={40} y={78} delay={2.1} hue="#ffb302" />
    </svg>
  );
}

/* ================= screen ================= */
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
  /* the level map ALWAYS uses the open flower-meadow ground — joyful,
   * colorful and calm enough for the level nodes to read clearly
   * (chapter scenery stays on the play screen) */
  const MAP_BG = "/assets/bg/map2.webp";
  const d = useMemo(() => pathD(WP), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);

  const highest = useMemo(() => {
    let h = 0;
    for (let lv = 1; lv <= 10; lv++) if (Save.data.levels[`${ch}:${lv}`]) h = lv;
    return h;
  }, [ch, coins]);

  /* center the CURRENT level in view immediately (no smooth scroll,
   * no animation → the page opens steady on the player's level) */
  useEffect(() => {
    const sc = scrollRef.current;
    const el = curRef.current;
    if (!sc) return;
    if (el) {
      const top = el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2;
      sc.scrollTop = Math.max(0, Math.min(sc.scrollHeight, top));
    } else if (highest >= 10) {
      sc.scrollTop = 0; /* chapter complete → show the top */
    }
  }, [ch]);

  const lines = [
    "هر واژه، یک قدمه تو پیشرفت!",
    "چای رو هم بزن، کلمه‌ها رو هم!",
    "با هر کلمه، روستا قشنگ‌تر می‌شه!",
    "من هستم و گربه‌ام؛ تو هم که بهترینی!",
  ];
  const line = lines[(ch - 1) % lines.length];

  return (
    <Sheet bg={MAP_BG} bgDim={0.08}>
      <TopBar coins={coins} onBack={onBack} onShop={onShop} title={`${theme.title}`} />

      <div className="map-scroll" ref={scrollRef}>
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

          <Scenery />

          {WP.map(([x, y], i) => {
            const lv = i + 1;
            const rec = Save.data.levels[`${ch}:${lv}`];
            const unlocked = Save.levelUnlocked(ch, lv);
            const isCur = unlocked && !rec && lv === highest + 1;
            return (
              <div
                key={lv}
                ref={isCur ? curRef : undefined}
                style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}
              >
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
                      <StarGold key={s} size={14} className={s < rec.stars ? "star-twinkle" : "star-ic off"} />
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
