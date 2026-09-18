#!/usr/bin/env node
/* ------------------------------------------------------------------
 * واژه‌سفر — gen_party_wheels.mjs  (session GG)
 *
 * The «مهندسی شده» دورهمی wheel factory (user: «کلمات بیشتری ک قابل
 * جمله ساختن زیاده بزار و مهندسی شده بکن هر دور متفاوت باشه»).
 *
 * OFFLINE generator → ships as src/game/data/party_wheels.json so the
 * phone pays ZERO runtime cost:
 *   1. anchors  = every curated 5..7-letter word
 *   2. wheel    = anchor letters + 2 GREEDY extra letters (chosen from
 *                 the top-frequency Persian letters to maximize yield)
 *   3. score    = every curated word buildable from the wheel,
 *                 weighted toward longer words
 *   4. quality gates: ≥ MIN_TOTAL buildables, ≥ MIN_LONG 4+ letter
 *      buildables → only rich wheels survive
 *   5. dedupe by letter signature → diverse, non-repeating pool
 *
 * Output wheels carry their FULL buildable word list (sorted longest
 * first) — the game accepts even MORE words at runtime because every
 * submission is also validated against the full dictionary + corpus.
 * ------------------------------------------------------------------ */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "/home/z/my-project";
const DICTS = [
  `${ROOT}/src/game/data/dictionary.ts`,
  `${ROOT}/src/game/data/dictionary_extra.ts`,
  `${ROOT}/src/game/data/dictionary_party.ts`,
  `${ROOT}/src/game/data/dictionary_hidden.ts`,
];

/* ---------- 1. load every curated word ---------- */
const raw = new Set();
for (const f of DICTS) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/"([^"]+)"/g)) raw.add(m[1]);
}

const OK = /^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]+$/;
const words = [];
for (const w0 of raw) {
  const w = w0.trim();
  if (w.length < 2 || w.length > 8) continue;
  if (!OK.test(w)) continue;
  words.push(w);
}
console.log(`curated words usable: ${words.length}`);

/* ---------- 2. letter alphabet + frequency ---------- */
const freq = new Map();
for (const w of words) for (const ch of w) freq.set(ch, (freq.get(ch) ?? 0) + 1);
const ALPHA = [...freq.keys()];
const idxOf = new Map(ALPHA.map((c, i) => [c, i]));
const EXTRAS = [...freq.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 16)
  .map(([c]) => c);
console.log(`alphabet ${ALPHA.length} letters — extras: ${EXTRAS.join(" ")}`);

/* ---------- 3. word index: bitmask + counts ---------- */
function counts(w) {
  const c = new Uint8Array(ALPHA.length);
  for (const ch of w) c[idxOf.get(ch)]++;
  return c;
}
function mask(w) {
  let m = 0;
  for (const ch of w) m |= 1 << idxOf.get(ch);
  return m;
}
const W = words.map((w) => ({ w, len: w.length, m: mask(w), c: counts(w) }));
const weights = W.map((x) => (x.len <= 3 ? 1 : x.len <= 5 ? 2.2 : 4.5)); /* longer = juicier */

function scoreWheel(c, wm) {
  let total = 0, longWords = 0;
  const list = [];
  for (let i = 0; i < W.length; i++) {
    const x = W[i];
    if ((x.m & ~wm) !== 0) continue; /* letter-set superset fast reject */
    let ok = true;
    for (let k = 0; k < c.length; k++) {
      if (x.c[k] > c[k]) { ok = false; break; }
    }
    if (!ok) continue;
    total += weights[i];
    if (x.len >= 4) longWords++;
    list.push(x.w);
  }
  return { total, longWords, list };
}

/* ---------- 4. candidates: anchor + 2 greedy extras ---------- */
const MIN_TOTAL = 46;    /* weighted score floor (~30+ real words)  */
const MIN_LONG = 7;      /* at least 7 buildable 4+ letter words    */
const POOL = 140;        /* final shipped wheel count               */

const anchors = words.filter((w) => w.length >= 5 && w.length <= 7);
console.log(`anchors: ${anchors.length}`);

const cands = [];
for (let ai = 0; ai < anchors.length; ai++) {
  const a = anchors[ai];
  const base = counts(a);
  const bm = mask(a);
  let best = null;
  for (const e1 of EXTRAS) {
    const c1 = base.slice();
    c1[idxOf.get(e1)]++;
    const m1 = bm | (1 << idxOf.get(e1));
    /* greedy second extra (fast approx: reuse score of step 1 pick is
     * not enough — evaluate the top few e2 choices directly) */
    for (const e2 of EXTRAS) {
      const c2 = c1.slice();
      c2[idxOf.get(e2)]++;
      if (c2[idxOf.get(e2)] > 4) continue; /* no letter spam */
      const m2 = m1 | (1 << idxOf.get(e2));
      const r = scoreWheel(c2, m2);
      if (r.longWords < MIN_LONG) continue;
      if (!best || r.total > best.r.total) best = { e1, e2, r, c: c2, m: m2 };
    }
  }
  if (best && best.r.total >= MIN_TOTAL) {
    const letters = [];
    for (let k = 0; k < ALPHA.length; k++) for (let n = 0; n < best.c[k]; n++) letters.push(ALPHA[k]);
    cands.push({ sig: letters.slice().sort().join(""), ls: letters.join(""), score: best.r.total, list: best.r.list });
  }
}
console.log(`candidates passing gates: ${cands.length}`);

/* ---------- 5. dedupe + diversity + cap ---------- */
cands.sort((x, y) => y.score - x.score);
const seen = new Set();
const picked = [];
for (const cd of cands) {
  if (seen.has(cd.sig)) continue;
  /* keep the pool visually diverse: no wheel shares >5 letters with the
   * previous pick in order (cheap spread heuristic) */
  if (picked.length) {
    const prev = picked[picked.length - 1].sig;
    let shared = 0;
    for (const ch of cd.sig) if (prev.includes(ch)) shared++;
    if (shared >= cd.sig.length - 1) continue;
  }
  seen.add(cd.sig);
  picked.push(cd);
  if (picked.length >= POOL) break;
}
console.log(`shipped wheels: ${picked.length}`);

/* ---------- 6. write JSON (words longest-first) ----------
 * The list is a QUICK-ACCEPT cache only — every submission is ALSO
 * validated against the full runtime dictionary, so capping the list
 * at the 180 juiciest (longest) words per wheel loses nothing while
 * keeping the bundle small. */
const MAX_LIST = 180;
const byLen = (a, b) => b.length - a.length || a.localeCompare(b, "fa");
const out = picked.map((p) => ({ ls: p.ls, words: p.list.sort(byLen).slice(0, MAX_LIST) }));
writeFileSync(`${ROOT}/src/game/data/party_wheels.json`, JSON.stringify({ v: 1, wheels: out }, null, 0));
const sizes = out.map((o) => o.words.length);
console.log(`words/wheel  min=${Math.min(...sizes)}  avg=${Math.round(sizes.reduce((s, n) => s + n, 0) / sizes.length)}  max=${Math.max(...sizes)}`);
console.log(`written → src/game/data/party_wheels.json`);
