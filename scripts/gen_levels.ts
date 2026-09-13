/* ------------------------------------------------------------------
 *  واژه‌سفر — scripts/gen_levels.ts
 *  Regenerates all 100 levels (10 chapters × 10) from a curated
 *  real-Persian dictionary. Every target/bonus word is validated:
 *   • buildable from the level's wheel letters (multiset)
 *   • crossword layout must be compact & validated by the SAME
 *     generator used at runtime (src/game/crossword.ts)
 *  Also emits src/game/data/dictionary.ts used at runtime so any
 *  real dictionary word assembled from the wheel counts as bonus.
 *  Run: bun scripts/gen_levels.ts
 * ------------------------------------------------------------------ */
import { letters, canBuild, rng, shuffle } from "../src/game/core/utils";
import { makeCrossword } from "../src/game/crossword";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

/* ==================================================================
 *  Curated dictionary — common, real Persian words (2..7 letters).
 *  Persian ی (U+06CC) / ک (U+06A9); no ZWNJ, no spaces, no diacritics.
 * ================================================================== */
const RAW = `
آب ابر اسب آهو باز باد بار باغ بوق تاک تار جام جنگ چای چوب چنگ
خاک خار دار دشت رود رنگ سنگ شیر شعر سال سفر ساز صبح صبر صدف
عطر عسل عمر غار غزل قند قلب قفل کاج کوه گاو گرد گوش ماه موج مار
مرغ مهر موز نان نور هوا یار دیو دیگ دور سور سیب شمع شور شوق شاخ
شتر سرد گرم سبز زرد آبی تیز نرم سخت تلخ ترش پهن کرم خال لبه پلک
پول تهی حوض کبک سکه شاه سرا فکر لحن ملک ملت پیر پدر هفت زنگ غول
پری دست چشم برق افق ظهر عصر روز وقت دره تپه ریگ نخل جوی بیت فلک
شب در بر دم با ما تو او تا به که نه رو ده سر دل گل پا ته نو دو
بو لحن یاد حرف مثل قصه سحر شام خون زخم زور ستم ملخ فیل
دزد چپ عقب جلو غرب شرق قرن لقب نوه عمو عمه بام لنج جوی قطره تب غول
خوب زیبا زشت تمیز کثیف گران ارزان فقیر خوشحال خسته گرسنه تشنه
بزرگ کوچک آرام بلند سفید سیاه قرمز بنفش صورتی نقره برنز مسی
گلبهی کرمی یلدا پارس خزر البرز رشت ساری یزد بندر تخت نغز؟ شیرین
برف بهار باران پرنده پنیر پوست پیاز تولد ثروت جهان جامه حیات
خانه خیار درخت دریا دوست دیوار ریسمان زندگی زنبیل زنجیر سبد
ستاره سپیده شانه شکار شکوفه شمال شهاب صحرا صندلی عکاس غروب فرش
قاشق قایق کتاب کلاه کاشی گلاب لباس لیمو ماهی مهتاب نقشه نگار
نرده هلال هدهد پنجره چراغ چشمه دفتر آجر آتش آواز
آهنگ آینه امید انار بادام بازار بلبل بهشت تخته تنبک جواهر خواب
آسمان آبشار آفتاب ارغوان اسفند اسطوره افسانه انگور ایوان
بنفشه پرواز پلکان جنگل چکمه دیدار روباه سفال سهره صیاد
عروسک عقاب فرشته فانوس فلفل ققنوس کتیبه کهربا گنجشک گلبرگ
محراب مرجان معما نهنگ هدیه یاقوت چنار شمشیر پلنگ گوزن قناری
مینا نقطه نگین لانه مجسمه مسافر مناره طاووس صندوق طومار
زنبور زعفران شیرینی عنکبوت کبوتر
آبنبات ابریشم اسفناج باغبان بادکنک بادبزن چمدان خورشید
خانواده قهرمان مهربان شکارچی مارپیچ آبگیر
آبگوشت آبمیوه ادبیات آینده دانشجو دستمال دوچرخه خوشبخت
خواننده خوشنویس درخشیدن رقصیدن ساختمان سخاوت شاهزاده
کاشانه گلستان گردنبند نوشیدن ویرانه همسایه یونجه
پیچیده تابستان نارنجی خاکستری طلایی زمستان قدیمی
هندوانه گندم خیابان پرستار کشاورز
کشور ایران تهران شیراز تبریز اصفهان کاشان قزوین دماوند
الوند سبلان زاگرس کهکشان ماهواره کیهان
منظومه رصدخانه تلسکوپ تاریخ گذشته اکنون امروز
فردا دیروز ناهار صبحانه شامگاه میدان کوچه
فرودگاه ایستگاه موزه گالری تئاتر سینما هتل زندان دادگاه
شهرداری پلیس دولت مملکت کاروان حمام آبگرم
کارخانه مدرسه دانشگاه بیمار کتابخانه پارچه
ترمه گلیم قالی طرح زیور گوهر
فیروزه الماس بلور کریستال ساعت عینک قطار کشتی
بادبان پارو لنگر ملوان خلبان بلیط جعبه
بسته نامه تمبر پاکت نردبان چکش میخ اره سوهان پیچ مهره
سیم کابل برچسب چسب قلممو بوم تابلو عکس مجله
روزنامه ماست دوغ حلیم کباب کوفته حلوا مربا شربت بستنی
کلوچه نوقا پودر نمک فلفل دارچین زنجبیل سرکه روغن
کره خامه قیسی نخود لوبیا عدس سالاد خورشت جگر کوکو کشک
سنگک بربری زبان ادب فرهنگ هنر هنرمند نقاش شاعر
خطاطی تذهیب نگارگری موسیقی نغمه ترانه رقص
جشن عروسی نوروز عشق شادی خنده لبخند اشک آرزو رویا بیدار
سخن گفتار نوشتار واژه کلمه جمله عبارت داستان
حکایت خواهر دختر پسر فرزند بچه
دایی خاله همسر عروس داماد مهمان رفیق آشنا غریبه
آدم مردم مرد جوان کودک نوزاد نام وزیر سردار سرباز سپاه
جنگجو پهلوان معلم بقال نانوا قصاب آشپز گارسون
راننده سارق قاضی وکیل کارگر کارمند رئیس مدیر بازیگر
رفتن دیدن گفتن خوردن خندیدن گریستن دویدن پریدن نشستن
ماندن آمدن خواندن نوشتن ساختن شکستن بستن پوشیدن فروختن
خریدن یافتن جنگیدن ترسیدن دانستن فهمیدن پرسیدن جوشیدن
پختن شستن چرخیدن رقصیدن خوابیدن باریدن وزیدن تابیدن
شکفتن روییدن ابرو بینی دهان دندان گردن بازو انگشت ناخن
سینه معده کبد استخوان ماهیچه بیماری سلامت دارو درمان
گنج پروانه مورچه شاهین طوطی دلفین عقرب حلزون پرستو
شاپرک نارنج بید سرو توت انجیر زیتون زردآلو هویج گوجه
گیلاس خرما پسته بادام گردو فندق کشمش علف برگ ریشه
بذر بوستان بستان گلخانه جارو کلید زنجیر طناب چادر
خیمه جوراب کفش دکمه سوزن قیچی میوه قورباغه
گیتی هستی مرگ زمان لحظه دقیقه ثانیه هفته
دانا نادان عاقل کودن باهوش سریع تند کهنه تازه
کهن مدرن ساده خنک مرطوب خیس سنگین کوتاه باریک عمیق
تنگ گشاد وسیع نزدیک میان بالا پایین راست جنوب
نهان پنهان آشکار
ناز قشنگ عجیب اندوه شادمان سرمست حیرت شگفت
لذت آرامش سکوت هیاهو شلوغ خلوت تنهایی یاری یاور
مدد کمک همراه همدم برابر همتا مانند
شبیه مختلف فرق تفاوت اندازه مقدار عدد شمار شماره
خرد دانش بینش اندیشه تصور تخیل
واقع حقیقت راستی دروغ صادق صمیمی بدجنس
خسیس بخشنده قانع حرص
فروتن مغرور سرسخت
ضعیف قوی تنومند لاغر چاق وزن قد سانت متر کیلو
دما گرما بارش تگرگ رگبار
سایه روشنایی تاریکی شفق
طلوع سحرگاه بامداد نیمروز
شادباش مبارک تهنیت جایزه برنده بازنده
مسابقه رقابت بازی ورزش تمرین مهارت توانایی
قدرت استعداد ذکاوت ذهن حافظه تمرکز
طاقت دقت اشتباه درست غلط خطا آفرین آفرینش
خالق طبیعت حیوان گیاه بوته شاخه
تنه پوسته مغز هسته دانه محصول
دهقان روستایی شهری جنگلی صحرایی کویری ساحلی
دریایی کوهستان رودخانه
آبراه خلیج جزیره اقیانوس اقلیم
`;

