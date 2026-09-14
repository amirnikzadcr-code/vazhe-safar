/* ------------------------------------------------------------------
 *  واژه‌سفر — data/chapters.ts  (v2.4 — session O)
 *  Per-chapter identity: title, poem line, background, palette,
 *  procedural Persian music config. Consumed by the React UI.
 *  • 20 chapters now (user: «۱۰ فصل جدید سخت اضافه بکن») — chapters
 *    11-20 are the HARD tier (bigger wheels, more words).
 *  • every chapter plays its OWN rendered track (chXX.ogg)
 *  • MENU_MUSIC / PARTY_MUSIC — per-section themes (user request)
 * ------------------------------------------------------------------ */
import { MusicConfig, SCALES, ScaleName } from "../core/audio";

export interface ChapterTheme {
  id: number;
  title: string;         // Persian chapter title
  subtitle: string;      // poetic one-liner
  bg: string;            // /assets/bg/chXX.webp — play-screen backdrop
  accent: string;        // UI accent (buttons, highlights)
  accent2: string;
  /** map realm palette: sky gradient (top), land gradient (bottom),
   *  gate-band gradient (the ornamental border between chapters) */
  realm: { sky: [string, string]; land: [string, string]; gate: [string, string] };
  music: MusicConfig & { scale: ScaleName };
  finaleText: string;    // poem line on chapter-complete screen
}

