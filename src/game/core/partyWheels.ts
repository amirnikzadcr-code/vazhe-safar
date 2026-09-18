/* ------------------------------------------------------------------
 * partyWheels.ts — the ENGINEERED دورهمی wheel pool (session GG)
 *
 * user: «کلمات بیشتری ک قابل جمله ساختن زیاده بزار و مهندسی شده بکن
 *        هر دور متفاوت باشه»
 *
 * The pool is generated OFFLINE by scripts/gen_party_wheels.mjs from
 * the full curated dictionary: every wheel = a 9-letter ring that can
 * build 200+ real Persian words (the JSON keeps the 180 longest as a
 * quick-accept cache). 140 diverse, non-repeating wheels ship with the
 * game — each ROUND draws a fresh one, so no two rounds feel alike,
 * and the phone pays zero generation cost at runtime.
 *
 * Every submission is ALSO validated against the full dictionary +
 * offline corpus (isRealWord / validateWord), so the accepted set is
 * even larger than the cached list.
 * ------------------------------------------------------------------ */
import wheelData from "@/game/data/party_wheels.json";

export interface PartyWheel {
  key: string;
  ls: string[];
  words: Set<string>;
}

let pool: PartyWheel[] | null = null;

function thePool(): PartyWheel[] {
  if (!pool) {
    pool = (wheelData.wheels as { ls: string; words: string[] }[]).map((w) => ({
      key: w.ls.split("").sort().join(""),
      ls: Array.from(w.ls),
      words: new Set(w.words),
    }));
  }
  return pool;
}

/**
 * Draw a random unused engineered wheel (letters + buildable-word set).
 * When the whole pool has been played it reshuffles and starts over —
 * a party of many rounds never runs dry and never repeats a wheel
 * until the pool is exhausted.
 */
export function pickEngineeredWheel(used: Set<string>): PartyWheel {
  const ps = thePool();
  const fresh = ps.filter((w) => !used.has(w.key));
  if (fresh.length === 0) {
    used.clear();
    return ps[Math.floor(Math.random() * ps.length)];
  }
  return fresh[Math.floor(Math.random() * fresh.length)];
}
