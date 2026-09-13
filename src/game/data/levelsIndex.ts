/* ------------------------------------------------------------------
 *  واژه‌سفر — data/levels/index.ts
 *  Loads the 10 chapter level files (100 levels total) + dictionary.
 *  Level data lives in separate JSON files so it can be edited freely.
 * ------------------------------------------------------------------ */
import ch01 from "./levels/ch01.json";
import ch02 from "./levels/ch02.json";
import ch03 from "./levels/ch03.json";
import ch04 from "./levels/ch04.json";
import ch05 from "./levels/ch05.json";
import ch06 from "./levels/ch06.json";
import ch07 from "./levels/ch07.json";
import ch08 from "./levels/ch08.json";
import ch09 from "./levels/ch09.json";
import ch10 from "./levels/ch10.json";
import { DICT } from "./dictionary";

export interface LevelData {
  id: number;         // 1..100 (global)
  wheel: string;      // letter pool of the wheel (anchor word letters)
  words: string[];    // main target words (crossword)
  bonus: string[];    // precomputed hidden bonus words (from dictionary)
}

export const LEVELS: LevelData[][] = [
  ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10,
] as LevelData[][];

/** runtime bonus-word check: any real dictionary word buildable from the wheel */
export function isRealWord(word: string): boolean {
  return DICT.has(word);
}

export function getLevel(ch: number, lv: number): LevelData {
  const list = LEVELS[ch - 1];
  const found = list.find((l) => l.id === (ch - 1) * 10 + lv);
  if (!found) throw new Error(`level not found: ch${ch} lv${lv}`);
  return found;
}

export function countLevels(): number {
  return LEVELS.reduce((s, c) => s + c.length, 0);
}
