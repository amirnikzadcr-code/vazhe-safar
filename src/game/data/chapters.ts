/* ------------------------------------------------------------------
 *  واژه‌سفر — data/chapters.ts
 *  Per-chapter art direction: palette, ambient particles, procedural
 *  music config (Persian dastgāh-inspired scales), prop pool, finale.
 * ------------------------------------------------------------------ */
import { MusicConfig, SCALES, ScaleName } from "../core/audio";
import { AmbientKind } from "../fx/particles";

export interface ChapterTheme {
  id: number;
  title: string;         // Persian chapter title
  subtitle: string;      // poetic one-liner
  bg: string;            // /assets/bg/chXX.png
  /** prop tint colors */
  c1: string;
  c2: string;
  /** UI accent (buttons, highlights) */
  accent: string;
  accent2: string;
  ambient: AmbientKind;
  music: MusicConfig & { scale: ScaleName };
  /** ordered prop pool — assigned to found words round-robin (seeded) */
  propPool: string[];
  /** anchor slots (%) where props may appear in the scene */
  zones: { x: number; y: number; s: number }[];
  /** finale id — special end-of-chapter moment */
  finale: "bloom" | "lanterns" | "campfire" | "sunbeams" | "dawn" | "dusk" | "sail" | "villageGlow" | "meteor" | "fireworks";
  finaleText: string;
}

/* anchor zone helpers — scattered but tidy rows in the scene area */
const Z = (list: [number, number, number][]) => list.map(([x, y, s]) => ({ x, y, s }));

