"use client";
/* React binding for the module-singleton Save system:
 * any mutation calls bump() so consumers re-render with fresh data. */
import { useSyncExternalStore, useCallback } from "react";
import { Save, SaveData } from "@/game/core/save";

const listeners = new Set<() => void>();
let version = 0;

export function bumpSave(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function useSave(): { data: SaveData; bump: () => void } {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
  void snap;
  const bump = useCallback(() => bumpSave(), []);
  return { data: Save.data, bump };
}
