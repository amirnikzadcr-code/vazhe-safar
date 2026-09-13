/* ------------------------------------------------------------------
 *  واژه‌سفر — core/save.ts
 *  Versioned localStorage persistence. No external backend required.
 * ------------------------------------------------------------------ */
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
}

const KEY = "vazhe_safar_save_v1";

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
  };
}

let cache: SaveData | null = null;

export const Save = {
  load(): SaveData {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed && parsed.v === 1) {
          // defensive merge with defaults for forward compatibility
          cache = { ...fresh(), ...parsed, settings: { ...fresh().settings, ...(parsed.settings || {}) } };
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
    if (!cache) return;
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
    const key = `${ch}:${lv}`;
    const rec = d.levels[key] ?? { stars: 0, bonus: [] };
    if (rec.bonus.includes(word)) return false;
    rec.bonus.push(word);
    d.levels[key] = rec;
    Save.persist();
    return true;
  },

  setSetting<K extends keyof SaveData["settings"]>(k: K, v: SaveData["settings"][K]): void {
    Save.data.settings[k] = v;
    Save.persist();
  },

  markTutorialDone(): void {
    Save.data.tutorialDone = true;
    Save.persist();
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
    let n = 0;
    for (let lv = 1; lv <= 10; lv++) if (Save.data.levels[`${ch}:${lv}`]) n++;
    return n;
  },

  chapterUnlocked(ch: number): boolean {
    if (ch === 1) return true;
    return Save.levelsDoneInChapter(ch - 1) >= 7;
  },

  levelUnlocked(ch: number, lv: number): boolean {
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

/** chapter completion requires >=7 of 10 levels */
export const CHAPTER_UNLOCK_THRESHOLD = 7;
