"use client";
/* ------------------------------------------------------------------
 * TurnTimer — the countdown ring shared by دورهمی (pass-and-play)
 * and دورهمی وای‌فای. Own state so the parent never re-renders.
 * ------------------------------------------------------------------ */
import { useEffect, useRef, useState } from "react";
import { Audio } from "@/game/core/audio";
import { faNum } from "@/game/core/utils";

export function TurnTimer({ ms, onEnd }: { ms: number; onEnd: () => void }) {
  const C = 2 * Math.PI * 26;
  const [run, setRun] = useState(false);
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  const leftRef = useRef(left);
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; });
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const rem = Math.max(0, ms - (Date.now() - t0));
      const s = Math.ceil(rem / 1000);
      if (s !== leftRef.current) {
        leftRef.current = s;
        setLeft(s);
        if (s <= 3 && s > 0) Audio.sfxLetter(2); /* gentle final ticks */
      }
      if (rem <= 0) { clearInterval(id); endRef.current(); }
    }, 200);
    const raf = requestAnimationFrame(() => setRun(true)); /* arm the ring transition */
    return () => { clearInterval(id); cancelAnimationFrame(raf); };
  }, [ms]);
  const low = left <= 5;
  return (
    <div className={`pt-timer ${low ? "low" : ""}`} aria-label={`${faNum(left)} ثانیه`}>
      <svg width="66" height="66" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(74,44,14,.35)" strokeWidth="6" />
        <circle
          className="pt-ring"
          cx="32" cy="32" r="26" fill="none"
          stroke={low ? "#ff5b5b" : "#ffd76e"} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={run ? C : 0}
          transform="rotate(-90 32 32)"
          style={{ transition: `stroke-dashoffset ${ms}ms linear` }}
        />
      </svg>
      <b>{faNum(left)}</b>
    </div>
  );
}
