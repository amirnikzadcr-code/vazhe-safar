"use client";
/* ------------------------------------------------------------------
 * MapScreen v2.1 — «سفرِ واژه‌ها» storybook WORLD MAP
 *  • ALL 100 levels in ONE continuous scroll — chapter 1 at the
 *    bottom, chapter 10 at the summit; as you climb, realms change
 *  • every chapter = a themed REALM: own sky→land palette, ornamental
 *    gate border (the «مرز» between chapters), storybook banner with
 *    progress, themed SVG scenery, winding path, 10 level nodes
 *  • auto-scrolls to the CURRENT level on entry (instant, no jitter)
 *  • perf: content-visibility skips offscreen realms; scenery is
 *    static SVG + a handful of transform/opacity-only animations
 * ------------------------------------------------------------------ */
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Sheet, TopBar } from "@/components/game/ui/kit";
import { StarGold, LockChunky } from "@/components/game/icons";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { CHAPTERS, ChapterTheme } from "@/game/data/chapters";

/* waypoints in % of each realm canvas (x%, y%) — bottom → top */
const WP: [number, number][] = [
  [52, 95], [31, 87.5], [68, 80], [31, 72.5], [67, 65],
  [30, 57.5], [66, 50], [32, 42.5], [65, 35], [48, 27.5],
];

/* the player's CURRENT level: first unlocked-not-done spot on the journey */
function currentLevel(): { c: number; l: number } | null {
  for (let c = 1; c <= 10; c++) {
    if (!Save.chapterUnlocked(c)) continue;
    for (let l = 1; l <= 10; l++) {
      if (Save.levelUnlocked(c, l) && !Save.data.levels[`${c}:${l}`]) return { c, l };
    }
  }
  return null;
}

function pathD(pts: [number, number][]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const my = (y0 + y1) / 2;
    d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
  }
  return d;
}

