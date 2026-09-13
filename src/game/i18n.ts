/* ------------------------------------------------------------------
 *  واژه‌سفر — all Persian UI strings live here (single source of truth)
 * ------------------------------------------------------------------ */
export const T = {
  gameTitle: "واژه‌سفر",
  gameTagline: "سفری واژه‌به‌واژه در سرزمینِ قصه‌ها",
  tapToStart: "برای شروع لمس کنید",

  // main menu
  play: "بازی",
  continueGame: "ادامه سفر",
  newGame: "سفر از آغاز",
  chapters: "فصل‌ها",
  settings: "تنظیمات",
  progress: "پیشرفت",
  rewards: "جوایز",
  about: "درباره بازی",

  // chapter select
  chooseChapter: "یک فصل را برگزینید",
  chapter: "فصل",
  locked: "قفل است",
  completeChapter: "این فصل را کامل کنید تا گشوده شود",
  starsCount: "ستاره",
  chapterLockedHint: "با کامل‌کردن دست‌کم ۷ مرحله از فصل پیشین گشوده می‌شود",

  // levels
  chooseLevel: "مرحله‌ای را برگزینید",
  level: "مرحله",
  levelLocked: "برای گشودن، مرحله پیشین را کامل کنید",

  // gameplay
  findWords: "واژه‌ها را بیابید",
  bonusWords: "واژه‌های پنهان",
  bonusWordFound: "واژه پنهان! +۱۵ سکه",
  hint: "راهنما",
  shuffle: "بُر زدن",
  undo: "بازگردانی",
  pause: "توقف",
  notEnoughCoins: "سکه کافی ندارید",
  hintUsed: "یک حرف آشکار شد",
  alreadyFound: "این واژه را یافته‌اید",
  wordTooShort: "واژه باید دست‌کم ۲ حرف باشد",
  noHintLeft: "راهنمای بیشتری برای این مرحله نیست",

  // level complete
  levelComplete: "مرحله کامل شد!",
  chapterComplete: "فصل کامل شد!",
  coinsEarned: "سکه",
  nextLevel: "مرحله بعد",
  nextChapter: "فصل بعد",
  backToLevels: "فهرست مراحل",
  perfectLevel: "بی‌نقص!",
  noMistakes: "بدون خطا",
  bonusHunter: "شکارچی واژه‌های پنهان",
  chapterChest: "صندوقچه پایان فصل",
  chestClaimed: "۱۵۰ سکه از صندوقچه گرفتید!",
  claimReward: "دریافت جایزه",

  // settings
  music: "موسیقی",
  sound: "جلوه‌های صوتی",
  haptics: "لرزش",
  musicVolume: "بلندی موسیقی",
  soundVolume: "بلندی صداها",
  resetProgress: "بازنشانی پیشرفت",
  resetConfirm: "همه پیشرفت شما پاک می‌شود. مطمئنید؟",
  yes: "بله، پاک کن",
  no: "نه",
  aboutText:
    "واژه‌سفر یک بازی پازل کلمات ایرانی‌الهام است؛ با یافتن واژه‌ها، دنیای هر فصل جان می‌گیرد: باغ‌ها سبز می‌شوند، چراغ‌های بازار روشن می‌شوند و ستاره‌ها ظاهر می‌شوند. تمام گرافیک، موسیقی و صداها اورجینال و تولیدشده برای همین بازی است.",

  // progress
  totalStars: "ستاره‌ها",
  totalWords: "واژه‌های یافته",
  totalBonus: "واژه‌های پنهان",
  coins: "سکه‌ها",
  levelsDone: "مرحله‌های کامل‌شده",

  // tutorial
  tutorialTitle: "به واژه‌سفر خوش آمدید!",
  tutorial1: "با کشیدن انگشت روی حروف، واژه بسازید",
  tutorial2: "هر واژه‌ای که بیابید، دنیای بازی زنده می‌شود",
  tutorial3: "واژه‌های پنهان سکه می‌دهند؛ از راهنما هم می‌توانید کمک بگیرید",
  gotIt: "فهمیدم!",

  // misc
  dailyGift: "هدیه روزانه",
  dailyGiftMsg: "۵۰ سکه هدیه امروز را گرفتید!",
  close: "بستن",
  resume: "ادامه",
  restart: "شروع دوباره",
  exit: "خروج",
  loading: "در حال آماده‌سازی سفر…",
  unlockLevel: "قفل گشوده شد!",
  chapterUnlocked: "فصل جدید گشوده شد!",
  back: "بازگشت",
  found: "یافته شد",
  pressBack: "برای خروج دوباره لمس کنید",
} as const;
