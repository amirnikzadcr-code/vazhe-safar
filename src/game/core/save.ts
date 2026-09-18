/* ------------------------------------------------------------------
 *  واژه‌سفر — core/save.ts
 *  Versioned localStorage persistence. No external backend required.
 * ------------------------------------------------------------------ */
/* v1.20 — in-level snapshot store lives in its own module (no cycle:
 * progress.ts never imports save.ts) */
import { clearAllProgress } from "@/game/core/progress";

export interface LevelRecord {
  stars: number;          // 0..3 best achieved
  bonus: string[];        // bonus words found
  mistakes?: number;      // last-completion mistakes (for stats)
}

export interface SaveData {
  v: number;
  coins: number;
  levels: Record<string, LevelRecord>;   // key `${chapterId}:${levelId}`
  settings: {
    music: boolean;
    sfx: boolean;
    musicVol: number;   // 0..1
    sfxVol: number;     // 0..1
    haptics: boolean;
  };
  tutorialDone: boolean;
  dailyGiftDay: string;  // YYYY-MM-DD of last daily gift
  chests: string[];      // chapter ids whose completion chest was claimed
  last: { ch: number; lv: number } | null; // continue point
  createdAt: number;
  /* --- v1.5 additions --- */
  wordsFound: number;        // lifetime main-word count
  levelsPlayed: number;      // lifetime finished-level count (best-effort)
  bonusTotal: number;        // lifetime bonus words
  missionsClaimed: string[]; // mission ids already redeemed
  challenge: { day: string; done: boolean; streak: number }; // daily challenge
  lastSeen: number;          // epoch ms of previous session end
  welcomeShownDay: string;   // welcome-back shown once per day
  /* --- v2.3 player profile --- */
  profile: {
    name: string;        // "" → the name-ask modal shows on next boot
    avatar: string;      // id from avatars.tsx (cat/fox/panda/…)
  };
  /* --- v3 monetization (Myket / Bazaar readiness) --- */
  adsRemoved: boolean;   // «حذف تبلیغات» purchased (or granted)
  lastRewardedAd: number; // epoch ms of the last rewarded-ad payout (cooldown)
  /* --- v1.20 (session U): GLOBAL bonus-word ledger — a hidden word
   * found in ANY level is never re-awarded in a later level
   * (user: «واژه‌های پنهان رو اگر در مرحله‌های قبل پیدا شده و در
   * مرحله‌های بعد پیدا کرد تکراری حساب بشه») --- */
  bonusAll: string[];
  /* --- EE (session EE): GLOBAL main-word ledger — every TARGET word
   * ever completed in ANY chapter/level. A hidden-word submission that
   * matches it is a duplicate (user: «مراقب باش کلا چ هر فصل باشه چ
   * مرحله کاربر تکراری وارد نکنه») --- */
  mainAll: string[];
}

const KEY = "vazhe_safar_save_v1";

/* v5 — TEST-BUILD FLAG: compile the web bundle with
 * NEXT_PUBLIC_ALL_UNLOCKED=1 and EVERY chapter + level is open so the
 * owner can review all 200 levels (the «تمام مراحل باز» APK).
 * The official release build compiles WITHOUT it → normal locking.
 * Next.js inlines NEXT_PUBLIC_* at build time — nothing to toggle at
 * runtime, the two APKs are byte-distinct products. */
export const ALL_LEVELS_OPEN = process.env.NEXT_PUBLIC_ALL_UNLOCKED === "1";

function fresh(): SaveData {
  return {
    v: 1,
    coins: 120,
    levels: {},
    settings: { music: true, sfx: true, musicVol: 0.8, sfxVol: 0.9, haptics: true },
    tutorialDone: false,
    dailyGiftDay: "",
    chests: [],
    last: null,
    createdAt: Date.now(),
    wordsFound: 0,
    levelsPlayed: 0,
    bonusTotal: 0,
    missionsClaimed: [],
    challenge: { day: "", done: false, streak: 0 },
    lastSeen: 0,
    welcomeShownDay: "",
    profile: { name: "", avatar: "cat" },
    adsRemoved: false,
    lastRewardedAd: 0,
    bonusAll: [],
    mainAll: [],
  };
}

let cache: SaveData | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** fired SYNCHRONOUSLY on every save mutation (see Save.persist) —
 * React bindings (useSave/useCoins) listen to this to refresh live UI */
export const SAVE_EVENT = "vz:save-change";

/* v3 PERF — never lose progress with the debounced writer: the pending
 * write is forced to disk when the app is hidden or closed. Registered
 * once at module load; safe in every environment. */