/* ============ tiny scenery building blocks (pure SVG) ============ */
function Sun({ x, y, r, c = "#ffd94e" }: { x: number; y: number; r: number; c?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.7} fill={c} opacity=".22" />
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x} cy={y} r={r * 0.72} fill="#fff3b8" opacity=".8" />
    </g>
  );
}
function Cloud({ x, y, s = 1, o = 0.9 }: { x: number; y: number; s?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff" opacity={o}>
      <ellipse cx="0" cy="0" rx="7.5" ry="2.3" />
      <ellipse cx="-2.6" cy="-1.4" rx="4" ry="1.9" />
      <ellipse cx="3" cy="-1.1" rx="3.4" ry="1.7" />
    </g>
  );
}
function Tw({ x, y, s, d }: { x: number; y: number; s: number; d?: string }) {
  return (
    <path
      className={`twinkle ${d ?? ""}`}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -1.5 L0.5 -0.5 1.5 0 0.5 0.5 0 1.5 -0.5 0.5 -1.5 0 -0.5 -0.5 Z"
      fill="#fff6cf"
    />
  );
}
function BlossomTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-1.1" y="-6" width="2.2" height="9" rx="1" fill="#8a5a2e" />
      <circle cx="0" cy="-8.5" r="4.6" fill="#ff8fb0" />
      <circle cx="-3.2" cy="-6.6" r="3.1" fill="#ffb1c9" />
      <circle cx="3.3" cy="-6.8" r="3.2" fill="#ff9dbd" />
      <circle cx="0.6" cy="-10.6" r="2.6" fill="#ffd3e0" />
    </g>
  );
}
function Palm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C -0.8 -3.5 -0.4 -7 0.6 -10" stroke="#8a5a2e" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <g fill="#3fae5c">
        <ellipse cx="-2.8" cy="-10.6" rx="3.1" ry="1.15" transform="rotate(-28 -2.8 -10.6)" />
        <ellipse cx="2.9" cy="-10.4" rx="3.1" ry="1.15" transform="rotate(26 2.9 -10.4)" />
        <ellipse cx="-1.7" cy="-12.1" rx="2.7" ry="1" transform="rotate(-58 -1.7 -12.1)" />
        <ellipse cx="1.8" cy="-12" rx="2.7" ry="1" transform="rotate(55 1.8 -12)" />
        <ellipse cx="0" cy="-12.8" rx="2.5" ry="1" />
      </g>
      <circle cx="-0.4" cy="-9.8" r="0.6" fill="#c9820a" />
      <circle cx="0.8" cy="-9.6" r="0.6" fill="#c9820a" />
    </g>
  );
}
function Lantern({ x, y, s = 1, cls = "" }: { x: number; y: number; s?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="0" y1="0" x2="0" y2={2.4 * s} stroke="#7c4a00" strokeWidth="0.4" />
      <g className={`lantern ${cls}`} transform={`translate(0 ${2.4 * s}) scale(${s})`}>
        <path d="M-2.4 0 L2.4 0 L1.9 1 L2.5 3.4 L-2.5 3.4 L-1.9 1 Z" fill="#f43f5f" stroke="#a31f1f" strokeWidth="0.35" />
        <ellipse cx="0" cy="1.9" rx="1.5" ry="1" fill="#ffd94e" opacity=".9" />
        <ellipse cx="0" cy="4.9" rx="0.9" ry="0.55" fill="#ffd94e" />
      </g>
    </g>
  );
}
function Flag({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="0" y1="0" x2="0" y2="-6.5" stroke="#5d3a12" strokeWidth="0.55" />
      <path className="flag-wave" d="M0 -6.5 L4.6 -5.6 L0 -4.4 Z" fill={c} />
    </g>
  );
}
function Gull({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      className="bf-drift"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-2 0 Q -1 -1.2 0 0 Q 1 -1.2 2 0"
      fill="none" stroke="#5d7a8e" strokeWidth="0.5" strokeLinecap="round"
    />
  );
}
function Firefly({ x, y, d }: { x: number; y: number; d?: string }) {
  return (
    <g className={`firefly ${d ?? ""}`} transform={`translate(${x} ${y})`}>
      <circle r="1.7" fill="#d4ff8f" opacity=".3" />
      <circle r="0.7" fill="#f2ffcf" />
    </g>
  );
}
function Firework({ x, y, c, cls }: { x: number; y: number; c: string; cls: string }) {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return <line key={i} x1={Math.cos(a) * 2} y1={Math.sin(a) * 2} x2={Math.cos(a) * 5.2} y2={Math.sin(a) * 5.2} stroke={c} strokeWidth="0.7" strokeLinecap="round" />;
  });
  return (
    <g className={`fw-pulse ${cls}`} transform={`translate(${x} ${y})`}>
      {rays}
      <circle r="1.4" fill={c} opacity=".9" />
      <circle r="6.4" fill="none" stroke={c} strokeWidth="0.35" opacity=".5" strokeDasharray="1 1.6" />
    </g>
  );
}