/* ---- normalize + validate ---- */
const FA_LETTERS = new Set("ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآ".split(""));
function normalize(raw: string): string[] {
  const out: string[] = [];
  for (const w0 of raw.split(/\s+/)) {
    if (w0.includes("?") || w0.includes("؟")) continue; // flagged-uncertain words are skipped
    const w = w0.replace(/[^\u0600-\u06FF]/g, "");
    if (!w || w.length < 2 || w.length > 7) continue;
    if (w.includes("\u200C")) continue;
    let ok = true;
    for (const ch of w) if (!FA_LETTERS.has(ch)) { ok = false; break; }
    if (!ok) continue;
    out.push(w);
  }
  return [...new Set(out)];
}
export const DICT = normalize(RAW);

/* chapter word-theme hints (anchors preferred from these when possible) */
const THEME: Record<number, string[]> = {
  1: ["باغ", "گل", "لاله", "نرگس", "یاس", "بنفشه", "شکوفه", "بهار", "سبزه", "پروانه", "بلبل", "آفتاب", "چشمه", "بوستان", "شکوفه", "قطره"],
  2: ["بازار", "چراغ", "قالی", "فرش", "کاشی", "سکه", "طلا", "نقره", "فانوس", "شمشیر", "زرگر", "بقال", "نانوا", "قصاب", "تابلو", "گلیم", "ترمه"],
  3: ["کویر", "نخل", "کاروان", "شتر", "غروب", "ماه", "ستاره", "آفتاب", "گرما", "چادر", "خیمه", "ریگ", "تپه", "غار"],
  4: ["جنگل", "درخت", "باران", "برگ", "ریشه", "سرو", "چنار", "بید", "شبنم", "پروانه", "سهره", "آبشار", "خزه", "مه"],
  5: ["کوه", "قلعه", "برج", "دماوند", "الوند", "سبلان", "زاگرس", "برف", "عقاب", "پرچم", "سپاه", "شمال", "سرد", "پلکان"],
  6: ["باد", "خانه", "حمام", "آبگرم", "گل", "سفال", "کوزه", "آجر", "شهر", "کوچه", "سایه", "نقره", "باد", "دیوار"],
  7: ["دریا", "ساحل", "موج", "کشتی", "قایق", "لنج", "بادبان", "پارو", "لنگر", "ماهی", "مرجان", "صدف", "خزر", "بندر", "نهنگ", "دلفین"],
  8: ["روستا", "پلکان", "خانه", "کوه", "چراغ", "پنجره", "شب", "ستاره", "مهتاب", "چنار", "گردو", "سیب", "خرما", "برکه"],
  9: ["ستاره", "مهتاب", "کهکشان", "شهاب", "سکوت", "آسمان", "تلسکوپ", "کیهان", "شب", "دوربین", "سحر", "شفق", "خیال", "ماه"],
  10: ["جشن", "شادی", "آتش", "نوروز", "یلدا", "انار", "هندوانه", "شعر", "غزل", "موسیقی", "ترانه", "رقص", "گل", "لاله", "بادام", "گردو"],
};

