"use client";
/* ------------------------------------------------------------------
 * Icon set — CUSTOM colorful vector icons (no flat white glyphs).
 * Every icon carries its own palette + a built-in animation class,
 * so all icons on the home/play screens are genuinely alive.
 * ------------------------------------------------------------------ */
import { Settings as Gear, X, ChevronRight, Star } from "lucide-react";
import {
  Coins as CoinsIc, Settings, X as XIc, ChevronRight as ChevIc, Star as StarIc,
  Play, Gift, BookOpen, Trophy, ShoppingBag, Pause, Lightbulb, Shuffle,
  Lock, Check, Music, Volume2, Vibrate, Languages, ShieldCheck, Info, Home,
  CalendarDays, Target, Sparkles, ChevronLeft, RotateCcw, Flag,
} from "lucide-react";

/* lucide re-exports still used by the inner screens */
export {
  Gear, X, ChevronRight, Star,
  CoinsIc, Settings, XIc, ChevIc, StarIc,
  Play, Gift, BookOpen, Trophy, ShoppingBag, Pause, Lightbulb, Shuffle,
  Lock, Check, Music, Volume2, Vibrate, Languages, ShieldCheck, Info, Home,
  CalendarDays, Target, Sparkles, ChevronLeft, RotateCcw, Flag,
};

/* chunky gold coin with face + shine */
export function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="cn-g" cx=".36" cy=".3" r=".9">
          <stop offset="0" stopColor="#ffe98a" /><stop offset=".5" stopColor="#ffc93c" /><stop offset="1" stopColor="#c87f06" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="#c87f06" />
      <circle cx="12" cy="11.4" r="9.4" fill="url(#cn-g)" />
      <circle cx="12" cy="11.4" r="6.6" fill="none" stroke="#e89a10" strokeWidth="1.6" strokeDasharray="2 2.4" />
      <path d="M5.6 7.4a8 8 0 0 1 3-2.6" fill="none" stroke="#fff7d0" strokeWidth="1.7" strokeLinecap="round" opacity=".85" />
      <circle cx="9.4" cy="9.6" r="1.05" fill="#8a5500" />
      <circle cx="14.6" cy="9.6" r="1.05" fill="#8a5500" />
      <path d="M9.3 13.2c1.6 1.5 3.8 1.5 5.4 0" fill="none" stroke="#8a5500" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- 3D rendered image icons (AI-painted, chroma-cut PNGs).
   Used on home / play / map for the reference look. Static <img> =
   zero SVG paint cost, zero idle animation. ---------- */