export const CHAPTERS: ChapterTheme[] = [
  {
    id: 1,
    title: "باغِ نخستین",
    subtitle: "جایی که سفر با شکوفه‌های بهاری آغاز می‌شود",
    bg: "/assets/bg/ch01.webp",
    accent: "#2e9e6b", accent2: "#ffd76e",
    realm: { sky: ["#9fe0ff", "#eaf9ff"], land: ["#b2eb90", "#77c95e"], gate: ["#43a862", "#2e8450"] },
    music: { track: "ch01", scale: "mahur", root: 293.66, cents: [], bpm: 92, meter: 4, perc: "daf", lead: "santur", octave: 1, drone: 0.45,
      motif: [[0,1],[2,1],[4,1],[5,2],[4,1],[3,1],[2,1],[1,1],[0,2],[-1,1],[2,1],[3,1],[1,1]],
      motifB: [[4,1],[3,1],[2,1],[1,1],[0,2],[-1,1],[1,1],[0,3]],
      },
    finaleText: "باغ به کامل‌ترین شکوفایی‌اش رسید؛ گل‌ها همه‌جا شکفتند.",
  },
  {
    id: 2,
    title: "دشتِ گل‌ها",
    subtitle: "چمن‌زارِ شورانگیز، آبشار و پروانه‌ها در نورِ بهاری",
    bg: "/assets/bg/ch02.webp",
    accent: "#3fae5c", accent2: "#ff8fb0",
    realm: { sky: ["#aee9ff", "#eafcff"], land: ["#9fe08a", "#4fae58"], gate: ["#3fae5c", "#2e8450"] },
    music: { track: "ch02", scale: "shur", root: 261.63, cents: [], bpm: 96, meter: 6, perc: "tombak", lead: "santur", octave: 0, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,1],[1,0.5],[0,0.5],[2,1],[3,1],[-1,0.5],[2,0.5],[1,1],[0,1.5],[-1,0.5],[1,1],[2,0.5],[1,0.5]],
      motifB: [[2,0.5],[1,0.5],[0,1],[-1,0.5],[1,1],[0,1.5],[2,0.5],[1,0.5],[0,1.5]],
      },
    finaleText: "دشتِ گل‌ها پذیرایمان شد؛ رنگ‌ها تا افق ادامه داشتند.",
  },
  {
    id: 3,
    title: "کویرِ زرین",
    subtitle: "کاروان در افق، و آسمانی که سرخ‌طلایی می‌شود",
    bg: "/assets/bg/ch03.webp",
    accent: "#e89b3a", accent2: "#ff8a5e",
    realm: { sky: ["#ffc98c", "#ffe9c4"], land: ["#f2cd8e", "#dba45f"], gate: ["#e89b3a", "#c47a1e"] },
    music: { track: "ch03", scale: "dashti", root: 220.0, cents: [], bpm: 72, meter: 4, perc: "tombak", lead: "ney", octave: 0, drone: 0.6,
      motif: [[0,2],[1,0.5],[2,0.5],[1,1],[0,2],[-1,1],[4,1],[3,1],[2,2],[1,1],[0,3]],
      motifB: [[3,1],[2,1],[1,2],[0,2],[-1,1],[1,1],[0,3]],
      },
    finaleText: "شب که فرارسید، دور آتشِ کاروان حلقه زدیم؛ آسمان پر از ستاره شد.",
  },
  {
    id: 4,
    title: "جنگلِ مه‌آلود",
    subtitle: "نور از میان شاخه‌ها می‌لغزد و کرم‌های شب‌تاب بیدار می‌شوند",
    bg: "/assets/bg/ch04.webp",
    accent: "#3a9e6e", accent2: "#d4ff8f",
    realm: { sky: ["#a8d8c8", "#e2f4ea"], land: ["#57a878", "#337c50"], gate: ["#3a9e6e", "#25754d"] },
    music: { track: "ch04", scale: "nava", root: 246.94, cents: [], bpm: 60, meter: 6, perc: "none", lead: "ney", octave: 0, drone: 0.7,
      motif: [[0,1],[2,1],[3,1.5],[2,0.5],[1,1],[0,1.5],[-1,0.5],[1,1],[2,2],[0,1.5]],
      motifB: [[3,1],[2,1],[1,1],[0,1.5],[-1,0.5],[1,1],[0,3]],
      },
    finaleText: "مه گشوده شد و ستون‌های نور از میان درختان فرود آمدند.",
  },
  {
    id: 5,
    title: "قلعهٔ کوهستانی",
    subtitle: "بر فراز ابرها، پرچم‌ها در باد می‌رقصند",
    bg: "/assets/bg/ch05.webp",
    accent: "#5e83ad", accent2: "#ffd98a",
    realm: { sky: ["#a8ccff", "#e8f2ff"], land: ["#9ab4cc", "#708aa4"], gate: ["#5e83ad", "#41638a"] },
    music: { track: "ch05", scale: "chahargah", root: 293.66, cents: [], bpm: 100, meter: 4, perc: "daf", lead: "kamancheh", octave: 1, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,1],[3,1],[2,0.5],[1,0.5],[4,1],[5,1],[-1,0.5],[4,1],[3,1],[2,1],[3,1],[2,1],[1,1],[0,2]],
      motifB: [[5,0.5],[4,0.5],[3,1],[2,1],[1,1],[0,1.5],[-1,0.5],[2,1],[0,2.5]],
      },
    finaleText: "خورشید از پشت قله برآمد و برف‌ها طلایی شدند.",
  },
  {
    id: 6,
    title: "شهرِ بادگیرها",
    subtitle: "شهرِ گِل، چراغ‌به‌چراغ در آستانهٔ شب",
    bg: "/assets/bg/ch06.webp",
    accent: "#c98a4b", accent2: "#7ec8c0",
    realm: { sky: ["#ffcf9e", "#fff0e0"], land: ["#e8b183", "#c78c55"], gate: ["#c98a4b", "#a56a30"] },
    music: { track: "ch06", scale: "homayun", root: 261.63, cents: [], bpm: 76, meter: 4, perc: "tombak", lead: "ney", octave: 0, drone: 0.6,
      motif: [[0,1],[1,1],[2,2],[1,1],[0,1],[-1,1],[3,1],[4,2],[3,1],[2,1],[1,2],[0,1]],
      motifB: [[4,1],[3,1],[2,1],[1,1],[0,2],[-1,1],[2,1],[1,1],[0,2]],
      },
    finaleText: "غروب که رسید، تمام پنجره‌های شهر یک‌باره جان گرفتند.",
  },
  {
    id: 7,
    title: "ساحلِ مروارید",
    subtitle: "لنج‌ها روی آبِ فیروزه‌ای، آرام مانند واژه‌ها",
    bg: "/assets/bg/ch07.webp",
    accent: "#22a8a0", accent2: "#ff9f7e",
    realm: { sky: ["#90e2ff", "#e4faff"], land: ["#f4e4bc", "#e6cc96"], gate: ["#22a8a0", "#157f79"] },
    music: { track: "ch07", scale: "rast", root: 293.66, cents: [], bpm: 90, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.45,
      motif: [[0,0.5],[2,0.5],[3,1],[4,1],[-1,0.5],[4,0.5],[5,1],[4,0.5],[3,0.5],[2,1],[3,1],[-1,0.5],[2,0.5],[1,1],[0,1.5]],
      motifB: [[4,0.5],[3,0.5],[2,1],[1,1],[0,1.5],[-1,0.5],[3,0.5],[2,0.5],[1,1],[0,1.5]],
      },
    finaleText: "باد آمد، بادبان‌ها برخاستند و لنج‌ها روانِ دریا شدند.",
  },
  {
    id: 8,
    title: "روستای پلکانی",
    subtitle: "خانه‌ها یکی‌یکی روی دوشِ کوه روشن می‌شوند",
    bg: "/assets/bg/ch08.webp",
    accent: "#8a6a45", accent2: "#7adcb0",
    realm: { sky: ["#b8d8ff", "#f0f7ff"], land: ["#96c47e", "#649e52"], gate: ["#6f9e4a", "#4e7a34"] },
    music: { track: "ch08", scale: "abuata", root: 220.0, cents: [], bpm: 66, meter: 4, perc: "tombak", lead: "kamancheh", octave: 0, drone: 0.65,
      motif: [[0,2],[1,1],[2,1],[1,1],[0,2],[-1,1],[3,1],[2,1],[1,2],[0,3]],
      motifB: [[2,1],[1,1],[0,2],[-1,1],[1,1],[0,3]],
      },
    finaleText: "ساعتِ آبی؛ همهٔ پنجره‌های روستا مثل ستاره‌ها روشن شدند.",
  },
  {
    id: 9,
    title: "شبِ ستاره‌ها",
    subtitle: "در سکوتِ کویر، صورت‌های فلکی یکی‌یکی جان می‌گیرند",
    bg: "/assets/bg/ch09.webp",
    accent: "#4a5fa5", accent2: "#ffd76e",
    realm: { sky: ["#26386e", "#46558e"], land: ["#2e3f70", "#1c2a50"], gate: ["#4a5fa5", "#33437c"] },
    music: { track: "ch09", scale: "segah", root: 220.0, cents: [], bpm: 56, meter: 4, perc: "none", lead: "ney", octave: 0, drone: 0.75,
      motif: [[0,1.5],[1,0.5],[2,2],[1,1],[0,2],[-1,1],[3,1],[2,1],[1,1.5],[0,2.5]],
      motifB: [[2,1],[1,1],[0,2],[-1,2],[0,1],[1,1],[0,3]],
      },
    finaleText: "شهاب‌ها آسمان را دو نیم کردند؛ آرزو کن!",
  },
  {
    id: 10,
    title: "باغِ واژه‌ها",
    subtitle: "پایانِ سفرِ نخست، آغازِ جشنی بزرگ در باغ نور",
    bg: "/assets/bg/ch10.webp",
    accent: "#9a6fd0", accent2: "#ff9fb8",
    realm: { sky: ["#7a58c0", "#b48ae0"], land: ["#5cb06e", "#2f8f4e"], gate: ["#9a6fd0", "#7550a8"] },
    music: { track: "ch10", scale: "mahur", root: 329.63, cents: [], bpm: 104, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,0.5],[3,0.5],[4,1],[5,0.5],[4,0.5],[5,1],[4,0.5],[3,0.5],[2,1],[3,0.5],[2,0.5],[1,1],[0,1]],
      motifB: [[5,0.5],[4,0.5],[3,0.5],[2,0.5],[1,1],[0,1],[-1,0.5],[2,0.5],[1,0.5],[0,1.5],[4,0.5],[3,0.5],[2,0.5],[1,0.5],[0,1]],
      },
    finaleText: "آتش‌بازی بر فراز باغ؛ سفرِ نخست به زیباترین شکل کامل شد!",
  },
  /* ================= HARD TIER — chapters 11-20 (session O) ================= */
  {
    id: 11,
    title: "جنگلِ ابرها",
    subtitle: "بالای ابرها، پل‌های بستی میان درختان کهن",
    bg: "/assets/bg/ch11.webp",
    accent: "#2f8f7a", accent2: "#a7f3d0",
    realm: { sky: ["#b8ecdf", "#eafcf5"], land: ["#59b98d", "#2e7d5e"], gate: ["#2f8f7a", "#1d6353"] },
    music: { track: "ch11", scale: "shur", root: 246.94, cents: [], bpm: 84, meter: 6, perc: "daf", lead: "ney", octave: 0, drone: 0.6,
      motif: [[0,1],[1,0.5],[2,1],[3,0.5],[2,1],[1,1],[4,1.5],[3,0.5],[2,1],[1,1],[0,2]],
      motifB: [[3,0.5],[2,0.5],[1,1],[0,1.5],[-1,0.5],[2,1],[1,1],[0,2]],
      },
    finaleText: "از فراز جنگلِ ابرها، دنیا مثل یک نقاشی آرام بود.",
  },
  {
    id: 12,
    title: "دریاچهٔ ماه",
    subtitle: "نیلوفرهای شب‌تاب روی آبِ نقره‌فام",
    bg: "/assets/bg/ch12.webp",
    accent: "#4a6fa5", accent2: "#bfe3ff",
    realm: { sky: ["#2b3f74", "#4a5f96"], land: ["#3a5a8c", "#23395e"], gate: ["#4a6fa5", "#2d4670"] },
    music: { track: "ch12", scale: "segah", root: 220.0, cents: [], bpm: 64, meter: 6, perc: "tombak", lead: "santur", octave: 0, drone: 0.7,
      motif: [[0,1.5],[1,0.5],[2,1],[3,1],[2,1.5],[1,0.5],[0,2],[-1,0.5],[1,1.5],[0,2.5]],
      motifB: [[2,1],[3,1],[2,1],[1,1.5],[0,1.5],[-1,0.5],[0,2.5]],
      },
    finaleText: "ماه روی دریاچه پخش شد و نیلوفرها گواهِ واژه‌های ما بودند.",
  },
  {
    id: 13,
    title: "غارِ بلور",
    subtitle: "دریای بلورِ بنفش، زیر گنبدِ کبودِ زمین",
    bg: "/assets/bg/ch13.webp",
    accent: "#7a58c0", accent2: "#7ff0e0",
    realm: { sky: ["#3d2a63", "#6a4a9e"], land: ["#4a3573", "#2b1c49"], gate: ["#7a58c0", "#533a85"] },
    music: { track: "ch13", scale: "nava", root: 233.08, cents: [], bpm: 70, meter: 4, perc: "tombak", lead: "kamancheh", octave: 0, drone: 0.72,
      motif: [[0,1],[2,0.5],[3,1],[4,1.5],[3,0.5],[2,1],[1,1],[2,1.5],[0,2]],
      motifB: [[4,1],[3,1],[2,1.5],[1,0.5],[0,2],[-1,0.5],[1,1],[0,2.5]],
      },
    finaleText: "بلورها آوای ما را چند برابر کردند؛ غار پر از نور شد.",
  },
  {
    id: 14,
    title: "تپه‌های سرخ",
    subtitle: "شکاف‌های سرخ‌نارنجی در آفتابِ اوایلِ غروب",
    bg: "/assets/bg/ch14.webp",
    accent: "#d96a3a", accent2: "#ffd76e",
    realm: { sky: ["#ffb27a", "#ffe3c2"], land: ["#e08a52", "#b25327"], gate: ["#d96a3a", "#a84418"] },
    music: { track: "ch14", scale: "chahargah", root: 293.66, cents: [], bpm: 108, meter: 4, perc: "daf", lead: "santur", octave: 1, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,0.5],[3,0.5],[4,1],[3,0.5],[2,0.5],[3,1],[2,0.5],[1,0.5],[2,1],[0,1.5]],
      motifB: [[4,0.5],[5,0.5],[4,0.5],[3,0.5],[2,1],[1,1],[0,1.5],[-1,0.5],[0,2]],
      },
    finaleText: "تپه‌های سرخ تا افق دویدند و خورشید میان‌شان نشست.",
  },
  {
    id: 15,
    title: "باغِ آسمانی",
    subtitle: "جزیره‌های معلق و آبشارهایی که به ابر می‌ریزند",
    bg: "/assets/bg/ch15.webp",
    accent: "#3fa0d9", accent2: "#ffc2e0",
    realm: { sky: ["#a8dcff", "#eaf9ff"], land: ["#8fd0a8", "#4a9e78"], gate: ["#3fa0d9", "#2478a8"] },
    music: { track: "ch15", scale: "mahur", root: 329.63, cents: [], bpm: 96, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.45,
      motif: [[0,0.5],[2,0.5],[4,1],[5,1],[4,0.5],[3,0.5],[4,1],[2,1],[1,0.5],[0,1.5],[-1,0.5],[0,2]],
      motifB: [[5,0.5],[4,0.5],[3,1],[2,1],[1,1],[0,2],[-1,0.5],[1,0.5],[0,2]],
      },
    finaleText: "میان جزیره‌های معلق پرواز کردیم؛ رنگین‌کمان راهنمای ما بود.",
  },
  {
    id: 16,
    title: "دریای مرجان",
    subtitle: "مرجان‌ها و مرواریدها در آبِ شفافِ فیروزه",
    bg: "/assets/bg/ch16.webp",
    accent: "#18a8b8", accent2: "#ff9f7e",
    realm: { sky: ["#8ae8ff", "#e0fbff"], land: ["#f2e4bc", "#d9c48e"], gate: ["#18a8b8", "#0c7a88"] },
    music: { track: "ch16", scale: "rast", root: 261.63, cents: [], bpm: 94, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.42,
      motif: [[0,0.5],[1,0.5],[2,1],[4,0.5],[3,0.5],[4,1],[5,1],[4,0.5],[3,0.5],[2,1],[1,1],[0,1.5]],
      motifB: [[4,0.5],[5,0.5],[4,0.5],[3,1],[2,1],[3,0.5],[2,0.5],[1,1],[0,2]],
      },
    finaleText: "مرواریدِ واژه‌ها را از دلِ مرجان‌ها بیرون کشیدیم.",
  },
  {
    id: 17,
    title: "شهرِ طلا",
    subtitle: "ستون‌ها و کاخ‌های زرین در نورِ آخرِ روز",
    bg: "/assets/bg/ch17.webp",
    accent: "#c9922e", accent2: "#ffe08a",
    realm: { sky: ["#ffd98c", "#fff2d0"], land: ["#e8bc6e", "#c08a3a"], gate: ["#c9922e", "#96691a"] },
    music: { track: "ch17", scale: "homayun", root: 246.94, cents: [], bpm: 80, meter: 4, perc: "tombak", lead: "kamancheh", octave: 0, drone: 0.6,
      motif: [[0,1],[1,1],[2,1],[3,1.5],[2,0.5],[1,1],[4,1],[3,1],[2,1.5],[0,2]],
      motifB: [[3,1],[4,1],[3,1],[2,1],[1,1.5],[0,1.5],[-1,0.5],[0,2.5]],
      },
    finaleText: "شهرِ طلا واژه‌ها را به بزرگ‌ترین بانگِ خود آویخت.",
  },
  {
    id: 18,
    title: "کوهِ شفق",
    subtitle: "شفقِ سبز و بنفش بر فراز قله‌های برفی",
    bg: "/assets/bg/ch18.webp",
    accent: "#3a8fa5", accent2: "#9fefc9",
    realm: { sky: ["#1e3a5c", "#3d6a8c"], land: ["#4a7a96", "#28495e"], gate: ["#3a8fa5", "#22637a"] },
    music: { track: "ch18", scale: "abuata", root: 220.0, cents: [], bpm: 62, meter: 4, perc: "none", lead: "ney", octave: 0, drone: 0.75,
      motif: [[0,1.5],[1,1],[2,1.5],[1,0.5],[0,2],[-1,1],[3,1.5],[2,1],[1,1.5],[0,2.5]],
      motifB: [[2,1],[1,1],[0,1.5],[-1,1.5],[0,1],[1,1],[0,3]],
      },
    finaleText: "شفق روی برف‌ها رقصید؛ سردیِ کوه با واژه‌ها گرم شد.",
  },
  {
    id: 19,
    title: "قصرِ یخی",
    subtitle: "برج‌های بلورِ یخ، زیر آسمانِ نقره‌ای",
    bg: "/assets/bg/ch19.webp",
    accent: "#4a9ed9", accent2: "#e0f6ff",
    realm: { sky: ["#bfe4f5", "#eef9ff"], land: ["#9cc8e8", "#5a8ab8"], gate: ["#4a9ed9", "#2a6ba0"] },
    music: { track: "ch19", scale: "segah", root: 246.94, cents: [], bpm: 68, meter: 6, perc: "tombak", lead: "kamancheh", octave: 0, drone: 0.68,
      motif: [[0,1],[1,0.5],[2,1],[3,1],[4,1.5],[3,1],[2,1],[1,1.5],[0,2]],
      motifB: [[3,0.5],[4,0.5],[3,1],[2,1],[1,1.5],[0,1.5],[-1,0.5],[0,2.5]],
      },
    finaleText: "قصرِ یخی با گرمای واژه‌ها آب نشد؛ بلکه روشن‌تر شد.",
  },
  {
    id: 20,
    title: "تاجِ واژه‌ها",
    subtitle: "پایانِ سفرِ دوم — تاجی زرین بر فراز کاخِ نور",
    bg: "/assets/bg/ch20.webp",
    accent: "#9a6fd0", accent2: "#ffd76e",
    realm: { sky: ["#5a3f96", "#8a6ac0"], land: ["#4a3573", "#2b1c49"], gate: ["#c9922e", "#8a5f14"] },
    music: { track: "ch20", scale: "mahur", root: 349.23, cents: [], bpm: 112, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,0.5],[3,0.5],[4,0.5],[5,1],[4,0.5],[5,0.5],[6,1],[5,0.5],[4,0.5],[3,1],[2,0.5],[1,0.5],[0,1.5]],
      motifB: [[5,0.5],[6,0.5],[5,0.5],[4,0.5],[3,1],[2,1],[1,1],[0,1],[-1,0.5],[4,0.5],[3,0.5],[2,0.5],[1,0.5],[0,1.5]],
      },
    finaleText: "تاجِ واژه‌ها بر تارکِ سفر درخشید؛ قهرمانِ قصه‌ها تویی!",
  },
];