export const CHAPTERS: ChapterTheme[] = [
  {
    id: 1,
    title: "باغِ نخستین",
    subtitle: "جایی که سفر با شکوفه‌های بهاری آغاز می‌شود",
    bg: "/assets/bg/ch01.png",
    c1: "#1e6f50", c2: "#ffd76e",
    accent: "#2e9e6b", accent2: "#ff9fb8",
    ambient: "petals",
    music: { scale: "mahur", root: 293.66, cents: [], bpm: 92, meter: 4, perc: "daf", lead: "santur", density: 0.55, octave: 1, drone: 0.45 },
    propPool: ["flowerSmall", "rose", "treeRound", "cypress", "fountain", "butterfly", "bird", "dove", "lotus", "tulip", "pond", "sun", "cloud", "rainbow", "peacock"],
    zones: Z([[14, 62, 12], [84, 60, 12], [30, 72, 10], [68, 74, 10], [8, 44, 10], [90, 42, 10], [46, 66, 9], [22, 34, 9], [78, 30, 9], [56, 38, 8], [40, 50, 8], [62, 52, 8], [12, 78, 9], [88, 78, 9]]),
    finale: "bloom",
    finaleText: "باغ به کامل‌ترین شکوفایی‌اش رسید؛ گل‌ها همه‌جا شکفتند.",
  },
  {
    id: 2,
    title: "بازارِ رنگ‌ها",
    subtitle: "زیر طاق‌های آجرى، چراغ‌ها پشت‌سرهم روشن می‌شوند",
    bg: "/assets/bg/ch02.png",
    c1: "#a04a1f", c2: "#ffcf5e",
    accent: "#e88b3a", accent2: "#ffd76e",
    ambient: "dust",
    music: { scale: "shur", root: 261.63, cents: [], bpm: 96, meter: 6, perc: "tombak", lead: "santur", density: 0.6, octave: 0, drone: 0.5 },
    propPool: ["lantern", "awning", "spiceJar", "carpet", "pot", "banner", "arch", "teapot", "tilestar", "dome", "kite", "bird", "cloud", "lantern"],
    zones: Z([[12, 58, 11], [86, 56, 11], [28, 70, 10], [70, 72, 10], [50, 62, 9], [8, 36, 9], [92, 34, 9], [34, 44, 8], [66, 46, 8], [18, 26, 8], [82, 24, 8], [42, 76, 9], [58, 78, 9], [50, 28, 8]]),
    finale: "lanterns",
    finaleText: "همه چراغ‌های بازار یک‌باره روشن شدند؛ شب، رنگی شد.",
  },
  {
    id: 3,
    title: "کویرِ زرین",
    subtitle: "کاروان در افق، و آسمانی که سرخ‌طلایی می‌شود",
    bg: "/assets/bg/ch03.png",
    c1: "#8a5a24", c2: "#ffb85e",
    accent: "#e89b3a", accent2: "#ff8a5e",
    ambient: "sand",
    music: { scale: "dashti", root: 220.0, cents: [], bpm: 72, meter: 4, perc: "tombak", lead: "ney", density: 0.45, octave: 0, drone: 0.6 },
    propPool: ["palm", "camel", "campfire", "pot", "sun", "cloud", "star", "moon", "teapot", "banner", "kite"],
    zones: Z([[16, 66, 13], [82, 64, 12], [34, 76, 10], [66, 78, 10], [50, 60, 10], [10, 40, 9], [90, 38, 9], [60, 44, 8], [26, 50, 8], [74, 30, 8], [44, 34, 8]]),
    finale: "campfire",
    finaleText: "شب که فرارسید، دور آتشِ کاروان حلقه زدیم؛ آسمان پر از ستاره شد.",
  },
  {
    id: 4,
    title: "جنگلِ مه‌آلود",
    subtitle: "نور از میان شاخه‌ها می‌لغزد و کرم‌های شب‌تاب بیدار می‌شوند",
    bg: "/assets/bg/ch04.png",
    c1: "#1c4a38", c2: "#b8e96b",
    accent: "#3a9e6e", accent2: "#d4ff8f",
    ambient: "fireflies",
    music: { scale: "nava", root: 246.94, cents: [], bpm: 60, meter: 6, perc: "none", lead: "ney", density: 0.4, octave: 0, drone: 0.7 },
    propPool: ["treeRound", "cypress", "fireflyCloud", "deer", "bird", "flowerSmall", "waterfall", "pond", "butterfly", "rainbow", "lotus", "cloud"],
    zones: Z([[13, 60, 13], [85, 58, 12], [30, 74, 10], [68, 76, 10], [48, 64, 9], [6, 38, 10], [94, 36, 10], [22, 44, 8], [78, 42, 8], [54, 46, 8], [40, 84, 9], [60, 84, 9]]),
    finale: "sunbeams",
    finaleText: "مه گشوده شد و ستون‌های نور از میان درختان فرود آمدند.",
  },
  {
    id: 5,
    title: "قلعهٔ کوهستانی",
    subtitle: "بر فراز ابرها، پرچم‌ها در باد می‌رقصند",
    bg: "/assets/bg/ch05.png",
    c1: "#3d5a80", c2: "#cfe6ff",
    accent: "#5e83ad", accent2: "#ffd98a",
    ambient: "snow",
    music: { scale: "chahargah", root: 293.66, cents: [], bpm: 100, meter: 4, perc: "daf", lead: "kamancheh", density: 0.55, octave: 1, drone: 0.5 },
    propPool: ["tower", "banner", "eagle", "cloud", "crystal", "sun", "house", "star", "moon", "telescope", "flag"],
    zones: Z([[14, 62, 12], [84, 60, 12], [30, 72, 10], [68, 74, 10], [48, 58, 9], [8, 42, 9], [92, 40, 9], [36, 46, 8], [64, 48, 8], [50, 34, 8], [20, 80, 9], [80, 80, 9]]),
    finale: "dawn",
    finaleText: "خورشید از پشت قله برآمد و برف‌ها طلایی شدند.",
  },
  {
    id: 6,
    title: "شهرِ بادگیرها",
    subtitle: "شهرِ گِل، چراغ‌به‌چراغ در آستانهٔ شب",
    bg: "/assets/bg/ch06.png",
    c1: "#9c6b3d", c2: "#ffb36e",
    accent: "#c98a4b", accent2: "#7ec8c0",
    ambient: "dust",
    music: { scale: "homayun", root: 261.63, cents: [], bpm: 76, meter: 4, perc: "tombak", lead: "ney", density: 0.5, octave: 0, drone: 0.6 },
    propPool: ["windcatcher", "arch", "dome", "pond", "lantern", "pot", "bird", "banner", "tilestar", "house", "moon", "star", "carpet", "teapot"],
    zones: Z([[12, 60, 12], [86, 58, 12], [28, 72, 10], [70, 74, 10], [48, 64, 9], [6, 40, 9], [94, 38, 9], [24, 46, 8], [76, 44, 8], [52, 50, 8], [40, 82, 9], [62, 82, 9], [14, 26, 8], [86, 24, 8]]),
    finale: "dusk",
    finaleText: "غروب که رسید، تمام پنجره‌های شهر یک‌باره جان گرفتند.",
  },
  {
    id: 7,
    title: "ساحلِ مروارید",
    subtitle: "لنج‌ها روی آبِ فیروزه‌ای، آرام مانند واژه‌ها",
    bg: "/assets/bg/ch07.png",
    c1: "#0f7f8c", c2: "#ffd76e",
    accent: "#22a8a0", accent2: "#ff9f7e",
    ambient: "seasparkle",
    music: { scale: "rast", root: 293.66, cents: [], bpm: 90, meter: 6, perc: "daf", lead: "santur", density: 0.55, octave: 1, drone: 0.45 },
    propPool: ["boat", "palm", "fish", "sun", "cloud", "lighthouse", "bird", "dove", "star", "kite", "rainbow", "butterfly"],
    zones: Z([[14, 64, 12], [84, 62, 12], [30, 74, 10], [68, 76, 10], [48, 58, 9], [8, 40, 9], [92, 38, 9], [26, 48, 8], [74, 46, 8], [52, 44, 8], [40, 84, 9], [62, 84, 9]]),
    finale: "sail",
    finaleText: "باد آمد، بادبان‌ها برخاستند و لنج‌ها روانِ دریا شدند.",
  },
  {
    id: 8,
    title: "روستای پلکانی",
    subtitle: "خانه‌ها یکی‌یکی روی دوشِ کوه روشن می‌شوند",
    bg: "/assets/bg/ch08.png",
    c1: "#5a4632", c2: "#ffb36e",
    accent: "#8a6a45", accent2: "#7adcb0",
    ambient: "leaves",
    music: { scale: "abuata", root: 220.0, cents: [], bpm: 66, meter: 4, perc: "tombak", lead: "kamancheh", density: 0.42, octave: 0, drone: 0.65 },
    propPool: ["house", "waterfall", "treeRound", "flowerSmall", "bird", "cloud", "lantern", "pot", "star", "moon", "butterfly", "teapot", "fireflyCloud"],
    zones: Z([[13, 60, 12], [85, 58, 12], [29, 72, 10], [69, 74, 10], [47, 62, 9], [7, 42, 9], [93, 40, 9], [25, 48, 8], [75, 46, 8], [53, 50, 8], [39, 82, 9], [61, 82, 9], [50, 30, 8]]),
    finale: "villageGlow",
    finaleText: "ساعتِ آبی؛ همهٔ پنجره‌های روستا مثل ستاره‌ها روشن شدند.",
  },
  {
    id: 9,
    title: "شبِ ستاره‌ها",
    subtitle: "در سکوتِ کویر، صورت‌های فلکی یکی‌یکی جان می‌گیرند",
    bg: "/assets/bg/ch09.png",
    c1: "#2b3a67", c2: "#ffe9a8",
    accent: "#4a5fa5", accent2: "#ffd76e",
    ambient: "stars",
    music: { scale: "segah", root: 220.0, cents: [], bpm: 56, meter: 4, perc: "none", lead: "ney", density: 0.38, octave: 0, drone: 0.75 },
    propPool: ["star", "constellation", "moon", "telescope", "campfire", "crystal", "cloud", "fireflyCloud", "dome", "tilestar", "lotus"],
    zones: Z([[14, 56, 11], [84, 54, 11], [30, 68, 10], [68, 70, 10], [48, 60, 9], [10, 30, 9], [90, 28, 9], [28, 38, 8], [72, 36, 8], [50, 40, 8], [22, 78, 9], [78, 78, 9], [40, 22, 8]]),
    finale: "meteor",
    finaleText: "شهاب‌ها آسمان را دو نیم کردند؛ آرزو کن!",
  },
  {
    id: 10,
    title: "باغِ واژه‌ها",
    subtitle: "پایانِ سفر، آغازِ جشنی بزرگ در باغ نور",
    bg: "/assets/bg/ch10.png",
    c1: "#6b3fa0", c2: "#ffd76e",
    accent: "#9a6fd0", accent2: "#ff9fb8",
    ambient: "gold",
    music: { scale: "mahur", root: 329.63, cents: [], bpm: 104, meter: 6, perc: "daf", lead: "santur", density: 0.65, octave: 1, drone: 0.5 },
    propPool: ["tilestar", "fountain", "peacock", "lantern", "rose", "tulip", "arch", "dome", "carpet", "teapot", "butterfly", "bird", "star", "moon", "crystal", "lotus", "banner", "flowerSmall"],
    zones: Z([[12, 58, 12], [86, 56, 12], [28, 70, 10], [70, 72, 10], [48, 62, 9], [6, 38, 9], [94, 36, 9], [24, 44, 8], [76, 42, 8], [52, 46, 8], [38, 80, 9], [62, 80, 9], [14, 24, 8], [86, 22, 8], [50, 26, 8], [32, 30, 7], [68, 28, 7]]),
    finale: "fireworks",
    finaleText: "آتش‌بازی بر فراز باغ؛ سفرِ واژه‌ها به زیباترین شکل کامل شد!",
  },
];

/** resolve scale cents once at module load */
for (const ch of CHAPTERS) {
  ch.music.cents = [...SCALES[ch.music.scale]];
}