export function ImgIcon({ name, size = 28, className, style }: {
  name: string; size?: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <img
      src={`/assets/img/${name}.webp`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", pointerEvents: "none", ...style }}
      draggable={false}
    />
  );
}

/* golden game star — glossy 3-tone gradient */
export function StarGold({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="sg-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" /><stop offset=".45" stopColor="#ffd94e" /><stop offset="1" stopColor="#f79c0d" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.8l3.1 6.5 7.1 1-5.1 5 1.2 7.1L12 18l-6.3 3.4L6.9 14.3l-5.1-5 7.1-1z"
        fill="url(#sg-g)" stroke="#c87f06" strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M12 5l1.8 3.8 4.1.6-3 2.9.7 4.1L12 14.5z" fill="#fff7cf" opacity=".85" />
    </svg>
  );
}

/* cartoon chunky padlock (map locked nodes) */
export function LockChunky({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="lk-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9edf2" /><stop offset="1" stopColor="#aeb8c4" />
        </linearGradient>
      </defs>
      <path d="M8 10.2V7.8a4 4 0 0 1 8 0v2.4" fill="none" stroke="#6d7887" strokeWidth="2.3" strokeLinecap="round" />
      <rect x="4.6" y="10" width="14.8" height="10.6" rx="3" fill="url(#lk-g)" stroke="#6d7887" strokeWidth="1.7" />
      <circle cx="12" cy="14.6" r="1.5" fill="#5a6570" />
      <rect x="11.2" y="15.4" width="1.6" height="2.6" rx="0.8" fill="#5a6570" />
      <ellipse cx="8.2" cy="12.4" rx="1.1" ry="0.6" fill="#fff" opacity=".8" />
    </svg>
  );
}

/* ---------- CARTOON GIFT BOX (kawaii face, bold outline, anim: wiggle) ---------- */
export function GiftIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-gift" aria-hidden>
      <defs>
        <linearGradient id="gf-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb35e" /><stop offset="1" stopColor="#f07f1c" />
        </linearGradient>
        <linearGradient id="gf-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" /><stop offset="1" stopColor="#ffc12e" />
        </linearGradient>
      </defs>
      <rect x="4" y="10.4" width="16" height="10.2" rx="2.6" fill="url(#gf-box)" stroke="#6b3400" strokeWidth="1.9" strokeLinejoin="round" />
      <rect x="2.8" y="6.6" width="18.4" height="4.4" rx="2" fill="url(#gf-lid)" stroke="#6b3400" strokeWidth="1.9" strokeLinejoin="round" />
      <rect x="10.5" y="6.6" width="3" height="14" fill="#f43f5f" stroke="#6b3400" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12 6.2C10 6.2 8 5.7 8 4.1c0-1.2 1-2.1 2.1-2.1 1.6 0 1.9 2.5 1.9 4.2Zm0 0c2 0 4-.5 4-2.1 0-1.2-1-2.1-2.1-2.1-1.6 0-1.9 2.5-1.9 4.2Z" fill="#ff8fab" stroke="#6b3400" strokeWidth="1.4" strokeLinejoin="round" />
      <ellipse cx="6.9" cy="13.2" rx="1.2" ry="0.8" fill="#fff" opacity=".85" />
      {/* kawaii face */}
      <circle cx="9.3" cy="15.9" r="1" fill="#5d2c04" />
      <circle cx="14.7" cy="15.9" r="1" fill="#5d2c04" />
      <path d="M10.9 17.6c.75.65 1.45.65 2.2 0" fill="none" stroke="#5d2c04" strokeWidth="1.05" strokeLinecap="round" />
      <circle cx="9" cy="15.5" r="0.32" fill="#fff" />
      <circle cx="14.4" cy="15.5" r="0.32" fill="#fff" />
    </svg>
  );
}

/* ---------- CARTOON BOOK (chunky, sparkle, anim: flap) ---------- */
export function BookIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-book" aria-hidden>
      <path d="M12 5.4C10.3 4.1 7.9 3.6 4.5 3.6c-1 0-1.7.8-1.7 1.7v11.9c0 1 .8 1.7 1.7 1.7 3.1 0 5.6.5 7.5 1.8 1.9-1.3 4.4-1.8 7.5-1.8 1 0 1.7-.7 1.7-1.7V5.3c0-1-.7-1.7-1.7-1.7-3.4 0-5.8.5-7.5 1.8Z" fill="url(#bk-cov)" stroke="#6b3400" strokeWidth="1.7" strokeLinejoin="round" />
      <defs>
        <linearGradient id="bk-cov" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c26a2e" /><stop offset="1" stopColor="#94451a" />
        </linearGradient>
      </defs>
      <path d="M12 5.4C10.3 4.3 8.1 3.8 5 3.8c-.6 0-1 .4-1 1v10.7c0 .6.4 1 1 1 2.9 0 5.3.5 7 1.7V5.4Z" fill="#fff8ea" />
      <path d="M12 5.4c1.7-1.1 3.9-1.6 7-1.6.6 0 1 .4 1 1v10.7c0 .6-.4 1-1 1-2.9 0-5.3.5-7 1.7V5.4Z" fill="#fffdf4" />
      <path d="M12 5.4v12.8" stroke="#d9b878" strokeWidth="1.2" />
      <path d="M13.6 4.2v5.2l1.6-1.3 1.6 1.3V4.5c-1.1.1-2.2.2-3.2.4Z" fill="#f43f5f" stroke="#6b3400" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="8" cy="9.6" r="0.9" fill="#ffd43b" stroke="#e8940a" strokeWidth="0.7" />
      <circle cx="8" cy="12.9" r="0.9" fill="#74c0fc" stroke="#339af0" strokeWidth="0.7" />
      <path className="book-spark" d="M18.4 7.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z" fill="#ffd43b" stroke="#e8940a" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- CARTOON TROPHY (kawaii cup with face, anim: bounce) ---------- */
