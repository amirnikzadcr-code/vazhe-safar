#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* SESSION Z — rebuild ch01 as the GENTLE ONBOARDING chapter:
 * «فصل اول خیلی یکم سخته آسون ترش بکن»
 *  • 10 levels, 3-4 SUPER-common words each, zero fragment words
 *    (the old «نی/تر/لب/با» gibberish-feel subwords are gone)
 *  • ramp: 4-letter wheels for levels 1-6, 5-letter for 7-10
 *  • every main word + bonus validated: buildable from the wheel,
 *    chapter-unique, bonus ⊆ FULL_DICT (runtime isRealWord set)
 */
const fs = require("fs");
const path = require("path");

const root = "/home/z/my-project";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

/* extract the exact runtime dictionaries (FULL_DICT = DICT+EXTRA+PARTY) */
const persianRe = /"([\u0600-\u06FF]+)"/g;
const dict = new Set();
for (const f of ["src/game/data/dictionary.ts", "src/game/data/dictionary_extra.ts", "src/game/data/dictionary_party.ts"]) {
  const m = read(f).match(persianRe) || [];
  for (const w of m) dict.add(w.slice(1, -1));
}
console.log("FULL_DICT size:", dict.size);

const letters = (w) => Array.from(w.trim());
const canBuild = (word, pool) => {
  const pl = letters(pool);
  for (const ch of letters(word)) {
    const i = pl.indexOf(ch);
    if (i === -1) return false;
    pl.splice(i, 1);
  }
  return true;
};

/* the new gentle chapter — heroes are everyday words, subwords are
 * real standalone words a child knows (no fragments) */
const PLAN = [
  { wheel: "قوری", words: ["قوری", "قوی", "قو", "روی"] },
  { wheel: "لامپ", words: ["لامپ", "پل", "ما", "پا"] },
  { wheel: "ماهی", words: ["ماهی", "ماه", "های"] },
  { wheel: "ابرو", words: ["ابرو", "ابر", "بار", "رو"] },
  { wheel: "دریا", words: ["دریا", "داری", "دیر"] },
  { wheel: "چاقو", words: ["چاقو", "چاق"] },
  { wheel: "باران", words: ["باران", "انار"] },
  { wheel: "برادر", words: ["برادر", "برد", "دار"] },
  { wheel: "خواهر", words: ["خواهر", "خواه", "رخ"] },
  { wheel: "دوستی", words: ["دوستی", "دوست", "دو"] },
];

/* sanity: wheels must contain exactly their hero's letters */
for (const p of PLAN) {
  const a = letters(p.wheel).sort().join("");
  const b = letters(p.words[0]).sort().join("");
  if (a !== b) throw new Error(`wheel mismatch: ${p.wheel} vs ${p.words[0]}`);
}

const seen = new Set();
for (const p of PLAN) for (const w of p.words) {
  if (seen.has(w)) throw new Error(`duplicate word across chapter: ${w}`);
  seen.add(w);
}

/* bonus: pick buildable FULL_DICT words (not mains, chapter-unique),
 * 3+ letters only (the user hates fragment-y «چرت» subwords),
 * preferring the corpus ordering (frequency-sorted) */
const corpus = read("public/assets/dict/fa_words.txt").split("\n").filter(Boolean);
const order = new Map(corpus.map((w, i) => [w, i]));
/* unpleasant / odd words that must never surface as hidden bonuses */
const BLOCK = new Set(["وبا", "ورب", "بدر"]);
const usedBonus = new Set();
const levels = PLAN.map((p, i) => {
  const cands = [...dict].filter(
    (w) => w.length >= 3 && !BLOCK.has(w) && !p.words.includes(w) && canBuild(w, p.wheel) && !seen.has(w) && !usedBonus.has(w),
  );
  cands.sort((a, b) => (order.get(a) ?? 9e9) - (order.get(b) ?? 9e9));
  const bonus = cands.slice(0, 3);
  for (const b of bonus) usedBonus.add(b);
  return { id: i + 1, wheel: p.wheel, words: p.words, bonus };
});

/* final validation pass — mirror the runtime rules exactly */
for (const lv of levels) {
  for (const w of [...lv.words, ...lv.bonus]) {
    if (!canBuild(w, lv.wheel)) throw new Error(`not buildable: ${w} from ${lv.wheel}`);
  }
  for (const b of lv.bonus) {
    if (!dict.has(b)) throw new Error(`bonus not in FULL_DICT: ${b}`);
  }
  if (!lv.words.length) throw new Error("empty words");
}
const total = levels.reduce((s, l) => s + l.words.length, 0);
console.log("levels:", levels.length, "main words:", total);
levels.forEach((l, i) => console.log(`  ${(i + 1 + "").padStart(2)} ${l.wheel.padEnd(6)} → ${l.words.join("، ")}  | bonus: ${l.bonus.join("، ")}`));

fs.writeFileSync(path.join(root, "src/game/data/levels/ch01.json"), JSON.stringify(levels, null, 1) + "\n");
console.log("WROTE src/game/data/levels/ch01.json");
