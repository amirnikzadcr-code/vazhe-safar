/* ------------------------------------------------------------------
 *  واژه‌سفر — data/chapters.ts  (v1.5 slim)
 *  Per-chapter identity: title, poem line, background, palette,
 *  procedural Persian music config. Consumed by the React UI.
 * ------------------------------------------------------------------ */
import { MusicConfig, SCALES, ScaleName } from "../core/audio";

export interface ChapterTheme {
  id: number;
  title: string;         // Persian chapter title
  subtitle: string;      // poetic one-liner
  bg: string;            // /assets/bg/chXX.webp — play-screen backdrop
  accent: string;        // UI accent (buttons, highlights)
  accent2: string;
  /** v2.1 map realm palette: sky gradient (top), land gradient (bottom),
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
    title: "بازارِ رنگ‌ها",
    subtitle: "زیر طاق‌های آجری، چراغ‌ها پشت‌سرهم روشن می‌شوند",
    bg: "/assets/bg/ch02.webp",
    accent: "#e88b3a", accent2: "#ffd76e",
    realm: { sky: ["#ffd9a6", "#fff0d8"], land: ["#eec27e", "#cf9347"], gate: ["#e88b3a", "#c26a1c"] },
    music: { track: "ch01", scale: "shur", root: 261.63, cents: [], bpm: 96, meter: 6, perc: "tombak", lead: "santur", octave: 0, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,1],[1,0.5],[0,0.5],[2,1],[3,1],[-1,0.5],[2,0.5],[1,1],[0,1.5],[-1,0.5],[1,1],[2,0.5],[1,0.5]],
      motifB: [[2,0.5],[1,0.5],[0,1],[-1,0.5],[1,1],[0,1.5],[2,0.5],[1,0.5],[0,1.5]],
      },
    finaleText: "همه چراغ‌های بازار یک‌باره روشن شدند؛ شب، رنگی شد.",
  },
  {
    id: 3,
    title: "کویرِ زرین",
    subtitle: "کاروان در افق، و آسمانی که سرخ‌طلایی می‌شود",
    bg: "/assets/bg/ch03.webp",
    accent: "#e89b3a", accent2: "#ff8a5e",
    realm: { sky: ["#ffc98c", "#ffe9c4"], land: ["#f2cd8e", "#dba45f"], gate: ["#e89b3a", "#c47a1e"] },
    music: { track: "ch01", scale: "dashti", root: 220.0, cents: [], bpm: 72, meter: 4, perc: "tombak", lead: "ney", octave: 0, drone: 0.6,
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
    music: { track: "ch01", scale: "nava", root: 246.94, cents: [], bpm: 60, meter: 6, perc: "none", lead: "ney", octave: 0, drone: 0.7,
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
    music: { track: "ch01", scale: "chahargah", root: 293.66, cents: [], bpm: 100, meter: 4, perc: "daf", lead: "kamancheh", octave: 1, drone: 0.5,
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
    music: { track: "ch01", scale: "homayun", root: 261.63, cents: [], bpm: 76, meter: 4, perc: "tombak", lead: "ney", octave: 0, drone: 0.6,
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
    music: { track: "ch01", scale: "rast", root: 293.66, cents: [], bpm: 90, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.45,
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
    music: { track: "ch01", scale: "abuata", root: 220.0, cents: [], bpm: 66, meter: 4, perc: "tombak", lead: "kamancheh", octave: 0, drone: 0.65,
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
    music: { track: "ch01", scale: "segah", root: 220.0, cents: [], bpm: 56, meter: 4, perc: "none", lead: "ney", octave: 0, drone: 0.75,
      motif: [[0,1.5],[1,0.5],[2,2],[1,1],[0,2],[-1,1],[3,1],[2,1],[1,1.5],[0,2.5]],
      motifB: [[2,1],[1,1],[0,2],[-1,2],[0,1],[1,1],[0,3]],
      },
    finaleText: "شهاب‌ها آسمان را دو نیم کردند؛ آرزو کن!",
  },
  {
    id: 10,
    title: "باغِ واژه‌ها",
    subtitle: "پایانِ سفر، آغازِ جشنی بزرگ در باغ نور",
    bg: "/assets/bg/ch10.webp",
    accent: "#9a6fd0", accent2: "#ff9fb8",
    realm: { sky: ["#7a58c0", "#b48ae0"], land: ["#5cb06e", "#2f8f4e"], gate: ["#9a6fd0", "#7550a8"] },
    music: { track: "ch01", scale: "mahur", root: 329.63, cents: [], bpm: 104, meter: 6, perc: "daf", lead: "santur", octave: 1, drone: 0.5,
      motif: [[0,0.5],[1,0.5],[2,0.5],[3,0.5],[4,1],[5,0.5],[4,0.5],[5,1],[4,0.5],[3,0.5],[2,1],[3,0.5],[2,0.5],[1,1],[0,1]],
      motifB: [[5,0.5],[4,0.5],[3,0.5],[2,0.5],[1,1],[0,1],[-1,0.5],[2,0.5],[1,0.5],[0,1.5],[4,0.5],[3,0.5],[2,0.5],[1,0.5],[0,1]],
      },
    finaleText: "آتش‌بازی بر فراز باغ؛ سفرِ واژه‌ها به زیباترین شکل کامل شد!",
  },
];

/** resolve scale cents once at module load */
for (const ch of CHAPTERS) {
  ch.music.cents = [...SCALES[ch.music.scale]];
}