export function TrophyIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-trophy" aria-hidden>
      <defs>
        <linearGradient id="tr-gold2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffec99" /><stop offset="1" stopColor="#f5a50a" />
        </linearGradient>
      </defs>
      <path d="M6.6 3.4h10.8v6.4a5.4 5.4 0 0 1-10.8 0V3.4Z" fill="url(#tr-gold2)" stroke="#6b3400" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6.6 5H3.6c0 3.2 1 5.2 3.2 5.9M17.4 5h3c0 3.2-1 5.2-3.2 5.9" fill="none" stroke="#6b3400" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.3 14.9h3.4l.5 2.9h-4.4Z" fill="#e8940a" stroke="#6b3400" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="7.2" y="17.8" width="9.6" height="3.2" rx="1.4" fill="#f43f5f" stroke="#6b3400" strokeWidth="1.5" />
      {/* kawaii face on the cup */}
      <circle cx="9.8" cy="8.2" r="0.95" fill="#5d2c04" />
      <circle cx="14.2" cy="8.2" r="0.95" fill="#5d2c04" />
      <path d="M10.7 10.1c.85.7 1.75.7 2.6 0" fill="none" stroke="#5d2c04" strokeWidth="1.05" strokeLinecap="round" />
      <circle cx="9.5" cy="7.8" r="0.32" fill="#fff" />
      <circle cx="13.9" cy="7.8" r="0.32" fill="#fff" />
      <ellipse cx="8.6" cy="5" rx="1.3" ry="0.7" fill="#fff" opacity=".8" />
      <path className="trophy-spark" d="M19.6 2.2l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="#ffd43b" stroke="#e8940a" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- CARTOON SHOP BAG (kawaii face + coin, anim: swing) ---------- */
export function BagIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-bag" aria-hidden>
      <defs>
        <linearGradient id="bg-bag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7d97" /><stop offset="1" stopColor="#e13a63" />
        </linearGradient>
      </defs>
      <path d="M8.8 7.8V6.2a3.2 3.2 0 0 1 6.4 0v1.6" fill="none" stroke="#6b3400" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M4.4 7.4h15.2l-1.3 12.2a2.2 2.2 0 0 1-2.2 2H7.9a2.2 2.2 0 0 1-2.2-2L4.4 7.4Z" fill="url(#bg-bag)" stroke="#6b3400" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5.9 9.2h12.2l-.9 9.2c-.06.6-.6 1.2-1.2 1.2H8c-.6 0-1.14-.6-1.2-1.2l-.9-9.2Z" fill="#ff8fab" opacity=".55" />
      {/* kawaii face */}
      <circle cx="9.4" cy="13.2" r="1" fill="#5d0a20" />
      <circle cx="14.6" cy="13.2" r="1" fill="#5d0a20" />
      <path d="M10.7 15.1c.85.7 1.75.7 2.6 0" fill="none" stroke="#5d0a20" strokeWidth="1.05" strokeLinecap="round" />
      <circle cx="9.1" cy="12.8" r="0.32" fill="#fff" />
      <circle cx="14.3" cy="12.8" r="0.32" fill="#fff" />
      <circle cx="12" cy="17.6" r="1.7" fill="#ffd43b" stroke="#6b3400" strokeWidth="0.9" />
      <path d="M12 16.7l.5 1 1.1.16-.8.76.2 1.08-.97-.52-.97.52.2-1.08-.8-.76 1.1-.16Z" fill="#8a5500" />
      <ellipse cx="7.4" cy="9.8" rx="1.1" ry="0.6" fill="#fff" opacity=".7" />
    </svg>
  );
}

/* ---------- AA — DISNEY-GRADE MONEY CHEST (v2): layered gradients,
   inner treasure glow, rim-lit wood, glossy sheen sweep, rivets,
   plank seams, a flying coin + kawaii face. Anim: lid bounce, coin
   bob, glow pulse, sheen sweep, sparkles. «در حد انیمیشن‌های دیزنی». ---------- */
