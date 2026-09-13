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

/* chunky gold coin with face */
export function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#c87f06" />
      <circle cx="12" cy="11.4" r="9.4" fill="#ffc93c" />
      <circle cx="12" cy="11.4" r="6.6" fill="none" stroke="#e89a10" strokeWidth="1.6" strokeDasharray="2 2.4" />
      <circle cx="9.4" cy="9.6" r="1.05" fill="#8a5500" />
      <circle cx="14.6" cy="9.6" r="1.05" fill="#8a5500" />
      <path d="M9.3 13.2c1.6 1.5 3.8 1.5 5.4 0" fill="none" stroke="#8a5500" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* golden game star */
export function StarGold({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 1.8l3.1 6.5 7.1 1-5.1 5 1.2 7.1L12 18l-6.3 3.4L6.9 14.3l-5.1-5 7.1-1z"
        fill="#ffc93c" stroke="#c87f06" strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M12 5l1.8 3.8 4.1.6-3 2.9.7 4.1L12 14.5z" fill="#ffe08a" opacity=".9" />
    </svg>
  );
}

/* ---------- gift box: gold box + crimson ribbon (anim: wiggle) ---------- */
export function GiftIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-gift" aria-hidden>
      <defs>
        <linearGradient id="gv-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" /><stop offset="1" stopColor="#ff9d2e" />
        </linearGradient>
      </defs>
      <rect x="4.2" y="11" width="15.6" height="9.6" rx="2" fill="url(#gv-box)" stroke="#b45f06" strokeWidth="1.2" />
      <rect x="3" y="7.6" width="18" height="4" rx="1.6" fill="#ffd43b" stroke="#b45f06" strokeWidth="1.2" />
      <rect x="10.6" y="7.6" width="2.8" height="13" fill="#f43f5f" />
      <path d="M12 7.4C10.2 7.4 8.4 6.9 8.4 5.4c0-1.1.9-1.9 2-1.9 1.5 0 1.6 2.3 1.6 3.9Zm0 0c1.8 0 3.6-.5 3.6-2 0-1.1-.9-1.9-2-1.9-1.5 0-1.6 2.3-1.6 3.9Z"
        fill="#ff8fab" stroke="#c22947" strokeWidth="1.1" />
      <circle cx="7" cy="15.8" r="0.9" fill="#fff3bf" opacity=".85" />
    </svg>
  );
}

/* ---------- open book: cream pages + red bookmark (anim: flap) ---------- */
export function BookIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-book" aria-hidden>
      <path d="M12 5.6C10.4 4.3 8 3.8 4.6 3.8c-.9 0-1.6.7-1.6 1.6v11.8c0 .9.7 1.6 1.6 1.6 3.1 0 5.6.5 7.4 1.8 1.8-1.3 4.3-1.8 7.4-1.8.9 0 1.6-.7 1.6-1.6V5.4c0-.9-.7-1.6-1.6-1.6-3.4 0-5.8.5-7.4 1.8Z" fill="#a5541e" />
      <path d="M12 5.6C10.4 4.5 8.2 4 5 4c-.6 0-1 .4-1 1v10.6c0 .6.4 1 1 1 2.9 0 5.3.5 7 1.6V5.6Z" fill="#fff8ea" />
      <path d="M12 5.6C13.6 4.5 15.8 4 19 4c.6 0 1 .4 1 1v10.6c0 .6-.4 1-1 1-2.9 0-5.3.5-7 1.6V5.6Z" fill="#fffdf4" />
      <path d="M12 5.6v12.6" stroke="#d9b878" strokeWidth="1.1" />
      <path d="M13.4 4.4v5l1.5-1.2 1.5 1.2v-5.4c-1.1.1-2.1.2-3 .4Z" fill="#f43f5f" />
      <circle cx="7.6" cy="9.4" r="0.8" fill="#ffd43b" />
      <circle cx="7.6" cy="12.6" r="0.8" fill="#74c0fc" />
    </svg>
  );
}

