"use client";
/* Icon set: custom gold coin + star, rest from lucide-react. */
import { Coins, Settings, X, ChevronRight, Star, Play, Gift, BookOpen, Trophy, ShoppingBag, Pause, Lightbulb, Shuffle, Lock, Check, Music, Volume2, Vibrate, Languages, ShieldCheck, Info, Home, CalendarDays, Target, Sparkles, ChevronLeft, RotateCcw, Flag } from "lucide-react";

export {
  Coins as CoinsIc, Settings as Gear, X, ChevronRight, Star, Play, Gift,
  BookOpen, Trophy, ShoppingBag, Pause, Lightbulb, Shuffle, Lock, Check,
  Music, Volume2, Vibrate, Languages, ShieldCheck, Info, Home,
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