export function ChestIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="anim-chest" aria-hidden>
      <defs>
        <radialGradient id="ch-halo" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffe98a" stopOpacity=".85" />
          <stop offset=".55" stopColor="#ffd94e" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffd94e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ch-inside" cx=".5" cy=".28" r=".62">
          <stop offset="0" stopColor="#fffbe0" /><stop offset=".45" stopColor="#ffd94e" /><stop offset="1" stopColor="#f29200" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ch-wood3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4b878" /><stop offset=".42" stopColor="#d98a3e" /><stop offset=".78" stopColor="#b06322" /><stop offset="1" stopColor="#8a4a12" />
        </linearGradient>
        <linearGradient id="ch-lid3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf95" /><stop offset=".55" stopColor="#dd954a" /><stop offset="1" stopColor="#a95d1d" />
        </linearGradient>
        <linearGradient id="ch-gold3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c8" /><stop offset=".45" stopColor="#ffd94e" /><stop offset=".8" stopColor="#f5a50a" /><stop offset="1" stopColor="#d97e00" />
        </linearGradient>
        <linearGradient id="ch-strap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" /><stop offset=".5" stopColor="#f0a51c" /><stop offset="1" stopColor="#b36b00" />
        </linearGradient>
        <clipPath id="ch-clip"><rect x="4.6" y="21.6" width="38.8" height="20" rx="5" /></clipPath>
      </defs>

      {/* halo */}
      <ellipse className="chest-glow" cx="24" cy="24" rx="22" ry="21" fill="url(#ch-halo)" />
      {/* magic glow rising out of the open chest */}
      <path className="chest-inside" d="M10 24c2.6-5 7.8-7.6 14-7.6S35.4 19 38 24l-2.2 2H12.2Z" fill="url(#ch-inside)" />

      {/* gold pile bursting out */}
      <g className="chest-coins">
        <ellipse cx="14.5" cy="21" rx="5" ry="3.8" fill="url(#ch-gold3)" stroke="#a86a00" strokeWidth="1.5" />
        <ellipse cx="31.5" cy="20.2" rx="5.4" ry="4" fill="url(#ch-gold3)" stroke="#a86a00" strokeWidth="1.5" />
        <ellipse cx="23.5" cy="17" rx="6.2" ry="4.7" fill="#ffe98a" stroke="#a86a00" strokeWidth="1.5" />
        <circle cx="23.5" cy="16.4" r="2.5" fill="#ffdf6b" stroke="#a86a00" strokeWidth="1" />
        <path d="M23.5 14.9l.6 1.2 1.3.2-.95.9.25 1.3-1.2-.65-1.2.65.25-1.3-.95-.9 1.3-.2Z" fill="#c87f06" />
        <circle cx="14.5" cy="20.4" r="1.6" fill="#ffe27a" stroke="#a86a00" strokeWidth=".9" />
        <circle cx="31.5" cy="19.6" r="1.6" fill="#ffe27a" stroke="#a86a00" strokeWidth=".9" />
        <g className="chest-coinfly">
          <circle cx="38.5" cy="12.5" r="2.3" fill="url(#ch-gold3)" stroke="#a86a00" strokeWidth="1" />
          <path d="M38.5 11.2l.5 1 1.1.15-.8.75.2 1.1-.98-.55-1 .55.2-1.1-.8-.75 1.1-.15Z" fill="#c87f06" />
        </g>
      </g>

      {/* open lid (bounces on its hinge) */}
      <g className="chest-lid">
        <rect x="4.6" y="7.5" width="38.8" height="12.6" rx="6" fill="url(#ch-lid3)" stroke="#6b3400" strokeWidth="2" />
        <path d="M7.5 11.2q16.5-4.6 33 0" fill="none" stroke="#8a4a12" strokeWidth="1.2" opacity=".55" />
        <rect x="8.4" y="9.8" width="31" height="2.6" rx="1.3" fill="#ffd9a4" opacity=".6" />
        <rect x="19.4" y="7.5" width="9.2" height="12.6" rx="2" fill="url(#ch-gold3)" stroke="#6b3400" strokeWidth="1.7" />
        <circle cx="24" cy="13.8" r="1.6" fill="#8a5500" />
        <circle cx="8.8" cy="13.8" r=".9" fill="#8a5500" opacity=".7" />
        <circle cx="39.2" cy="13.8" r=".9" fill="#8a5500" opacity=".7" />
      </g>

      {/* chest body */}
      <rect x="4.6" y="21.6" width="38.8" height="20" rx="5" fill="url(#ch-wood3)" stroke="#6b3400" strokeWidth="2.1" />
      <g clipPath="url(#ch-clip)">
        <path d="M4.6 28.6h38.8M4.6 34.8h38.8" stroke="#8a4a12" strokeWidth="1.1" opacity=".5" />
        {/* glossy sheen sweep */}
        <rect className="chest-sheen" x="-16" y="18" width="12" height="28" fill="#ffffff" opacity=".28" transform="skewX(-18)" />
      </g>
      {/* gold straps + rivets */}
      <rect x="8.2" y="21.6" width="5.4" height="20" fill="url(#ch-strap)" stroke="#6b3400" strokeWidth="1.5" />
      <rect x="34.4" y="21.6" width="5.4" height="20" fill="url(#ch-strap)" stroke="#6b3400" strokeWidth="1.5" />
      <circle cx="10.9" cy="24.6" r=".75" fill="#8a5500" /><circle cx="10.9" cy="38.4" r=".75" fill="#8a5500" />
      <circle cx="37.1" cy="24.6" r=".75" fill="#8a5500" /><circle cx="37.1" cy="38.4" r=".75" fill="#8a5500" />
      {/* big lock plate */}
      <rect x="18.6" y="23.4" width="10.8" height="9.4" rx="2.4" fill="url(#ch-gold3)" stroke="#6b3400" strokeWidth="1.7" />
      <circle cx="24" cy="27.2" r="1.7" fill="#7a4a00" /><rect x="23.1" y="28.2" width="1.8" height="2.9" rx=".9" fill="#7a4a00" />
      {/* kawaii face on the front */}
      <circle cx="14.6" cy="34.6" r="1.5" fill="#4a2400" />
      <circle cx="33.4" cy="34.6" r="1.5" fill="#4a2400" />
      <path d="M20.6 37.3c2.2 1.9 4.8 1.9 7 0" fill="none" stroke="#4a2400" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14.1" cy="34.1" r=".5" fill="#fff" />
      <circle cx="32.9" cy="34.1" r=".5" fill="#fff" />
      <circle cx="11.8" cy="31.6" r="1.9" fill="#ff8fab" opacity=".55" />
      <circle cx="36.2" cy="31.6" r="1.9" fill="#ff8fab" opacity=".55" />
      {/* sparkles */}
      <path className="chest-spark" d="M43.2 5.4l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1Z" fill="#ffd94e" stroke="#e8940a" strokeWidth=".8" />
      <path className="chest-spark d2" d="M5.6 2.9l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z" fill="#fff3b0" stroke="#e8940a" strokeWidth=".7" />
    </svg>
  );
}

