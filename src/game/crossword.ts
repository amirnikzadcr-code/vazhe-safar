/* ------------------------------------------------------------------
 *  واژه‌سفر — crossword.ts
 *  Deterministic RTL-aware crossword layout generator.
 *  Persian reads right→left, so horizontal words grow leftwards from
 *  their anchor column. Layout is fully validated: every maximal run
 *  of ≥2 letters (horizontal or vertical) must be exactly one of the
 *  level's target words — no fake words may appear on the board.
 * ------------------------------------------------------------------ */
import { letters, rng, shuffle } from "./core/utils";

export interface Placement {
  word: string;
  r: number;          // row of FIRST letter
  c: number;          // col of FIRST letter
  dir: "h" | "v";     // h = first letter rightmost, grows left
}

export interface CrosswordLayout {
  rows: number;
  cols: number;
  grid: (string | null)[][];   // [r][c]
  placements: Placement[];
}

type Cell = { ch: string };

function buildGrid(n: number): (Cell | null)[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null));
}

/** extract all maximal runs (len ≥ 2).
 *  Horizontal runs are read left→right from the grid, but words are stored
 *  RTL (first letter rightmost) → reverse them to get the logical word.
 *  Vertical runs grow top→bottom in logical order → keep as-is. */
function allRuns(grid: (Cell | null)[][]): string[] {
  const rows = grid.length, cols = grid[0].length;
  const runs: string[] = [];
  for (let r = 0; r < rows; r++) {
    let cur = "";
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c]?.ch ?? "";
      if (ch) cur += ch;
      else { if (cur.length >= 2) runs.push([...cur].reverse().join("")); cur = ""; }
    }
    if (cur.length >= 2) runs.push([...cur].reverse().join(""));
  }
  for (let c = 0; c < cols; c++) {
    let cur = "";
    for (let r = 0; r < rows; r++) {
      const ch = grid[r][c]?.ch ?? "";
      if (ch) cur += ch;
      else { if (cur.length >= 2) runs.push(cur); cur = ""; }
    }
    if (cur.length >= 2) runs.push(cur);
  }
  return runs;
}

/** every run must be exactly one of the words; every word used exactly once */
function validate(grid: (Cell | null)[][], words: string[]): boolean {
  const runs = allRuns(grid);
  if (runs.length !== words.length) return false;
  const set = new Set(words);
  const seen = new Set<string>();
  for (const run of runs) {
    if (!set.has(run) || seen.has(run)) return false;
    seen.add(run);
  }
  return seen.size === words.length;
}

function commit(grid: (Cell | null)[][], p: Placement): void {
  const ls = letters(p.word);
  for (let i = 0; i < ls.length; i++) {
    const r = p.dir === "v" ? p.r + i : p.r;
    const c = p.dir === "h" ? p.c - i : p.c;
    grid[r][c] = { ch: ls[i] };
  }
}

/** remove a placement's cells that are not shared with `keep` placements */
function uncommit(grid: (Cell | null)[][], p: Placement, keep: Placement[]): void {
  const owned = new Set<string>();
  for (const q of keep) {
    const ls = letters(q.word);
    for (let i = 0; i < ls.length; i++) {
      const r = q.dir === "v" ? q.r + i : q.r;
      const c = q.dir === "h" ? q.c - i : q.c;
      owned.add(`${r},${c}`);
    }
  }
  const ls = letters(p.word);
  for (let i = 0; i < ls.length; i++) {
    const r = p.dir === "v" ? p.r + i : p.r;
    const c = p.dir === "h" ? p.c - i : p.c;
    if (!owned.has(`${r},${c}`)) grid[r][c] = null;
  }
}

