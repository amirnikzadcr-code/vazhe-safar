"use client";

import { useEffect, useRef } from "react";
import { game } from "@/game/core/engine";
import "./game.css";

export default function Home() {
  const hostRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    // guard against React StrictMode double-mount
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    cleanupRef.current = game.mount(hostRef.current);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return (
    <main
      className="vz-page"
      aria-label="واژه‌سفر — بازی پازل کلمات ایرانی"
    >
      <div ref={hostRef} id="vz-host" />
    </main>
  );
}