/* ---------- AA — DISNEY-GRADE MISSION SCROLL (v2): warm parchment
   with an inner gold frame, ribbon-topped rolled ends, quest path +
   waving flag, a red wax seal, a popping GREEN check badge and a
   glossy sheen sweep — «گرافیکی‌تر و خوشگل‌تر در حد دیزنی». ---------- */
export function MissionScrollIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="anim-scroll" aria-hidden>
      <defs>
        <linearGradient id="ms-paper2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffcf0" /><stop offset=".5" stopColor="#f9ecc8" /><stop offset="1" stopColor="#ecd29c" />
        </linearGradient>
        <linearGradient id="ms-roll2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe7b3" /><stop offset=".5" stopColor="#e9c184" /><stop offset="1" stopColor="#c99a52" />
        </linearGradient>
        <radialGradient id="ms-seal2" cx=".38" cy=".32" r=".8">
          <stop offset="0" stopColor="#ff8a8f" /><stop offset=".55" stopColor="#e63946" /><stop offset="1" stopColor="#a3112c" />
        </radialGradient>
        <radialGradient id="ms-check2" cx=".36" cy=".3" r=".85">
          <stop offset="0" stopColor="#b2ffc0" /><stop offset=".5" stopColor="#4cd964" /><stop offset="1" stopColor="#1d9e3c" />
        </radialGradient>
        <radialGradient id="ms-halo2" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff3b0" stopOpacity=".7" /><stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </radialGradient>
        <clipPath id="ms-clip2"><rect x="9" y="11.6" width="30" height="24.8" rx="4.4" /></clipPath>
      </defs>

      {/* warm halo */}
      <circle className="scroll-halo" cx="24" cy="24" r="21" fill="url(#ms-halo2)" />

      {/* parchment */}
      <rect x="9" y="11.6" width="30" height="24.8" rx="4.4" fill="url(#ms-paper2)" stroke="#8a5a1e" strokeWidth="2" />
      <g clipPath="url(#ms-clip2)">
        <rect x="12.2" y="14.8" width="23.6" height="18.4" rx="2.8" fill="none" stroke="#d9b26a" strokeWidth="1.1" strokeDasharray="2.6 2.2" opacity=".8" />
        {/* glossy sheen sweep */}
        <rect className="scroll-sheen" x="-18" y="6" width="11" height="38" fill="#ffffff" opacity=".3" transform="skewX(-18)" />
      </g>
      {/* rolled ends with ribbon tips */}
      <rect x="5.2" y="9.6" width="7.2" height="28.8" rx="3.6" fill="url(#ms-roll2)" stroke="#8a5a1e" strokeWidth="2" />
      <rect x="35.6" y="9.6" width="7.2" height="28.8" rx="3.6" fill="url(#ms-roll2)" stroke="#8a5a1e" strokeWidth="2" />
      <ellipse cx="8.8" cy="12.6" rx="2.1" ry="1.1" fill="#b98c46" opacity=".7" />
      <ellipse cx="39.2" cy="12.6" rx="2.1" ry="1.1" fill="#b98c46" opacity=".7" />

      {/* quest path → flag target */}
      <path d="M14 31.5c4.4-1.2 4.2-6.2 8.4-6.2s3.8 4 8.2 2.8" fill="none" stroke="#c26a2e" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 2.6" />
      <g className="scroll-flag">
        <path d="M31 16.6v9.4" stroke="#8a5a1e" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M31 16.6l7.6 2.4-7.6 2.6Z" fill="#f43f5f" stroke="#a3112c" strokeWidth="1.1" strokeLinejoin="round" />
      </g>
      <circle className="scroll-goal" cx="14.3" cy="31.8" r="2.5" fill="#ffd94e" stroke="#c87f06" strokeWidth="1.4" />
      {/* quest text hints */}
      <path d="M15 19.6h7.4M15 23h5" stroke="#c2a06a" strokeWidth="1.7" strokeLinecap="round" />

      {/* red wax seal (bottom-left on the paper) */}
      <g className="scroll-seal">
        <circle cx="17.6" cy="34.2" r="3.5" fill="url(#ms-seal2)" stroke="#8f0d24" strokeWidth="1" />
        <path d="M17.6 32.4l.75 1.5 1.65.25-1.2 1.15.3 1.65-1.5-.8-1.5.8.3-1.65-1.2-1.15 1.65-.25Z" fill="#ffd9dd" opacity=".9" />
        <ellipse cx="16.4" cy="32.9" rx="1" ry=".55" fill="#ffffff" opacity=".45" />
      </g>

      {/* GREEN check badge (bottom-right, pops) */}
      <g className="scroll-check">
        <circle cx="33.4" cy="34.6" r="4.3" fill="url(#ms-check2)" stroke="#146c2e" strokeWidth="1.4" />
        <path d="M30.9 34.7l1.8 1.8 3.3-3.7" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="31.9" cy="32.8" rx="1.2" ry=".7" fill="#eafff0" opacity=".7" />
      </g>

      {/* sparkles */}
      <path className="scroll-spark" d="M40.8 5.6l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9Z" fill="#7ce97f" stroke="#2ea648" strokeWidth=".8" />
      <path className="scroll-spark d2" d="M6.2 3.4l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7Z" fill="#fff3b0" stroke="#e8940a" strokeWidth=".7" />
    </svg>
  );
}