/* difficulty ramp */
function wheelLenFor(i: number): number {
  const ch = Math.floor(i / 10) + 1; // 1..10
  const base = [3, 3, 4, 4, 4, 5, 5, 5, 6, 6][ch - 1];
  const pos = i % 10;
  // +1 on the second half of the chapter for ch>=2 chapters, capped 7
  if (ch >= 2 && pos >= 5 && base < 7 && ch % 2 === 0) return base + 1;
  return base;
}
function wantWordsFor(i: number): number {
  return Math.min(6, 3 + Math.floor(i / 24)); // 3 → 6
}

interface GenLevel { id: number; wheel: string; words: string[]; bonus: string[] }

const byLen = new Map<number, string[]>();
for (const w of DICT) {
  const L = w.length;
  if (!byLen.has(L)) byLen.set(L, []);
  byLen.get(L)!.push(w);
}
for (const [k, v] of byLen) v.sort();

/** all dictionary words buildable from a letter multiset */
function buildable(wheel: string): string[] {
  return DICT.filter((w) => canBuild(w, wheel));
}

function genAll(): GenLevel[] {
  const rand = rng(20260913);
  const levels: GenLevel[] = [];
  const usedAnchors = new Set<string>();
  const recentTargets: string[][] = []; // target words of last levels (diversity gate)

  for (let i = 0; i < 100; i++) {
    const ch = Math.floor(i / 10) + 1;
    const wl = wheelLenFor(i);
    const want = wantWordsFor(i);
    const id = i + 1;
    const theme = THEME[ch] ?? [];
    const pool = byLen.get(wl) ?? [];
    const themed = pool.filter((w) => theme.includes(w));
    const others = pool.filter((w) => !theme.includes(w));
    // rank by richness (# of buildable words) and take a broad top pool
    const scored = [...themed, ...others]
      .filter((w) => !usedAnchors.has(w))
      .map((a) => ({ a, rich: buildable(a).length }))
      .sort((x, y) => y.rich - x.rich);
    const topPool = scored.slice(0, Math.max(8, Math.ceil(scored.length * 0.4)));
    const candidates = shuffle(topPool.map((s) => s.a), rand);

    let done: GenLevel | null = null;

    for (const anchor of candidates) {
      if (usedAnchors.has(anchor)) continue;
      const rich = buildable(anchor);
      const targets0 = rich.filter((w) => w !== anchor && w.length >= 2);
      if (targets0.length + 1 < want) continue;
      // diversity: at most 1 shared ≥3-letter word with each of last 3 levels
      let overlapOk = true;
      for (const prev of recentTargets.slice(-5)) {
        const shared = targets0.filter((w) => prev.includes(w) && w.length >= 3).length;
        if (shared >= 2 || (prev.includes(anchor) && anchor.length >= 3 && shared >= 1)) { overlapOk = false; break; }
      }
      if (!overlapOk) continue;
      // pick diverse targets: prefer 3+ letter words, mix lengths
      const sortedT = [...targets0].sort((a, b) => b.length - a.length);
      const picked: string[] = [];
      // one long, one short, rest random-ish
      const longs = sortedT.filter((w) => w.length >= 3);
      if (longs.length) picked.push(longs[Math.floor(rand() * Math.min(3, longs.length))]);
      const shorts = sortedT.filter((w) => w.length === 2);
      if (shorts.length && picked.length < want - 1)
        picked.push(shorts[Math.floor(rand() * shorts.length)]);
      for (const w of shuffle(sortedT, rand)) {
        if (picked.length >= want - 1) break;
        if (!picked.includes(w)) picked.push(w);
      }
      const words = [anchor, ...picked.slice(0, want - 1)];

      const seed = id * 100 + ch; // same seed formula as runtime
      const layout = makeCrossword(words, seed);
      if (!layout) continue;
      const cells = layout.grid.flat().filter(Boolean).length;
      const area = layout.rows * layout.cols;
      // compactness gates (stricter than CI validator)
      let islands = 0;
      {
        const seen = new Set<string>();
        for (let r = 0; r < layout.rows; r++)
          for (let c = 0; c < layout.cols; c++) {
            if (!layout.grid[r][c] || seen.has(`${r},${c}`)) continue;
            islands++;
            const st = [[r, c]];
            while (st.length) {
              const [cr, cc] = st.pop()!;
              const k = `${cr},${cc}`;
              if (seen.has(k) || !layout.grid[cr]?.[cc]) continue;
              seen.add(k);
              st.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
            }
          }
      }
      if (islands > 2 || area > cells * 2.05 || layout.cols > 7 || layout.rows > 7) continue;
      if (layout.cols < 3) continue;

      const bonus = rich.filter((w) => !words.includes(w)).sort();
      done = { id, wheel: anchor, words, bonus };
      usedAnchors.add(anchor);
      recentTargets.push(words);
      break;
    }

    if (!done) {
      // graceful fallback: relax gates
      for (const anchor of candidates) {
        if (usedAnchors.has(anchor)) continue;
        const rich = buildable(anchor);
        if (rich.length + 1 < 3) continue;
        const words = [anchor, ...rich.filter((w) => w !== anchor && w.length >= 2).slice(0, 2)];
        const layout = makeCrossword(words, id * 100 + ch);
        if (!layout) continue;
        const bonus = rich.filter((w) => !words.includes(w)).sort();
        done = { id, wheel: anchor, words, bonus };
        usedAnchors.add(anchor);
        recentTargets.push(words);
        console.log(`  fallback used for level ${id}`);
        break;
      }
    }
    if (!done) throw new Error(`could not generate level ${id} (wheel len ${wl})`);
    levels.push(done);
  }
  return levels;
}

