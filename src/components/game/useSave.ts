"use client";
/* React binding for the module-singleton Save system.
 *
 * v3 PERF (user: «حتی وقتی کلمه حدس زده میشه لگ میزنه» + «گوشی داغ میکنه»):
 * GameApp used to subscribe with useSave() → EVERY coin bump (each found
 * word, hint, bonus) re-rendered the ENTIRE app tree — the whole
 * PlayScreen with its wheel, board and HUD — on a weak phone that is a
 * visible stall exactly at the celebration moment.
 *
 * New contract:
 *  • GameApp does NOT subscribe to Save anymore (it only renders routes).
 *  • anything that displays live data subscribes ITSELF with a narrow
 *    hook: useCoins() for balances, useSave() inside the few screens
 *    whose full content depends on save data (shop/missions/map/…).
 *  • every Save mutation dispatches SAVE_EVENT synchronously
 *    (src/game/core/save.ts) — subscriptions refresh instantly while
 *    the localStorage WRITE itself is debounced (jank-free).
 * Result: a coin change re-renders one tiny <CoinPill>, never a screen. */
import { useSyncExternalStore, useCallback } from "react";
import { Save, SaveData, SAVE_EVENT } from "@/game/core/save";

const listeners = new Set<() => void>();
let version = 0;

/** manual refresh trigger (kept for legacy call sites; the save layer
 * already broadcasts on every mutation) */
export function bumpSave(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/* bridge the save layer's synchronous event → React subscriptions */
if (typeof window !== "undefined") {
  window.addEventListener(SAVE_EVENT, () => bumpSave());
}

export function useSave(): { data: SaveData; bump: () => void } {
  useSyncExternalStore(subscribe, () => version, () => version);
  const bump = useCallback(() => bumpSave(), []);
  return { data: Save.data, bump };
}

/** narrow subscription: re-renders ONLY when the coin balance changes */
export function useCoins(): number {
  return useSyncExternalStore(
    subscribe,
    () => Save.data.coins,
    () => 0,
  );
}