/* ============ per-realm storybook scenery ============ */
function RealmScenery({ id }: { id: number }) {
  switch (id) {
    case 1: /* باغِ نخستین — spring garden */
      return (
        <>
          <Sun x={14} y={11} r={5.4} />
          <Cloud x={72} y={9} s={1} />
          <Cloud x={40} y={16} s={0.72} o={0.75} />
          <BlossomTree x={11} y={68} s={1.25} />
          <BlossomTree x={89} y={64} s={1.15} />
          <BlossomTree x={20} y={35} s={0.9} />
          <BlossomTree x={80} y={32} s={0.85} />
          <g className="bf-drift" transform="translate(70 44)"><circle r="1" fill="#ff8fb0" /><circle cx="-1.4" cy="-0.6" r="0.7" fill="#ffb1c9" /><circle cx="1.4" cy="-0.6" r="0.7" fill="#ffb1c9" /></g>
          <g className="bf-drift" style={{ animationDelay: "1.4s" }} transform="translate(28 52)"><circle r="0.9" fill="#9a6bf4" /><circle cx="-1.3" cy="-0.5" r="0.65" fill="#c8b2f8" /><circle cx="1.3" cy="-0.5" r="0.65" fill="#c8b2f8" /></g>
        </>
      );
    case 2: /* بازارِ رنگ‌ها — bazaar skyline + lanterns */
      return (
        <>
          <Cloud x={22} y={13} s={0.9} o={0.85} />
          <Cloud x={78} y={18} s={0.7} o={0.7} />
          {/* bazaar skyline on the horizon */}
          <g fill="#c07a45">
            <path d="M6 47 L6 40 Q 11 33.5 16 40 L16 47 Z" />
            <path d="M24 47 L24 42 L26.5 39 L29 42 L29 47 Z" />
            <path d="M62 47 L62 41.5 Q 68 34.5 74 41.5 L74 47 Z" />
            <rect x="40" y="38.5" width="4.6" height="8.5" />
            <path d="M40 38.5 Q 42.3 34.8 44.6 38.5 Z" />
            <rect x="84" y="40" width="3.8" height="7" />
            <path d="M84 40 Q 85.9 36.9 87.8 40 Z" />
          </g>
          <g fill="#a5632f" opacity=".8">
            <rect x="0" y="46" width="100" height="2.2" />
          </g>
          <Lantern x={20} y={0} s={1.15} />
          <Lantern x={43} y={0} s={0.9} cls="l2" />
          <Lantern x={64} y={0} s={1.05} cls="l3" />
          <Lantern x={85} y={0} s={0.85} cls="l2" />
          <Tw x={30} y={25} s={1.1} />
          <Tw x={70} y={28} s={0.9} d="d2" />
        </>
      );
    case 3: /* کویرِ زرین — golden dunes + palms */
      return (
        <>
          <Sun x={82} y={14} r={6} c="#ffab2e" />
          <Cloud x={30} y={12} s={0.8} o={0.65} />
          {/* far dunes */}
          <path d="M0 47 Q 26 39.5 52 46 T 100 45 L100 52 L0 52 Z" fill="#f7ddad" />
          <path d="M0 52 Q 30 46.5 62 52.5 T 100 51 L100 56 L0 56 Z" fill="#f0cd90" opacity=".85" />
          <Palm x={13} y={56} s={1.25} />
          <Palm x={87} y={54} s={1.1} />
          <g transform="translate(70 62)" fill="#8a5a2e" opacity=".7">
            <ellipse cx="0" cy="0" rx="1.6" ry="0.55" />
            <ellipse cx="3.4" cy="0.5" rx="1.6" ry="0.55" />
            <ellipse cx="-3.2" cy="0.6" rx="1.4" ry="0.5" />
          </g>
        </>
      );
    case 4: /* جنگلِ مه‌آلود — misty forest + fireflies */
      return (
        <>
          <g fill="#2f6e4a">
            <rect x="7" y="18" width="2.6" height="42" rx="1" />
            <rect x="15" y="10" width="3.2" height="50" rx="1.2" />
            <rect x="85" y="14" width="3" height="46" rx="1.1" />
            <rect x="93" y="22" width="2.4" height="38" rx="1" />
          </g>
          <g fill="#3a8f5c">
            <circle cx="16.5" cy="9" r="5.2" />
            <circle cx="8.5" cy="17" r="4" />
            <circle cx="86.5" cy="12.5" r="4.6" />
            <circle cx="94" cy="21" r="3.4" />
            <circle cx="12" cy="12" r="3.2" opacity=".9" />
          </g>
          {/* drifting mist bands */}
          <ellipse cx="50" cy="34" rx="52" ry="3.2" fill="#ffffff" opacity=".34" />
          <ellipse cx="40" cy="45" rx="46" ry="2.6" fill="#ffffff" opacity=".28" />
          <ellipse cx="62" cy="56" rx="50" ry="2.8" fill="#ffffff" opacity=".22" />
          <Firefly x={26} y={40} />
          <Firefly x={62} y={36} d="d2" />
          <Firefly x={44} y={52} d="d3" />
          <Firefly x={74} y={49} d="d2" />
          <Firefly x={33} y={58} />
        </>
      );
    case 5: /* قلعهٔ کوهستانی — peaks + castle */
      return (
        <>
          <Cloud x={18} y={15} s={1} />
          <Cloud x={82} y={22} s={0.8} o={0.8} />
          {/* peaks */}
          <path d="M0 50 L18 26 L36 50 Z" fill="#8aa4bd" />
          <path d="M18 26 L24 33 L18 34 L13 31 Z" fill="#ffffff" opacity=".85" />
          <path d="M28 50 L52 20 L76 50 Z" fill="#7d99b4" />
          <path d="M52 20 L59 28.5 L52 30 L45.5 27.5 Z" fill="#ffffff" opacity=".9" />
          <path d="M64 50 L84 29 L100 50 Z" fill="#8aa4bd" />
          <path d="M84 29 L89.5 35.5 L84 37 L78.5 34.5 Z" fill="#ffffff" opacity=".8" />
          {/* the castle */}
          <g fill="#5e7a96">
            <rect x="45" y="33" width="10" height="15" />
            <rect x="41.5" y="36" width="4.5" height="12" />
            <rect x="54" y="36" width="4.5" height="12" />
            <path d="M45 33 L45 30.8 L46.5 32 L48 30.5 L49.5 32 L51 30.5 L52.5 32 L55 30.8 L55 33 Z" />
            <path d="M41.5 36 L41.5 34.2 L42.7 35.2 L44 34 L45.3 35.2 L46 34.2 L46 36 Z" />
          </g>
          <Flag x={50} y={30.6} c="#e13f3f" />
          <Gull x={30} y={34} s={1.1} />
          <Gull x={68} y={30} s={0.9} />
        </>
      );
    case 6: /* شهرِ بادگیرها — windcatcher city at dusk */
      return (
        <>
          <Sun x={50} y={20} r={5.6} c="#ffb35e" />
          <Cloud x={22} y={12} s={0.75} o={0.6} />
          <g fill="#b57a45">
            <rect x="8" y="38" width="9" height="11" />
            <rect x="10" y="33.5" width="5" height="5" />
            <g stroke="#8a5a2e" strokeWidth="0.5"><line x1="11" y1="34" x2="11" y2="38" /><line x1="12.5" y1="34" x2="12.5" y2="38" /><line x1="14" y1="34" x2="14" y2="38" /></g>
            <path d="M26 49 L26 42 Q 32 35.5 38 42 L38 49 Z" />
            <rect x="46" y="36" width="7" height="13" />
            <rect x="47.6" y="31" width="3.8" height="5.4" />
            <g stroke="#8a5a2e" strokeWidth="0.5"><line x1="48.5" y1="31.4" x2="48.5" y2="36" /><line x1="50.5" y1="31.4" x2="50.5" y2="36" /></g>
            <path d="M60 49 L60 43.5 Q 66 37.5 72 43.5 L72 49 Z" />
            <rect x="80" y="38.5" width="8" height="10.5" />
            <rect x="82" y="34.5" width="4" height="4.4" />
          </g>
          <g fill="#9c6338" opacity=".85"><rect x="0" y="48" width="100" height="2" /></g>
          <Gull x={36} y={24} s={1} />
          <Gull x={66} y={19} s={0.85} />
          <Tw x={78} y={26} s={1} d="d2" />
        </>
      );
    case 7: /* ساحلِ مروارید — pearl coast */
      return (
        <>
          <Sun x={16} y={12} r={5.2} />
          <Cloud x={70} y={10} s={0.85} />
          {/* the sea */}
          <rect x="0" y="36" width="100" height="17" fill="#37c3d4" opacity=".68" />
          <path className="wave-drift" d="M0 39 Q 8 37.6 16 39 T 32 39 T 48 39 T 64 39 T 80 39 T 96 39" fill="none" stroke="#ffffff" strokeWidth="0.7" opacity=".8" />
          <path className="wave-drift" style={{ animationDelay: "1.2s" }} d="M0 45 Q 8 43.6 16 45 T 32 45 T 48 45 T 64 45 T 80 45 T 96 45" fill="none" stroke="#ffffff" strokeWidth="0.6" opacity=".6" />
          {/* the lenj (boat) */}
          <g transform="translate(52 42)">
            <path d="M-6.5 0 L6.5 0 L4.6 2.6 L-4.6 2.6 Z" fill="#8a5a2e" />
            <line x1="0" y1="0" x2="0" y2="-8.5" stroke="#5d3a12" strokeWidth="0.6" />
            <path d="M0.4 -8.4 L5.4 -1.2 L0.4 -1.2 Z" fill="#fffdf4" />
            <path d="M-0.4 -6.8 L-4.2 -1.2 L-0.4 -1.2 Z" fill="#ffe9b8" />
          </g>
          <Gull x={30} y={28} s={1.1} />
          <Gull x={44} y={23} s={0.9} />
          <Gull x={76} y={27} s={1} />
          {/* pearl shell on the sand */}
          <g transform="translate(18 63)">
            <path d="M-3 0 Q 0 -3.4 3 0 Z" fill="#f4a8b8" />
            <circle cx="0" cy="-0.8" r="1" fill="#fff" stroke="#d8c8e8" strokeWidth="0.3" />
          </g>
        </>
      );
    case 8: /* روستای پلکانی — terraced village */
      return (
        <>
          <Cloud x={24} y={12} s={0.9} />
          <Cloud x={76} y={16} s={0.7} o={0.75} />
          <path d="M0 44 L30 20 L62 44 Z" fill="#7d99b4" />
          <path d="M30 20 L37 28.5 L30 30 L23.5 27 Z" fill="#ffffff" opacity=".85" />
          <path d="M50 44 L74 26 L98 44 Z" fill="#8aa4bd" />
          {/* stepped houses climbing the slope */}
          <g>
            <g transform="translate(14 60)"><rect x="-3.2" y="-4" width="6.4" height="5.4" fill="#c98a4b" /><path d="M-3.8 -4 L0 -7 L3.8 -4 Z" fill="#8a5a2e" /><rect className="win-glow" x="-1" y="-2.6" width="2" height="2" fill="#ffd94e" /></g>
            <g transform="translate(28 54)"><rect x="-3" y="-3.8" width="6" height="5.2" fill="#d99a58" /><path d="M-3.6 -3.8 L0 -6.6 L3.6 -3.8 Z" fill="#8a5a2e" /><rect className="win-glow" x="0.4" y="-2.5" width="1.8" height="1.9" fill="#ffe08a" style={{ animationDelay: ".7s" }} /></g>
            <g transform="translate(44 49)"><rect x="-3.4" y="-4.2" width="6.8" height="5.6" fill="#c98a4b" /><path d="M-4 -4.2 L0 -7.2 L4 -4.2 Z" fill="#7c4f22" /><rect className="win-glow" x="-1.9" y="-2.8" width="1.9" height="2" fill="#ffd94e" style={{ animationDelay: "1.3s" }} /></g>
            <g transform="translate(60 45)"><rect x="-2.8" y="-3.6" width="5.6" height="4.8" fill="#d99a58" /><path d="M-3.4 -3.6 L0 -6.2 L3.4 -3.6 Z" fill="#8a5a2e" /></g>
            <g transform="translate(76 42)"><rect x="-2.6" y="-3.2" width="5.2" height="4.4" fill="#c98a4b" /><path d="M-3.2 -3.2 L0 -5.8 L3.2 -3.2 Z" fill="#7c4f22" /><rect className="win-glow" x="-0.9" y="-2.2" width="1.8" height="1.8" fill="#ffe08a" style={{ animationDelay: "1.9s" }} /></g>
          </g>
          <BlossomTree x={88} y={56} s={0.95} />
        </>
      );
    case 9: /* شبِ ستاره‌ها — starry desert night */
      return (
        <>
          <Tw x={12} y={10} s={1.2} />
          <Tw x={26} y={20} s={0.9} d="d2" />
          <Tw x={40} y={8} s={1.1} d="d3" />
          <Tw x={55} y={17} s={1} d="d2" />
          <Tw x={68} y={7} s={1.3} />
          <Tw x={88} y={22} s={0.9} d="d3" />
          <Tw x={92} y={10} s={1} d="d2" />
          <Tw x={33} y={30} s={0.8} d="d3" />
          {/* crescent moon */}
          <g transform="translate(78 12)">
            <circle r="5.6" fill="#fff3b8" />
            <circle cx="2.6" cy="-1.4" r="4.9" fill="#2c3e78" />
          </g>
          {/* meteor */}
          <line x1="20" y1="26" x2="30" y2="20" stroke="url(#r9-meteor)" strokeWidth="0.8" strokeLinecap="round" />
          <defs>
            <linearGradient id="r9-meteor" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#fff6cf" stopOpacity=".9" />
            </linearGradient>
          </defs>
          {/* dark dune silhouettes */}
          <path d="M0 44 Q 25 38.5 50 43.5 T 100 42 L100 50 L0 50 Z" fill="#24335e" />
          <path d="M0 50 Q 30 45.5 60 50 T 100 48.5 L100 55 L0 55 Z" fill="#1c2a50" />
        </>
      );
    case 10: /* باغِ واژه‌ها — festival garden finale */
    default:
      return (
        <>
          <Firework x={22} y={16} c="#ffd94e" cls="" />
          <Firework x={62} y={10} c="#ff8fb0" cls="p2" />
          <Firework x={86} y={20} c="#8ce8ff" cls="p3" />
          <Firework x={42} y={24} c="#ffb35e" cls="p2" />
          <Tw x={74} y={30} s={1.1} />
          <Tw x={10} y={28} s={0.9} d="d2" />
          {/* garland */}
          <path d="M0 34 Q 25 40 50 34.5 T 100 34" fill="none" stroke="#a05a2c" strokeWidth="0.55" />
          {Array.from({ length: 9 }, (_, i) => {
            const t = i / 8;
            const x = 4 + t * 92;
            const y = 34 + Math.sin(Math.PI * t) * 3.4 - 1.4;
            const cs = ["#ff5d73", "#ffb302", "#9a6bf4", "#37c3d4", "#ff8fb0"];
            return <path key={i} d={`M ${x - 1.7} ${y} L ${x + 1.7} ${y} L ${x} ${y + 2.8} Z`} fill={cs[i % 5]} stroke="#fff" strokeWidth="0.22" />;
          })}
          <BlossomTree x={12} y={62} s={1.2} />
          <BlossomTree x={88} y={58} s={1.1} />
          <Lantern x={34} y={0} s={1} cls="l3" />
          <Lantern x={70} y={0} s={1.1} cls="l2" />
        </>
      );
  }
}