/* ---------------- emit ---------------- */
const levels = genAll();
mkdirSync("src/game/data/levels", { recursive: true });
for (let ch = 1; ch <= 10; ch++) {
  const chunk = levels.filter((l) => l.id > (ch - 1) * 10 && l.id <= ch * 10);
  const file = `src/game/data/levels/ch${String(ch).padStart(2, "0")}.json`;
  writeFileSync(file, JSON.stringify(chunk, null, 1) + "\n");
  const avgW = (chunk.reduce((s, l) => s + l.words.length, 0) / chunk.length).toFixed(1);
  console.log(`ch${String(ch).padStart(2, "0")}: ${chunk.length} levels, avg words ${avgW}`);
}

const dictTs = `/* ------------------------------------------------------------------
 *  واژه‌سفر — data/dictionary.ts (AUTO-GENERATED by scripts/gen_levels.ts)
 *  Real Persian words used for bonus-word validation at runtime.
 * ------------------------------------------------------------------ */
export const DICT_WORDS: string[] = [
${chunkArray(DICT, 12).map((row) => "  " + row.map((w) => `"${w}"`).join(", ")).join(",\n")},
];

export const DICT: Set<string> = new Set(DICT_WORDS);
`;
writeFileSync("src/game/data/dictionary.ts", dictTs);

function chunkArray<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

console.log(`\nDONE — ${levels.length} levels, dictionary ${DICT.length} words`);