/* ---------- play: glossy gold triangle (anim: pulse) ---------- */
export function PlayGold({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-play" aria-hidden>
      <defs>
        <linearGradient id="pl-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c2" /><stop offset=".5" stopColor="#ffd94e" /><stop offset="1" stopColor="#ff9d2e" />
        </linearGradient>
      </defs>
      <path d="M8 4.6 19.2 12 8 19.4Z" fill="url(#pl-gold)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- CARTOON HINT BULB (kawaii glowy friend + rays) ---------- */
export function HintBulb({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="bulb-ic" aria-hidden>
      <defs>
        <radialGradient id="hb-glass" cx=".42" cy=".34" r=".85">
          <stop offset="0" stopColor="#fff9d6" /><stop offset=".55" stopColor="#ffe066" /><stop offset="1" stopColor="#ffb302" />
        </radialGradient>
      </defs>
      <g className="bulb-rays" stroke="#ffb302" strokeWidth="1.9" strokeLinecap="round">
        <path d="M12 1.4v2.2" /><path d="M4.4 4.7l1.6 1.6" /><path d="M19.6 4.7 18 6.3" />
        <path d="M2.2 11.6h2.2" /><path d="M19.6 11.6h2.2" />
      </g>
      <path d="M12 4a6.6 6.6 0 0 1 4 11.9c-.9.7-1.3 1.4-1.4 2.3h-5.2c-.1-.9-.5-1.6-1.4-2.3A6.6 6.6 0 0 1 12 4Z" fill="url(#hb-glass)" stroke="#b06a00" strokeWidth="1.7" />
      <path d="M9.4 8.4a4.6 4.6 0 0 0-1.2 5.2" fill="none" stroke="#fff3bf" strokeWidth="1.6" strokeLinecap="round" />
      {/* kawaii face */}
      <circle cx="10" cy="10.6" r="1" fill="#8a5500" />
      <circle cx="14" cy="10.6" r="1" fill="#8a5500" />
      <path d="M10.7 12.7c.85.65 1.75.65 2.6 0" fill="none" stroke="#8a5500" strokeWidth="1.05" strokeLinecap="round" />
      <circle cx="9.7" cy="10.2" r="0.32" fill="#fff" />
      <circle cx="13.7" cy="10.2" r="0.32" fill="#fff" />
      <rect x="9.4" y="18.6" width="5.2" height="1.7" rx="0.85" fill="#8494ab" stroke="#5d6b80" strokeWidth="0.7" />
      <rect x="10" y="20.6" width="4" height="1.6" rx="0.8" fill="#6b7c95" stroke="#5d6b80" strokeWidth="0.7" />
    </svg>
  );
}

/* ---------- CARTOON SHUFFLE (chunky glossy arrows, anim: sway) ---------- */
export function ShuffleArrows({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shuffle-ic" aria-hidden>
      {/* back path (cream) */}
      <path d="M3.4 16.2h3.5c1.6 0 3.1-.75 4-2l.8-1.1" fill="none" stroke="#6b3400" strokeWidth="3.4" strokeLinecap="round" opacity="0.25" transform="translate(0 .9)" />
      <path d="M3.4 16.2h3.5c1.6 0 3.1-.75 4-2l.8-1.1" fill="none" stroke="#ffe08a" strokeWidth="3" strokeLinecap="round" />
      {/* front path (white) */}
      <path d="M3.4 7.6h3.5c1.6 0 3.1.75 4 2l3.6 4.8a4.9 4.9 0 0 0 3.9 2h2" fill="none" stroke="#6b3400" strokeWidth="3.4" strokeLinecap="round" opacity="0.25" transform="translate(0 .9)" />
      <path d="M3.4 7.6h3.5c1.6 0 3.1.75 4 2l3.6 4.8a4.9 4.9 0 0 0 3.9 2h2" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M14.9 10.7l.4-.6a4.9 4.9 0 0 1 3.9-2h2" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      {/* chunky arrowheads */}
      <path d="M17.9 4.6 21.4 8l-3.5 3.4" fill="none" stroke="#ffd43b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.9 12.9 21.4 16.3l-3.5 3.4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5.2" cy="7.6" r="1.15" fill="#ffd43b" stroke="#e8940a" strokeWidth="0.8" />
    </svg>
  );
}