/** all syntactically valid candidate placements for `word` */
function allCandidates(grid: (Cell | null)[][], word: string, needInter: boolean): Placement[] {
  const rows = grid.length, cols = grid[0].length;
  const ls = letters(word);
  const L = ls.length;
  const out: Placement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const dir of ["h", "v"] as const) {
        if (dir === "h" && c - (L - 1) < 0) continue;
        if (dir === "v" && r + L - 1 >= rows) continue;
        let inter = 0, ok = true;
        for (let i = 0; i < L; i++) {
          const rr = dir === "v" ? r + i : r;
          const cc = dir === "h" ? c - i : c;   // RTL: grow leftwards
          const ex = grid[rr][cc];
          if (ex) {
            if (ex.ch !== ls[i]) { ok = false; break; }
            inter++;
          }
        }
        if (!ok) continue;
        // boundary cells (before start / after end) must be empty
        const bR = dir === "v" ? r - 1 : r;
        const bC = dir === "h" ? c + 1 : c;
        const aR = dir === "v" ? r + L : r;
        const aC = dir === "h" ? c - L : c;
        const inB = bR >= 0 && bR < rows && bC >= 0 && bC < cols;
        const inA = aR >= 0 && aR < rows && aC >= 0 && aC < cols;
        if ((inB && grid[bR][bC]) || (inA && grid[aR][aC])) continue;
        if (needInter && inter === 0) continue;
        out.push({ word, r, c, dir });
      }
    }
  }
  return out;
}

function attempt(words: string[], seed: number): CrosswordLayout | null {
  const rand = rng(seed);
  const sorted = [...words].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const maxLen = Math.max(...sorted.map((w) => w.length));
  const N = maxLen * 2 + Math.max(8, sorted.length * 2 + 2);
  const grid = buildGrid(N);

  const first = sorted[0];
  const startP: Placement = { word: first, r: 3, c: N - 4, dir: "h" };
  commit(grid, startP);
  const placements: Placement[] = [startP];

  for (const w of shuffle(sorted.slice(1), rand)) {
    let placed = false;
    const cands = allCandidates(grid, w, true);
    for (const p of shuffle(cands, rand)) {
      commit(grid, p);
      if (validate(grid, [...placements.map((q) => q.word), w])) {
        placements.push(p); placed = true; break;
      }
      uncommit(grid, p, placements);
    }
    if (!placed) {
      // island fallback — allowed, board may have disconnected clusters
      const cands2 = allCandidates(grid, w, false);
      for (const p of shuffle(cands2, rand)) {
        commit(grid, p);
        if (validate(grid, [...placements.map((q) => q.word), w])) {
          placements.push(p); placed = true; break;
        }
        uncommit(grid, p, placements);
      }
      if (!placed) return null;
    }
  }
  if (!validate(grid, sorted)) return null;

  // normalize to bounding box
  let minR = N, minC = N, maxR = -1, maxC = -1;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const out: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null as string | null));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out[r][c] = grid[r + minR][c + minC]?.ch ?? null;
  return {
    rows, cols, grid: out,
    placements: placements.map((p) => ({ ...p, r: p.r - minR, c: p.c - minC })),
  };
}

/** compactness score — lower is better: area + island penalty */
function layoutScore(l: CrosswordLayout): { score: number; islands: number } {
  const area = l.rows * l.cols;
  // count connected components (islands) via flood fill
  const seen = new Set<string>();
  let islands = 0;
  for (let r = 0; r < l.rows; r++) {
    for (let c = 0; c < l.cols; c++) {
      if (!l.grid[r][c] || seen.has(`${r},${c}`)) continue;
      islands++;
      const stack = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        const k = `${cr},${cc}`;
        if (seen.has(k) || !l.grid[cr]?.[cc]) continue;
        seen.add(k);
        stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
      }
    }
  }
  return { score: area + islands * 500, islands };
}

/** Generate a validated layout; samples several seeds and returns the most
 *  compact board (avoids scattered island-heavy layouts). */
export function makeCrossword(words: string[], levelSeed: number): CrosswordLayout | null {
  let best: CrosswordLayout | null = null;
  let bestScore = Infinity;
  let bestIslands = Infinity;
  for (let i = 0; i < 48; i++) {
    const res = attempt(words, levelSeed * 7919 + i * 104729 + 13);
    if (!res) continue;
    const { score, islands } = layoutScore(res);
    if (score < bestScore) { bestScore = score; best = res; bestIslands = islands; }
    // single compact island — good enough, stop early to keep loading snappy
    if (bestIslands === 1 && bestScore <= 160) break;
  }
  return best;
}
