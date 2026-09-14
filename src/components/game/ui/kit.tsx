"use client";
/* ------------------------------------------------------------------
 * UI kit — chunky 3D buttons, chips, top bar, modal/sheet frames,
 * vine decoration, star rows, toast. Everything RTL-aware.
 * ------------------------------------------------------------------ */
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
/* (useRef imported for the Sheet instant-background check) */
import {
  Gear, X, ChevronRight, Star,
} from "@/components/game/icons";
import { AvatarFace } from "@/components/game/avatars";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { Save } from "@/game/core/save";
import { isDecoded } from "@/game/core/preload";
import { buzz } from "@/game/core/utils";
import { useCoins, useSave } from "@/components/game/useSave";

/* ---------- chunky 3D button ---------- */
export function Btn({
  children, onClick, color, size, wide, disabled, style, className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: "green" | "gold" | "blue" | "teal" | "red";
  size?: "big";
  wide?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`b3 ${color ?? ""} ${size === "big" ? "big" : ""} ${wide ? "wide" : ""} ${className}`}
      style={style}
      onClick={() => {
        if (disabled) return;
        Audio.sfxClick();
        buzz(12, true);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

/* ---------- round icon button ---------- */
export function IconBtn({
  children, onClick, variant = "", label, size,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "" | "wood" | "green" | "sky";
  label?: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`ib3 ${variant}`}
      style={size ? { width: size, height: size } : undefined}
      onClick={() => {
        Audio.sfxClick();
        buzz(10, true);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

/* ---------- coin chip ----------
 * v3 PERF: `value` is OPTIONAL — when omitted the chip subscribes to the
 * coin balance itself, so a balance change re-renders this tiny chip and
 * never the screen around it (kills the word-guess lag). */
export function CoinChip({ value, plus, onPlus }: { value?: number; plus?: boolean; onPlus?: () => void }) {
  const live = useCoins();
  const shown = value ?? live;
  return (
    <div className="chip">
      <span className="coin-ic" aria-hidden />
      <span>{faNum(shown)}</span>
      {plus && (
        <button
          type="button"
          aria-label="افزودن سکه"
          onClick={() => { Audio.sfxClick(); onPlus?.(); }}
          style={{ width: 22, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(180deg,#8cf291,#2ea648)", color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1, boxShadow: "0 2px 0 #1d7c33", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          +
        </button>
      )}
    </div>
  );
}

/* ---------- coin pill — dark wood + gold rim (reference HUD) ----------
 * v3 PERF: same live-subscription contract as CoinChip. */
export function CoinPill({ value, onPlus }: { value?: number; onPlus?: () => void }) {
  const live = useCoins();
  const shown = value ?? live;
  return (
    <div className="coinpill">
      <img src="/assets/img/coins.webp" alt="" draggable={false} />
      <b>{faNum(shown)}</b>
      {onPlus && (
        <button type="button" aria-label="افزودن سکه" className="plus" onClick={() => { Audio.sfxClick(); onPlus?.(); }}>+</button>
      )}
    </div>
  );
}

/* ---------- player HUD — REAL profile: v2.4 ONE unified plate.
   «پروفایل مرتب‌تر … آواتار با کادر پروفایل یکی بکن»: the avatar sits
   INSIDE the wooden profile plate (no separate floating circle) with
   the level badge docked on its corner; name + XP bar fill the rest.
   Tap opens the profile editor. ---------- */
export function PlayerHud({
  gear, onGear, onPlus, onProfile,
}: {
  gear?: "bronze" | "blue";
  onGear?: () => void;
  onPlus?: () => void;
  onProfile?: () => void;
}) {
  /* v3: subscribes to save events — the plate (name/avatar/level/XP)
   * must refresh the moment the profile is edited or XP moves, WITHOUT
   * re-rendering the screen behind it (the plate is ~30 nodes: cheap). */
  useSave();
  const prof = Save.data.profile;
  const { lvl, cur, need } = Save.levelInfo();
  return (
    <div className="hud">
      <button
        type="button"
        className="hud-left hud-prof-btn"
        onClick={() => { Audio.sfxClick(); onProfile?.(); }}
        aria-label="پروفایل بازیکن"
      >
        <span className="plate plate-unified">
          <span className="plate-avatar">
            <AvatarFace id={prof.avatar} size={44} />
            <span className="hud-lvl-corner">{faNum(lvl)}</span>
          </span>
          <span className="plate-info">
            <span className="plate-name">{prof.name || "مسافر"}</span>
            <span className="plate-xp">
              <span className="plate-xpbar"><i style={{ width: `${Math.round((cur / need) * 100)}%` }} /></span>
              <span className="plate-xpnum">سطح {faNum(lvl)} · {faNum(cur)}/{faNum(need)}</span>
            </span>
          </span>
        </span>
      </button>
      <div className="hud-right">
        <CoinPill onPlus={onPlus} />
        {onGear && (
          <button type="button" aria-label="تنظیمات" className={`gearbtn ${gear === "blue" ? "blue" : ""}`} onClick={() => { Audio.sfxClick(); onGear(); }}>
            <img src="/assets/img/gear.webp" alt="" draggable={false} style={gear === "blue" ? { filter: "hue-rotate(165deg) saturate(1.5)" } : undefined} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- map top bar — back + wooden banner + coins (reference) ----------
 * v3 PERF: no coins prop — the pill is live by itself. */
export function MapTopBar({ title, onBack, onPlus }: {
  title: string; onBack: () => void; onPlus?: () => void;
}) {
  return (
    <div className="map-top">
      <button type="button" aria-label="بازگشت" className="map-back" onClick={() => { Audio.sfxClick(); onBack(); }}>
        <ChevronRight size={24} />
      </button>
      <div className="sheet-title" style={{ fontSize: 16, padding: "7px 22px" }}>{title}</div>
      <CoinPill onPlus={onPlus} />
    </div>
  );
}

/* ---------- top bar: optional back, center title chip, coins, gear ----------
 * v3 PERF: no coins prop — the chip is live by itself. */
export function TopBar({
  onSettings, onBack, title, right, onShop,
}: {
  onSettings?: () => void;
  onBack?: () => void;
  title?: string;
  right?: ReactNode;
  onShop?: () => void;
}) {
  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {onBack && (
          <IconBtn label="بازگشت" onClick={onBack}>
            <ChevronRight size={22} />
          </IconBtn>
        )}
        <CoinChip plus onPlus={onShop} />
      </div>
      {title ? <div className="sheet-title" style={{ fontSize: 15, padding: "6px 18px" }}>{title}</div> : <span />}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {right}
        {onSettings && (
          <IconBtn label="تنظیمات" onClick={onSettings}>
            <Gear size={22} />
          </IconBtn>
        )}
      </div>
    </div>
  );
}

/* ---------- star row ---------- */
export function Stars({ n, total = 3, size = 24 }: { n: number; total?: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${faNum(n)} از ${faNum(total)} ستاره`}>
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} size={size} className={`star-ic ${i < n ? "" : "off"}`} />
      ))}
    </span>
  );
}

/* ---------- STABLE BACKGROUND — gradient underlay + decode gate.
 * The screen NEVER flashes white/gray/blue while an image decodes: a
 * soft gradient paints first, the image fades in only once fetched+
 * decoded. v2.2: images are pre-decoded during the splash, and
 * isDecoded() is checked SYNCHRONOUSLY on the first render → returning
 * to any screen paints the image at full opacity instantly (zero blue
 * flash between pages). Shared by Sheet + HomeScreen. ---------- */
export function StableBg({ src, dim = 0, blur = 0 }: { src: string; dim?: number; blur?: number }) {
  /* decode gate: the SYNC isDecoded() seed + the img ref-check + onLoad
   * cover every path — no setState-in-effect needed (lint-clean). */
  const [ready, setReady] = useState(() => isDecoded(src));
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#9fd9ff 0%,#6cc0f5 34%,#a8e08b 62%,#7ccb62 100%)" }} />
      <img
        ref={(el) => {
          if (!el) return;
          if (el.complete && el.naturalWidth > 0) setReady(true);
          else setReady(false);
        }}
        src={src}
        alt=""
        className="vz-fill"
        style={{
          filter: blur ? `blur(${blur}px)` : undefined,
          opacity: ready ? 1 : 0,
          transition: ready ? "none" : "opacity .16s ease",
        }}
        fetchPriority="high"
        decoding="async"
        onLoad={() => setReady(true)}
      />
      {dim > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(10,30,50,${dim})`, opacity: ready ? 1 : 0, transition: "opacity .16s ease" }} />
      )}
    </>
  );
}

/* ---------- full-screen sheet with wooden/vine frame ---------- */
export function Sheet({
  children, bg, bgDim = 0.25, blur = 0, style,
}: {
  children: ReactNode;
  bg?: string;
  bgDim?: number;
  blur?: number;
  style?: CSSProperties;
}) {
  return (
    <div className="vz-page" style={style}>
      {bg ? (
        <StableBg src={bg} dim={bgDim} blur={blur} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#8fd0ff 0%,#5cb2ef 45%,#3d9df0 100%)" }} />
      )}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- corner vine decoration — lush leaves + pink flowers,
   matching the leafy frame of the reference mockup.
   v3 FIX: the old single-SVG `transform="translate(100% 0)…"` attributes
   were INVALID (SVG transform lists don't accept % units) → the browser
   threw and the corners never mirrored. Now each corner is its own
   absolutely-positioned SVG flipped with CSS transforms (valid + cheap,
   still zero animation). ---------- */
export function Vines() {
  const leaf = (x: number, y: number, r: number, rot: number, fill: string, key: string) => (
    <ellipse key={key} cx={x} cy={y} rx={13 * r} ry={6 * r} fill={fill} transform={`rotate(${rot} ${x} ${y})`} />
  );
  const flower = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-3.2" rx="2.1" ry="3.1" fill="#ff8fb0" transform={`rotate(${a})`} />
      ))}
      <circle cx="0" cy="0" r="1.7" fill="#ffd94e" />
    </g>
  );
  const cornerSvg = (keyPrefix: string, css: CSSProperties) => (
    <svg
      aria-hidden
      width="76"
      height="76"
      viewBox="0 0 76 76"
      style={{ position: "absolute", width: "26vmin", height: "26vmin", maxWidth: 110, maxHeight: 110, pointerEvents: "none", ...css }}
    >
      <path d="M2 74 C2 34 20 14 62 9 M2 74 C8 44 26 32 52 30 M14 20 C24 13 34 13 44 18 M2 74 C12 62 28 58 44 62"
        fill="none" stroke="#2f8f4e" strokeWidth="8" strokeLinecap="round" />
      {leaf(62, 9, 1.1, -32, "#3fae5c", `${keyPrefix}-l1`)}
      {leaf(50, 15, 0.9, -10, "#2f8f4e", `${keyPrefix}-l2`)}
      {leaf(52, 30, 1, 24, "#43b962", `${keyPrefix}-l3`)}
      {leaf(38, 34, 0.85, 55, "#57cc74", `${keyPrefix}-l4`)}
      {leaf(44, 18, 0.8, -60, "#3fae5c", `${keyPrefix}-l5`)}
      {leaf(44, 62, 0.95, -8, "#2f8f4e", `${keyPrefix}-l6`)}
      {leaf(30, 56, 0.8, -40, "#43b962", `${keyPrefix}-l7`)}
      {leaf(18, 22, 0.9, -75, "#57cc74", `${keyPrefix}-l8`)}
      {flower(56, 20, 1, `${keyPrefix}-f1`)}
      {flower(30, 40, 0.85, `${keyPrefix}-f2`)}
      {flower(60, 48, 0.75, `${keyPrefix}-f3`)}
    </svg>
  );
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden" }}>
      {cornerSvg("tl", { top: 0, left: 0 })}
      {cornerSvg("tr", { top: 0, right: 0, transform: "scaleX(-1)" })}
      {cornerSvg("bl", { bottom: 0, left: 0, transform: "scaleY(-1)" })}
      {cornerSvg("br", { bottom: 0, right: 0, transform: "scale(-1)" })}
    </div>
  );
}

/* ---------- center modal (cream panel + blue head ribbon) ---------- */
export function Modal({
  title, children, onClose, wide, headRight,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  headRight?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fade-in"
      style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(12,34,60,.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="panel rise-in" style={{ width: wide ? "100%" : "min(100%, 350px)" }}>
        <div className="panel-head">
          <span style={{ flex: 1 }} />
          <span style={{ position: "relative", zIndex: 1 }}>{title}</span>
          <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
            {headRight ?? (onClose ? (
              <button
                type="button" aria-label="بستن" onClick={() => { Audio.sfxClick(); onClose(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex", padding: 2 }}
              >
                <X size={20} />
              </button>
            ) : null)}
          </span>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- toast ---------- */
export function useToast(): { toast: string | null; show: (msg: string) => void } {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { toast, show };
}

export function ToastHost({ toast }: { toast: string | null }) {
  if (!toast) return null;
  return <div className="vz-toast" role="status">{toast}</div>;
}
