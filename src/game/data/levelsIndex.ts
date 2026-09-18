/* ------------------------------------------------------------------
 *  واژه‌سفر — data/levels/index.ts
 *  Loads the 20 chapter level files (200 levels total) + dictionary.
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
import ch11 from "./levels/ch11.json";
import ch12 from "./levels/ch12.json";
import ch13 from "./levels/ch13.json";
import ch14 from "./levels/ch14.json";
import ch15 from "./levels/ch15.json";
import ch16 from "./levels/ch16.json";
import ch17 from "./levels/ch17.json";
import ch18 from "./levels/ch18.json";
import ch19 from "./levels/ch19.json";
import ch20 from "./levels/ch20.json";
import { DICT } from "./dictionary";
import { EXTRA_WORDS } from "./dictionary_extra";
import { PARTY_WORDS } from "./dictionary_party";
import { HIDDEN_WORDS } from "./dictionary_hidden";

export interface LevelData {
  id: number;         // global 1-based level number (۱..۲۲۰)
  wheel: string;      // letter pool of the wheel (anchor word letters)
  words: string[];    // main target words (crossword)
  bonus: string[];    // precomputed hidden bonus words (from dictionary)
}

export const LEVELS: LevelData[][] = [
  ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10,
  ch11, ch12, ch13, ch14, ch15, ch16, ch17, ch18, ch19, ch20,
] as LevelData[][];

/* ---------- chapter geometry (v1.18 — user: «هر فصل طولانی تر باشه…
 * مراحل هارو ۱۰ قسمت ۱۰ قسمت نکن، فصل دوم قسمت ۱۱ ۱۲ ۱۳») ----------
 * chapters 1-10 keep 10 levels (the gentle ramp); the HARD tier
 * chapters 11-20 grow to 12 levels each → 220 levels total, and every
 * level carries ONE continuous global number across the whole journey. */
export function lvPerCh(ch: number): number {
  return ch >= 11 ? 12 : 10;
}

/** levels before chapter ch (ch is 1-based) */
export function levelsBefore(ch: number): number {
  let n = 0;
  for (let c = 1; c < ch; c++) n += lvPerCh(c);
  return n;
}

/** the ONE continuous number a level shows on the map
 * (chapter 2 starts at ۱۱, chapter 11 starts at ۱۰۱…) */
export function globalLevel(ch: number, lv: number): number {
  return levelsBefore(ch) + lv;
}

export const TOTAL_LEVELS: number = levelsBefore(21);

/* v5 — FULL validity set: generated dictionary + curated everyday words
 * + the +5453-word دورهمی expansion (user: «۵۰۰۰ تا دیگ اضافه بکن و
 * جمله‌های دو حرفی هم قبول باشه») + the EE hidden-word pack (~1240 more
 * everyday words — user: «واژه‌های پنهان زیادی تری اضافه بکن») →
 * 10,000+ real Persian words. */
export const ALL_DICT_WORDS: string[] = [...DICT, ...EXTRA_WORDS, ...PARTY_WORDS, ...HIDDEN_WORDS];
export const FULL_DICT: Set<string> = new Set(ALL_DICT_WORDS);

/** runtime bonus-word check: any real dictionary word buildable from the wheel */
export function isRealWord(word: string): boolean {
  return FULL_DICT.has(word);
}

export function getLevel(ch: number, lv: number): LevelData {
  const list = LEVELS[ch - 1];
  const found = list.find((l) => l.id === globalLevel(ch, lv));
  if (!found) throw new Error(`level not found: ch${ch} lv${lv}`);
  return found;
}

export function countLevels(): number {
  return LEVELS.reduce((s, c) => s + c.length, 0);
}