/** resolve scale cents once at module load */
for (const ch of CHAPTERS) {
  ch.music.cents = [...SCALES[ch.music.scale]];
}

/* ---------------- per-SECTION themes (user: «موسیقی بساز برای هربخش») ---------------- */

/** صفحهٔ اصلی + منوها — v3 NEW menu theme «دلنواز و ریتمیک»: a warm
 *  D-Shur 6/8 santur+ney loop (renders to menu2.ogg via
 *  scripts/render_menu_v2.py — user: «موزیک صفحه اصلی رو مخ بود») */
export const MENU_MUSIC: MusicConfig & { scale: ScaleName } = {
  track: "menu2", scale: "shur", root: 293.66, cents: [...SCALES.shur], bpm: 100, meter: 6,
  perc: "daf", lead: "santur", octave: 1, drone: 0.4,
  motif: [[0,1],[2,1],[1,1],[3,1.5],[2,0.5],[1,1],[0,1.5],[-1,0.5],[2,1],[1,1],[0,2]],
  motifB: [[3,1],[2,1],[1,1],[0,1.5],[-1,0.5],[1,1],[0,2.5]],
};

/** بازی دورهمی — festive 6/8 rast, daf-driven party mood (renders to party.ogg) */
export const PARTY_MUSIC: MusicConfig & { scale: ScaleName } = {
  track: "party", scale: "rast", root: 293.66, cents: [...SCALES.rast], bpm: 118, meter: 6,
  perc: "daf", lead: "santur", octave: 1, drone: 0.35,
  motif: [[0,0.5],[2,0.5],[3,0.5],[4,0.5],[5,0.5],[4,0.5],[3,0.5],[2,0.5],[3,1],[1,0.5],[0,0.5],[1,1]],
  motifB: [[4,0.5],[3,0.5],[4,0.5],[5,1],[4,0.5],[3,0.5],[2,1],[1,1],[0,1.5]],
};