if (typeof window !== "undefined") {
  const flushNow = () => Save.flush();
  window.addEventListener("visibilitychange", () => { if (document.hidden) flushNow(); });
  window.addEventListener("pagehide", flushNow);
  window.addEventListener("beforeunload", flushNow);
}

export const Save = {
  load(): SaveData {
    if (cache) return cache;
    /* SSR guard (v2.4): the boot shell prerenders on the server — there
     * is no localStorage there; a fresh default is used and the real
     * save loads on the client. */
    if (typeof localStorage === "undefined") return (cache = fresh());
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed && parsed.v === 1) {
          // defensive merge with defaults for forward compatibility
          const f = fresh();
          cache = {
            ...f, ...parsed,
            settings: { ...f.settings, ...(parsed.settings || {}) },
            profile: { ...f.profile, ...(parsed.profile || {}) },
          };
          return cache;
        }
      }
    } catch (e) {
      console.warn("[save] corrupted, resetting", e);
    }
    cache = fresh();
    return cache;
  },

  persist(): void {
    /* v3 PERF — DEBOUNCED (user: «حتی وقتی کلمه حدس زده میشه لگ میزنه»):
     * this used to JSON.stringify the WHOLE save + hit disk on the main
     * thread on EVERY mutation (each found word = countWord + addCoins +
     * bonus checks → 2-3 synchronous writes mid-celebration). On weak
     * phones that's a guaranteed jank spike exactly when a word lands.
     * Now mutations coalesce: at most one write per 900ms, plus a hard
     * flush when the app goes to background / closes (visibilitychange,
     * pagehide, beforeunload) so nothing can be lost.
     * Subscribers ARE notified synchronously (window event) so live UI
     * like the coin pill updates instantly while the disk write waits. */
    if (!cache) return;
    try { window.dispatchEvent(new Event(SAVE_EVENT)); } catch { /* SSR */ }
    if (persistTimer != null) return;
    persistTimer = setTimeout(() => { persistTimer = null; Save.flush(); }, 900);
  },

  /** write NOW (used by the debounce flush + app lifecycle hooks) */
  flush(): void {
    if (!cache) return;
    if (persistTimer != null) { clearTimeout(persistTimer); persistTimer = null; }
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("[save] persist failed", e);
    }
  },

  get data(): SaveData {
    return Save.load();
  },

  /* ---------- mutations ---------- */

  addCoins(n: number): void {
    Save.data.coins = Math.max(0, Save.data.coins + n);
    Save.persist();
  },

  spendCoins(n: number): boolean {
    const d = Save.data;
    if (d.coins < n) return false;
    d.coins -= n;
    Save.persist();
    return true;
  },

  /** record a finished level; returns true if any record updated */
  completeLevel(ch: number, lv: number, stars: number, mistakes: number): boolean {
    const d = Save.data;
    const key = `${ch}:${lv}`;
    const prev = d.levels[key];
    const rec: LevelRecord = {
      stars: Math.max(prev?.stars ?? 0, stars),
      bonus: prev?.bonus ?? [],
      mistakes,
    };
    d.levels[key] = rec;
    d.last = { ch, lv };
    if (!prev) d.levelsPlayed += 1;
    Save.persist();
    return !prev;
  },

  /** count a found main word (lifetime stat) */
  countWord(): void {
    Save.data.wordsFound += 1;
    Save.persist();
  },

  /** count a bonus word (lifetime stat) */
  countBonus(): void {
    Save.data.bonusTotal += 1;
    Save.persist();
  },

  /** daily challenge — one per calendar day */
  today(): string {
    return new Date().toISOString().slice(0, 10);
  },

  completeChallenge(): number {
    const d = Save.data;
    const today = Save.today();
    if (d.challenge.day === today && d.challenge.done) return 0;
    if (d.challenge.day !== today) d.challenge = { day: today, done: false, streak: 0 };
    d.challenge.done = true;
    d.challenge.streak += 1;
    d.coins += 50;
    Save.persist();
    return 50;
  },

  challengeDoneToday(): boolean {
    const d = Save.data;
    return d.challenge.day === Save.today() && d.challenge.done;
  },

  claimMission(id: string, reward: number): boolean {
    const d = Save.data;
    if (d.missionsClaimed.includes(id)) return false;
    d.missionsClaimed.push(id);
    d.coins += reward;
    Save.persist();
    return true;
  },

  markSeen(): void {
    Save.data.lastSeen = Date.now();
    Save.persist();
  },

  addBonusWord(ch: number, lv: number, word: string): boolean {
    const d = Save.data;
    /* v1.20 — DUPLICATE ACROSS LEVELS: the word was already cashed in
     * ANY earlier level → count it as duplicate, no reward
     * (PlayScreen shows the «قبلاً یافتی» toast) */
    if (d.bonusAll.includes(word)) return false;
    const key = `${ch}:${lv}`;
    const rec = d.levels[key] ?? { stars: 0, bonus: [] };
    if (rec.bonus.includes(word)) return false;
    rec.bonus.push(word);
    d.levels[key] = rec;
    d.bonusAll.push(word);   // lifetime ledger (tiny strings)
    Save.persist();
    return true;
  },

  /** EE — remember a MAIN word forever (any chapter / any level). The
   * hidden-word checker refuses to re-award these as bonuses later. */
  noteMainWord(word: string): void {
    const d = Save.data;
    if (d.mainAll.includes(word)) return;
    d.mainAll.push(word);
    Save.persist();
  },

  setSetting<K extends keyof SaveData["settings"]>(k: K, v: SaveData["settings"][K]): void {
    Save.data.settings[k] = v;
    Save.persist();
  },

  markTutorialDone(): void {
    Save.data.tutorialDone = true;
    Save.persist();
  },

  /* ---------- v2.3 profile ---------- */

  setProfile(name: string, avatar: string): void {
    Save.data.profile = { name: name.trim().slice(0, 14) || "مسافر", avatar };
    Save.persist();
  },

  /** lifetime XP — hidden words push it hardest (user: «هرچی کلمات
   * پنهان پیدا کنه یا بره جلو لولش میره بالا») */
  xpTotal(): number {
    const d = Save.data;
    return Save.totalStars() * 15 + d.wordsFound * 3 + d.bonusTotal * 8 + Object.keys(d.levels).length * 40;
  },

  /** level + progress inside the current level. Each level needs a bit
   *  more XP than the previous one (260, +120 per level). */
  levelInfo(): { lvl: number; cur: number; need: number } {
    let xp = Save.xpTotal();
    let lvl = 1;
    let need = 260;
    while (xp >= need) { xp -= need; lvl += 1; need += 120; }
    return { lvl, cur: xp, need };
  },

  setLast(ch: number, lv: number): void {
    Save.data.last = { ch, lv };
    Save.persist();
  },

  claimChest(ch: number): boolean {
    const d = Save.data;
    const id = `c${ch}`;
    if (d.chests.includes(id)) return false;
    d.chests.push(id);
    d.coins += 150;
    Save.persist();
    return true;
  },

  hasChest(ch: number): boolean {
    return Save.data.chests.includes(`c${ch}`);
  },

  /** daily gift — returns coins granted (0 if already taken today) */
  claimDailyGift(): number {
    const d = Save.data;
    const today = new Date().toISOString().slice(0, 10);
    if (d.dailyGiftDay === today) return 0;
    d.dailyGiftDay = today;
    d.coins += 50;
    Save.persist();
    return 50;
  },

  reset(): void {
    cache = fresh();
    Save.persist();
    /* v1.20 — a full reset also wipes every in-level progress snapshot */
    clearAllProgress();
  },

  /* ---------- derived stats ---------- */

  totalStars(): number {
    return Object.values(Save.data.levels).reduce((s, r) => s + r.stars, 0);
  },

  totalWords(): number {
    return Object.keys(Save.data.levels).length;
  },

  totalBonus(): number {
    return Object.values(Save.data.levels).reduce((s, r) => s + r.bonus.length, 0);
  },

  levelsDoneInChapter(ch: number): number {
    /* v1.18 — chapter size matches levelsIndex.lvPerCh (10 → 12 in the
     * hard tier); kept in sync locally to avoid a data-layer import */
    const n = ch >= 11 ? 12 : 10;
    let done = 0;
    for (let lv = 1; lv <= n; lv++) if (Save.data.levels[`${ch}:${lv}`]) done++;
    return done;
  },

  chapterUnlocked(ch: number): boolean {
    if (ALL_LEVELS_OPEN) return true;
    if (ch === 1) return true;
    return Save.levelsDoneInChapter(ch - 1) >= 7;
  },

  levelUnlocked(ch: number, lv: number): boolean {
    if (ALL_LEVELS_OPEN) return true;
    if (!Save.chapterUnlocked(ch)) return false;
    if (lv === 1) return true;
    return !!Save.data.levels[`${ch}:${lv - 1}`];
  },
};

export const COSTS = { hint: 80 } as const;
export const REWARDS = {
  perWord: 5,
  perBonus: 15,
  perStar: 20,
  dailyGift: 50,
  chest: 150,
} as const;

/** chapter completion requires >=7 of its levels */
export const CHAPTER_UNLOCK_THRESHOLD = 7;