/* ============ realm shell: gate band + banner + path + nodes ============ */
function Realm({
  theme, onPlay, isCurHere, cur, curRef,
}: {
  theme: ChapterTheme;
  onPlay: (lv: number) => void;
  isCurHere: boolean;       /* does the global CURRENT level live here? */
  cur: { c: number; l: number } | null;
  curRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const ch = theme.id;
  const d = useMemo(() => pathD(WP), []);
  const unlockedCh = Save.chapterUnlocked(ch);
  let done = 0, stars = 0;
  for (let l = 1; l <= 10; l++) {
    const rec = Save.data.levels[`${ch}:${l}`];
    if (rec) { done++; stars += rec.stars; }
  }
  /* the chapter's own current level (first unlocked-not-done) */
  let curLv = -1;
  if (unlockedCh) {
    for (let l = 1; l <= 10; l++) {
      if (Save.levelUnlocked(ch, l) && !Save.data.levels[`${ch}:${l}`]) { curLv = l; break; }
    }
  }

  return (
    <section
      className="realm"
      data-realm={ch}
      style={{
        ["--sky1" as string]: theme.realm.sky[0],
        ["--sky2" as string]: theme.realm.sky[1],
        ["--land1" as string]: theme.realm.land[0],
        ["--land2" as string]: theme.realm.land[1],
        ["--gate1" as string]: theme.realm.gate[0],
        ["--gate2" as string]: theme.realm.gate[1],
        ["--acc" as string]: theme.accent,
      }}
    >
      {/* ornamental border/gate — the «مرز» between chapters */}
      <div className="gate-band">
        <span className="gate-rope" />
        <span className="gate-medal">{unlockedCh ? faNum(ch) : <LockChunky size={19} />}</span>
        <span className="gate-label">فصل {faNum(ch)} · {theme.title}</span>
        <span className="gate-rope r" />
      </div>

      {/* storybook banner */}
      <div className="realm-banner" style={unlockedCh ? undefined : { opacity: 0.88 }}>
        <div className="rb-plate">
          <span className="rb-medal">{unlockedCh ? faNum(ch) : <LockChunky size={20} />}</span>
          <div className="rb-title">{theme.title}</div>
          <div className="rb-sub">{theme.subtitle}</div>
          <div className="rb-stats">
            <span className="rb-stat">مرحله {faNum(done)}/{faNum(10)}</span>
            <span className="rb-stat"><StarGold size={12} /> {faNum(stars)}/{faNum(30)}</span>
          </div>
        </div>
      </div>

      {/* themed scenery */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="realm-scenery"
        aria-hidden
      >
        <RealmScenery id={ch} />
      </svg>

      {/* winding path */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
        aria-hidden
      >
        <path d={d} fill="none" stroke="rgba(40,62,40,.42)" strokeWidth={24} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="#8fd07a" strokeWidth={20} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.9} />
        <path d={d} fill="none" stroke="#f6e8c8" strokeWidth={14.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="#fff7e2" strokeWidth={4} strokeDasharray="10 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* 10 level nodes */}
      {WP.map(([x, y], i) => {
        const lv = i + 1;
        const key = `${ch}:${lv}`;
        const rec = Save.data.levels[key];
        const unlocked = unlockedCh && Save.levelUnlocked(ch, lv);
        const isCur = isCurHere && lv === curLv;
        return (
          <div
            key={lv}
            ref={cur && cur.c === ch && cur.l === lv ? curRef : undefined}
            style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}
          >
            {isCur && <span className="cur-tag">شما اینجایید</span>}
            <button
              type="button"
              disabled={!unlocked}
              className={`map-node ${!unlocked ? "locked" : ""} ${isCur ? "cur" : ""}`}
              aria-label={`مرحله ${faNum(lv)}${unlocked ? "" : " — قفل"}`}
              onClick={() => unlocked && onPlay(lv)}
            >
              {!unlocked ? <LockChunky size={20} /> : faNum(lv)}
            </button>
            {rec && rec.stars > 0 && (
              <span className="node-stars" style={{ left: "50%", width: 64, transform: "translateX(-50%)", justifyContent: "center" }}>
                {Array.from({ length: 3 }, (_, s) => (
                  <StarGold key={s} size={12} className={s < rec.stars ? "star-twinkle" : "star-ic off"} />
                ))}
              </span>
            )}
          </div>
        );
      })}

    </section>
  );
}

/* ================================ screen ================================ */
export function MapScreen({
  ch, coins, onBack, onPlay, onShop,
}: {
  ch: number;
  coins: number;
  onBack: () => void;
  onPlay: (lv: number) => void;
  onShop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement | null>(null);

  /* the player's CURRENT level across the WHOLE journey.
   * Plain call (not useMemo) — it reads the mutable Save store, and the
   * strict react-hooks lint forbids memoizing over non-reactive deps.
   * 100 iterations of map lookup = negligible. */
  const cur = currentLevel();

  /* center the current level instantly (layout effect → before paint) */
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const el = curRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const s = sc.getBoundingClientRect();
      sc.scrollTop += r.top - s.top - sc.clientHeight / 2 + r.height / 2;
    } else if (cur) {
      /* current chapter banner fallback */
      const realm = sc.querySelector<HTMLElement>(`[data-realm="${cur.c}"]`);
      if (realm) sc.scrollTop = realm.offsetTop;
    } else {
      sc.scrollTop = 0; /* everything done → crown the top */
    }
  }, []);

  const lines = [
    "هر واژه، یک قدمه تو پیشرفت!",
    "چای رو هم بزن، کلمه‌ها رو هم!",
    "با هر کلمه، روستا قشنگ‌تر می‌شه!",
    "من هستم و گربه‌ام؛ تو هم که بهترینی!",
  ];
  const guideCh = cur?.c ?? ch;
  const line = lines[(guideCh - 1) % lines.length];

  return (
    <Sheet>
      <TopBar coins={coins} onBack={onBack} onShop={onShop} title="نقشهٔ سفر" />

      <div className="map-scroll" ref={scrollRef}>
        <div className="map-world">
          {/* chapter 10 at the TOP … chapter 1 at the BOTTOM — the journey
              climbs upward, realms change as you scroll up */}
          {CHAPTERS.slice().reverse().map((theme) => (
            <Realm
              key={theme.id}
              theme={theme}
              onPlay={onPlay}
              isCurHere={cur?.c === theme.id}
              cur={cur}
              curRef={curRef}
            />
          ))}
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
