"use client";

import { useEffect, useRef } from "react";
import { GameApp } from "@/components/game/GameApp";
import { Audio } from "@/game/core/audio";
import "./game.css";

export default function Home() {
  const startedRef = useRef(false);

  /* resume audio context on first user gesture (mobile autoplay policy) */
  useEffect(() => {
    const resume = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      Audio.ensure();
    };
    window.addEventListener("pointerdown", resume, { once: true });
    return () => window.removeEventListener("pointerdown", resume);
  }, []);

  return (
    <main className="vz-body" dir="rtl" lang="fa" aria-label="واژه‌سفر — بازی پازل کلمات ایرانی">
      <div className="vz-phone">
        <GameApp />
      </div>
    </main>
  );
}