/* ---------- trophy: gold cup + red ribbon (anim: bounce) ---------- */
export function TrophyIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-trophy" aria-hidden>
      <defs>
        <linearGradient id="tr-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe98a" /><stop offset="1" stopColor="#f59f00" />
        </linearGradient>
      </defs>
      <path d="M7 3.8h10v6a5 5 0 0 1-10 0v-6Z" fill="url(#tr-gold)" stroke="#b45f06" strokeWidth="1.2" />
      <path d="M7 5.2H4.2a0 0 0 0 0 0 0c0 3 .9 4.8 3 5.4M17 5.2h2.8c0 3-.9 4.8-3 5.4" fill="none" stroke="#e89a10" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.4 14.4h3.2l.5 2.8h-4.2Z" fill="#e89a10" />
      <rect x="7.6" y="17.2" width="8.8" height="3" rx="1.2" fill="#c22947" />
      <path d="M12 6l.9 1.8 2 .3-1.45 1.4.35 2L12 10.6l-1.8.9.35-2L9.1 8.1l2-.3Z" fill="#fff" opacity=".92" />
      <circle cx="18.6" cy="3" r="0.9" fill="#ffd43b" className="trophy-spark" />
    </svg>
  );
}

/* ---------- shopping bag: crimson bag + gold tag (anim: swing) ---------- */
export function BagIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="anim-bag" aria-hidden>
      <defs>
        <linearGradient id="bg-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8fab" /><stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <path d="M9 8V6.4A3 3 0 0 1 15 6.4V8" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4.6 7.6h14.8l-1.2 12a2 2 0 0 1-2 1.8H7.8a2 2 0 0 1-2-1.8Z" fill="url(#bg-body)" stroke="#9f1239" strokeWidth="1.1" />
      <circle cx="12" cy="13.6" r="3" fill="#ffd43b" stroke="#b45f06" strokeWidth="0.9" />
      <path d="M12 11.9l.62 1.25 1.38.2-1 .97.24 1.38L12 15.03l-1.24.67.24-1.38-1-.97 1.38-.2Z" fill="#8a5500" />
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

/* ---------- hint bulb: glowing glass + animated rays ---------- */
export function HintBulb({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="bulb-ic" aria-hidden>
      <g className="bulb-rays" stroke="#ffb302" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 1.6v2" /><path d="M4.6 4.9l1.4 1.4" /><path d="M19.4 4.9 18 6.3" />
        <path d="M2.4 11.4h2" /><path d="M19.6 11.4h2" />
      </g>
      <path d="M12 4.4a6 6 0 0 1 3.6 10.8c-.8.6-1.2 1.3-1.3 2.1h-4.6c-.1-.8-.5-1.5-1.3-2.1A6 6 0 0 1 12 4.4Z" fill="#ffe066" stroke="#e8940a" strokeWidth="1.3" />
      <path d="M10 14.2a4.4 4.4 0 0 0-1.3-5.4" fill="none" stroke="#fff3bf" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="9.6" y="18.4" width="4.8" height="1.5" rx="0.7" fill="#8494ab" />
      <rect x="10.1" y="20.2" width="3.8" height="1.5" rx="0.7" fill="#6b7c95" />
      <path d="M10.6 17.3h2.8" stroke="#e8940a" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- shuffle: two glossy curved arrows (anim: sway) ---------- */
export function ShuffleArrows({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shuffle-ic" aria-hidden>
      <path d="M3.5 7.5h3.4c1.5 0 2.9.7 3.8 1.9l3.6 4.8a4.8 4.8 0 0 0 3.8 1.9h2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M3.5 16.1h3.4c1.5 0 2.9-.7 3.8-1.9l.9-1.2" fill="none" stroke="#ffe08a" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.9 10.6l.4-.6a4.8 4.8 0 0 1 3.8-1.9h2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.6 5.4 21.2 8l-2.6 2.6" fill="none" stroke="#ffe08a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.6 13.4 21.2 16l-2.6 2.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5.4" cy="7.5" r="1" fill="#ffd43b" />
    </svg>
  );
}
