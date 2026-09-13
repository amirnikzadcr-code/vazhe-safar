"use client";
/* ------------------------------------------------------------------
 * UI kit — chunky 3D buttons, chips, top bar, modal/sheet frames,
 * vine decoration, star rows, toast. Everything RTL-aware.
 * ------------------------------------------------------------------ */
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import {
  Gear, X, ChevronRight, Star,
} from "@/components/game/icons";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { buzz } from "@/game/core/utils";

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

/* ---------- coin chip ---------- */
export function CoinChip({ value, plus, onPlus }: { value: number; plus?: boolean; onPlus?: () => void }) {
  return (
    <div className="chip">
      <span className="coin-ic" aria-hidden />
      <span>{faNum(value)}</span>
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

/* ---------- top bar: optional back, center title chip, coins, gear ---------- */
export function TopBar({
  coins, onSettings, onBack, title, right, onShop,
}: {
  coins: number;
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
        <CoinChip value={coins} plus onPlus={onShop} />
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
    <div className="vz-page fade-in" style={style}>
      {bg && (
        <>
          
          <img src={bg} alt="" className="vz-fill" style={{ filter: blur ? `blur(${blur}px)` : undefined }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(10,30,50,${bgDim})` }} />
        </>
      )}
      {!bg && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#8fd0ff 0%,#5cb2ef 45%,#3d9df0 100%)" }} />}
      <Vines />
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- corner vine SVG decoration ---------- */
export function Vines() {
  const vine = (
    <path
      d="M2 62 C2 30 18 14 52 10 M2 62 C6 40 22 30 44 30 M14 22 C22 16 30 16 38 20 M2 62 C10 54 24 52 36 56"
      fill="none" stroke="#2f8f4e" strokeWidth="7" strokeLinecap="round"
    />
  );
  const leaf = (x: number, y: number, r: number, rot: number, fill: string) => (
    <ellipse key={`${x}-${y}-${rot}`} cx={x} cy={y} rx={11 * r} ry={5.5 * r} fill={fill} transform={`rotate(${rot} ${x} ${y})`} />
  );
  return (
    <svg aria-hidden className="float-slow" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
      <g>
        {vine}
        {leaf(52, 10, 1, -30, "#43b962")}{leaf(44, 30, 0.9, 20, "#2f8f4e")}
        {leaf(36, 56, 0.9, -10, "#43b962")}{leaf(20, 20, 0.8, -60, "#57cc74")}
      </g>
      <g transform="translate(100% 0) scale(-1 1)">{vine}{leaf(52, 10, 1, -30, "#43b962")}{leaf(44, 30, 0.9, 20, "#2f8f4e")}{leaf(36, 56, 0.9, -10, "#43b962")}</g>
      <g transform="translate(0 100%) scale(1 -1)">{vine}{leaf(52, 10, 1, -30, "#43b962")}{leaf(44, 30, 0.9, 20, "#2f8f4e")}</g>
      <g transform="translate(100% 100%) scale(-1 -1)">{vine}{leaf(52, 10, 1, -30, "#43b962")}{leaf(36, 56, 0.9, -10, "#43b962")}</g>
    </svg>
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
