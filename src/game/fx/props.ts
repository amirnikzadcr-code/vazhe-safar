/* ------------------------------------------------------------------
 *  واژه‌سفر — fx/props.ts
 *  Library of original SVG "props" that materialize in the scene as the
 *  player finds words. Elegant silhouettes + glow, tinted per chapter.
 *  Each factory returns inner SVG markup for a 100×100 viewBox.
 * ------------------------------------------------------------------ */

export type PropFactory = (c1: string, c2: string) => string;

/* ——— nature ——— */

const cypress: PropFactory = (c1, c2) => `
  <path d="M50 2 C36 24 30 46 33 68 L33 84 Q50 92 67 84 L67 68 C70 46 64 24 50 2 Z" fill="${c1}"/>
  <path d="M50 8 C42 28 38 46 40 66 L40 80 Q50 86 60 80 L60 66 C62 46 58 28 50 8 Z" fill="${c2}" opacity=".45"/>
  <rect x="46.5" y="82" width="7" height="14" rx="2.5" fill="${c1}"/>`;

const treeRound: PropFactory = (c1, c2) => `
  <circle cx="50" cy="38" r="26" fill="${c1}"/>
  <circle cx="34" cy="46" r="16" fill="${c1}"/>
  <circle cx="66" cy="46" r="16" fill="${c1}"/>
  <circle cx="44" cy="32" r="12" fill="${c2}" opacity=".4"/>
  <rect x="46" y="58" width="8" height="34" rx="3" fill="${c1}"/>
  <path d="M50 66 L38 58 M50 74 L63 64" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;

const rose: PropFactory = (c1, c2) => `
  <circle cx="50" cy="42" r="17" fill="${c1}"/>
  <circle cx="50" cy="42" r="11" fill="${c2}" opacity=".55"/>
  <circle cx="50" cy="42" r="5.5" fill="${c1}"/>
  <path d="M50 58 C49 70 46 76 42 84" stroke="${c2}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M49 66 Q60 62 63 70 Q54 74 49 66Z" fill="${c2}" opacity=".8"/>
  <path d="M47 74 Q37 71 35 79 Q43 82 47 74Z" fill="${c2}" opacity=".8"/>`;

const tulip: PropFactory = (c1, c2) => `
  <path d="M38 22 Q38 40 50 44 Q62 40 62 22 Q56 30 50 22 Q44 30 38 22 Z" fill="${c1}"/>
  <path d="M50 44 L50 86" stroke="${c2}" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M50 62 Q38 58 36 68 Q46 72 50 62Z M50 74 Q62 70 64 80 Q54 84 50 74Z" fill="${c2}"/>`;

const flowerSmall: PropFactory = (c1, c2) => `
  ${[0, 72, 144, 216, 288].map((a) =>
    `<ellipse cx="50" cy="34" rx="7" ry="12" fill="${c1}" transform="rotate(${a} 50 44)"/>`).join("")}
  <circle cx="50" cy="44" r="6.5" fill="${c2}"/>`;

const palm: PropFactory = (c1, c2) => `
  <path d="M46 96 Q48 60 54 34 L60 35 Q54 62 54 96 Z" fill="${c1}"/>
  ${[-70, -35, 0, 35, 70].map((a) =>
    `<path d="M57 34 Q${57 + Math.cos((a - 90) * Math.PI / 180) * 30} ${34 + Math.sin((a - 90) * Math.PI / 180) * 26} ${57 + Math.cos((a - 90) * Math.PI / 180) * 38} ${38 + Math.sin((a - 90) * Math.PI / 180) * 22}" stroke="${c2}" stroke-width="7" fill="none" stroke-linecap="round"/>`).join("")}
  <circle cx="53" cy="40" r="3.5" fill="${c2}"/><circle cx="60" cy="42" r="3.5" fill="${c2}"/>`;

const lotus: PropFactory = (c1, c2) => `
  <path d="M50 40 Q36 30 30 42 Q42 50 50 44 Q58 50 70 42 Q64 30 50 40Z" fill="${c1}" opacity=".9"/>
  <path d="M50 44 Q40 22 50 12 Q60 22 50 44Z" fill="${c2}"/>
  <path d="M50 44 Q32 38 26 48 Q38 56 50 48 Q62 56 74 48 Q68 38 50 44Z" fill="${c2}" opacity=".6"/>`;

const butterfly: PropFactory = (c1, c2) => `
  <path d="M50 50 Q28 26 18 40 Q14 56 44 56 Z" fill="${c1}" opacity=".95"/>
  <path d="M50 50 Q72 26 82 40 Q86 56 56 56 Z" fill="${c1}" opacity=".95"/>
  <path d="M50 54 Q34 68 24 64 Q26 78 48 60 Z" fill="${c2}" opacity=".85"/>
  <path d="M50 54 Q66 68 76 64 Q74 78 52 60 Z" fill="${c2}" opacity=".85"/>
  <rect x="48.6" y="42" width="2.8" height="20" rx="1.4" fill="${c2}"/>
  <path d="M49 44 Q44 36 40 34 M51 44 Q56 36 60 34" stroke="${c2}" stroke-width="2" fill="none" stroke-linecap="round"/>`;

const bird: PropFactory = (c1) => `
  <path d="M30 54 Q40 38 54 46 Q60 34 72 40 Q66 48 58 52 Q46 60 30 54Z" fill="${c1}"/>
  <circle cx="70" cy="42" r="5" fill="${c1}"/>
  <path d="M74 41 L82 43 L74 46 Z" fill="${c1}"/>
  <circle cx="71.5" cy="41.5" r="1.2" fill="#1d2430"/>
  <path d="M52 52 L44 70 L52 64" fill="${c1}"/>`;

const dove: PropFactory = (c1) => `
  <path d="M34 52 Q46 36 62 44 L70 40 Q72 46 66 50 Q56 60 40 58 Z" fill="${c1}"/>
  <circle cx="65" cy="45" r="4.5" fill="${c1}"/>
  <path d="M62 56 Q60 66 52 66" stroke="${c1}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M44 50 Q50 40 58 44 Q50 46 44 50Z" fill="${c1}" opacity=".7"/>`;

const deer: PropFactory = (c1, c2) => `
  <ellipse cx="52" cy="56" rx="20" ry="12" fill="${c1}"/>
  <path d="M68 52 Q76 44 76 34 Q70 40 66 48 Z" fill="${c1}"/>
  <circle cx="73" cy="34" r="5.5" fill="${c1}"/>
  <path d="M70 28 Q66 18 60 16 M75 28 Q77 16 84 14" stroke="${c2}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M70 27 L66 20 M70 27 L64 24 M76 27 L80 19 M76 27 L83 23" stroke="${c2}" stroke-width="2.2" stroke-linecap="round"/>
  <rect x="42" y="66" width="4" height="16" rx="2" fill="${c1}"/>
  <rect x="58" y="66" width="4" height="16" rx="2" fill="${c1}"/>
  <path d="M34 52 Q30 58 32 64" stroke="${c1}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

const peacock: PropFactory = (c1, c2) => `
  <path d="M50 20 Q20 24 14 44 Q30 40 40 46 Q24 48 20 58 Q36 58 44 54" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M50 20 Q80 24 86 44 Q70 40 60 46 Q76 48 80 58 Q64 58 56 54" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="14" cy="44" r="2.4" fill="${c2}"/><circle cx="86" cy="44" r="2.4" fill="${c2}"/>
  <circle cx="20" cy="58" r="2.4" fill="${c2}"/><circle cx="80" cy="58" r="2.4" fill="${c2}"/>
  <ellipse cx="50" cy="56" rx="12" ry="20" fill="${c1}"/>
  <circle cx="50" cy="30" r="7" fill="${c1}"/>
  <path d="M44 27 Q40 28 40 31 L47 31Z" fill="${c2}"/>
  <circle cx="48" cy="28.5" r="1.1" fill="#1d2430"/>`;

const fish: PropFactory = (c1, c2) => `
  <path d="M28 50 Q42 34 58 44 Q70 38 76 30 Q74 44 70 50 Q74 56 76 70 Q70 62 58 56 Q42 66 28 50Z" fill="${c1}"/>
  <circle cx="40" cy="47" r="2.2" fill="#13202b"/>
  <path d="M46 40 Q52 34 56 38" stroke="${c2}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

/* ——— water & sky ——— */

const fountain: PropFactory = (c1, c2) => `
  <ellipse cx="50" cy="74" rx="34" ry="10" fill="${c1}"/>
  <ellipse cx="50" cy="72" rx="34" ry="10" fill="${c2}" opacity=".85"/>
  <rect x="45" y="38" width="10" height="34" rx="4" fill="${c1}"/>
  <path d="M50 38 Q42 26 46 16 M50 38 Q58 26 54 16 M50 38 Q44 20 50 10 M50 38 Q56 20 50 10" stroke="${c2}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
  <ellipse cx="50" cy="66" rx="10" ry="3.4" fill="${c1}" opacity=".7"/>`;

const pond: PropFactory = (c1, c2) => `
  <ellipse cx="50" cy="66" rx="36" ry="13" fill="${c2}" opacity=".85"/>
  <ellipse cx="50" cy="64" rx="36" ry="13" fill="${c1}"/>
  <path d="M28 63 Q40 59 52 63 Q66 67 74 63" stroke="${c2}" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M32 68 Q46 72 60 68" stroke="${c2}" stroke-width="2" fill="none" opacity=".5"/>`;

const cloud: PropFactory = (c1) => `
  <path d="M24 58 Q14 58 16 48 Q18 40 28 42 Q30 30 44 32 Q58 26 62 38 Q76 36 78 48 Q80 58 68 58 Z" fill="${c1}"/>`;

const sun: PropFactory = (c1, c2) => `
  ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) =>
    `<rect x="48.5" y="4" width="3" height="14" rx="1.5" fill="${c2}" transform="rotate(${a} 50 50)"/>`).join("")}
  <circle cx="50" cy="50" r="20" fill="${c1}"/>
  <circle cx="50" cy="50" r="13" fill="${c2}" opacity=".5"/>`;

const moon: PropFactory = (c1, c2) => `
  <path d="M62 14 A38 38 0 1 0 62 86 A30 30 0 1 1 62 14Z" fill="${c1}"/>
  <circle cx="40" cy="34" r="3" fill="${c2}" opacity=".5"/>
  <circle cx="34" cy="52" r="2.2" fill="${c2}" opacity=".5"/>`;

const starProp: PropFactory = (c1, c2) => `
  <path d="M50 8 L58 38 L90 40 L64 58 L72 88 L50 70 L28 88 L36 58 L10 40 L42 38 Z" fill="${c1}"/>
  <path d="M50 22 L55 40 L50 60 L45 40Z" fill="${c2}" opacity=".6"/>`;

const constellation: PropFactory = (c1, c2) => `
  ${[[20, 70], [34, 44], [52, 58], [66, 30], [84, 44]].map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="3.2" fill="${c1}"/>`).join("")}
  <path d="M20 70 L34 44 L52 58 L66 30 L84 44" stroke="${c2}" stroke-width="1.6" fill="none" opacity=".8" stroke-dasharray="4 3"/>`;

const rainbow: PropFactory = () => `
  ${["#ff9aa8", "#ffc46e", "#ffe98a", "#8fd8a0", "#8ecdf7", "#c9a8f7"].map((c, i) =>
    `<path d="M${14 + i * 6} 78 A${36 - i * 6} ${36 - i * 6} 0 0 1 ${86 - i * 6} 78" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join("")}`;

/* ——— architecture & bazaar ——— */

const arch: PropFactory = (c1, c2) => `
  <path d="M22 92 L22 46 Q22 20 50 16 Q78 20 78 46 L78 92 Z" fill="${c1}"/>
  <path d="M32 92 L32 50 Q32 30 50 27 Q68 30 68 50 L68 92 Z" fill="${c2}" opacity=".85"/>
  <circle cx="50" cy="30" r="3.4" fill="${c1}"/>`;

const dome: PropFactory = (c1, c2) => `
  <path d="M24 88 L24 60 Q24 34 50 30 Q76 34 76 60 L76 88 Z" fill="${c1}"/>
  <path d="M50 30 Q56 18 62 20 Q56 24 54 30 Z" fill="${c2}"/>
  <path d="M30 60 Q50 52 70 60" stroke="${c2}" stroke-width="2.4" fill="none" opacity=".8"/>
  <path d="M34 74 Q50 67 66 74" stroke="${c2}" stroke-width="2" fill="none" opacity=".6"/>`;

const windcatcher: PropFactory = (c1, c2) => `
  <rect x="36" y="44" width="28" height="50" rx="2" fill="${c1}"/>
  <rect x="30" y="12" width="40" height="36" rx="3" fill="${c1}"/>
  <path d="M34 18 L34 44 M42 16 L42 44 M50 15 L50 44 M58 16 L58 44 M66 18 L66 44" stroke="${c2}" stroke-width="3"/>
  <rect x="44" y="62" width="12" height="32" rx="5" fill="${c2}" opacity=".55"/>`;

const tower: PropFactory = (c1, c2) => `
  <rect x="38" y="30" width="24" height="62" rx="3" fill="${c1}"/>
  <path d="M34 30 L50 12 L66 30 Z" fill="${c2}"/>
  <path d="M50 12 L50 2 L64 6 L50 10Z" fill="${c2}"/>
  <rect x="46" y="52" width="8" height="12" rx="3.5" fill="${c2}" opacity=".8"/>
  <rect x="44" y="78" width="12" height="14" rx="5" fill="#ffd98a" opacity=".9"/>`;

const house: PropFactory = (c1, c2) => `
  <rect x="24" y="44" width="52" height="48" rx="3" fill="${c1}"/>
  <path d="M20 46 L50 22 L80 46 Z" fill="${c2}"/>
  <rect x="42" y="58" width="16" height="16" rx="2.5" fill="#ffd98a"/>
  <path d="M42 66 L58 66 M50 58 L50 74" stroke="${c1}" stroke-width="2"/>
  <rect x="30" y="80" width="10" height="12" rx="4" fill="${c2}" opacity=".7"/>`;

const lantern: PropFactory = (c1, c2) => `
  <path d="M50 4 L50 12" stroke="${c2}" stroke-width="2.4"/>
  <path d="M40 12 L60 12 L64 22 L36 22 Z" fill="${c1}"/>
  <rect x="36" y="22" width="28" height="42" rx="9" fill="${c2}" opacity=".92"/>
  <rect x="42" y="28" width="16" height="30" rx="6" fill="#fff2c0"/>
  <path d="M36 64 L64 64 L60 76 L40 76 Z" fill="${c1}"/>
  <circle cx="50" cy="82" r="3.4" fill="${c1}"/>`;

const carpet: PropFactory = (c1, c2) => `
  <path d="M28 10 L72 10 L76 90 L24 90 Z" fill="${c1}"/>
  <path d="M34 16 L66 16 L69 84 L31 84 Z" fill="${c2}" opacity=".5"/>
  <circle cx="50" cy="34" r="8" fill="${c1}"/>
  <circle cx="50" cy="34" r="4" fill="${c2}"/>
  <path d="M36 56 L64 56 M34 68 L66 68" stroke="${c1}" stroke-width="3.4"/>
  <path d="M28 10 L72 10 M24 90 L76 90" stroke="${c2}" stroke-width="3"/>`;

const banner: PropFactory = (c1, c2) => `
  <path d="M20 8 L80 8" stroke="${c2}" stroke-width="3" stroke-linecap="round"/>
  <path d="M28 8 L28 58 L40 48 L52 58 L52 8Z" fill="${c1}"/>
  <path d="M52 8 L52 46 L62 38 L72 46 L72 8Z" fill="${c2}" opacity=".85"/>
  <circle cx="40" cy="26" r="5" fill="${c2}"/>`;

const pot: PropFactory = (c1, c2) => `
  <path d="M36 34 Q26 44 26 60 Q26 82 50 82 Q74 82 74 60 Q74 44 64 34 Z" fill="${c1}"/>
  <ellipse cx="50" cy="34" rx="14" ry="5" fill="${c2}"/>
  <path d="M30 56 Q50 50 70 56" stroke="${c2}" stroke-width="3" fill="none" opacity=".7"/>
  <path d="M40 30 Q46 20 42 10 M54 30 Q54 18 58 12" stroke="${c2}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;

const spiceJar: PropFactory = (c1, c2) => `
  <path d="M36 40 L64 40 L60 84 L40 84 Z" fill="${c1}"/>
  <rect x="34" y="28" width="32" height="12" rx="4" fill="${c2}"/>
  <rect x="40" y="52" width="20" height="18" rx="3" fill="${c2}" opacity=".6"/>
  <circle cx="50" cy="61" r="4" fill="${c1}"/>`;

const awning: PropFactory = (c1, c2) => `
  ${[0, 1, 2, 3].map((i) =>
    `<path d="M${20 + i * 15} 30 Q${27.5 + i * 15} ${18} ${35 + i * 15} 30 L${35 + i * 15} 44 L${20 + i * 15} 44Z" fill="${i % 2 ? c1 : c2}"/>`).join("")}
  <path d="M16 30 L84 30" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>
  <path d="M22 44 L22 88 M78 44 L78 88" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>
  <path d="M22 60 Q50 52 78 60" stroke="${c2}" stroke-width="3" fill="none" opacity=".6"/>`;

const teapot: PropFactory = (c1, c2) => `
  <ellipse cx="52" cy="62" rx="22" ry="18" fill="${c1}"/>
  <path d="M34 56 Q20 52 18 40 Q26 44 36 48 Z" fill="${c1}"/>
  <path d="M72 54 Q84 58 82 70" stroke="${c1}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M44 42 Q52 34 60 42 L60 46 L44 46Z" fill="${c2}"/>
  <circle cx="52" cy="56" r="6" fill="${c2}" opacity=".7"/>
  <path d="M30 84 L74 84" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>`;

const tilestar: PropFactory = (c1, c2) => `
  <circle cx="50" cy="50" r="34" fill="none" stroke="${c2}" stroke-width="3" opacity=".7"/>
  ${[0, 60, 120, 180, 240, 300].map((a) =>
    `<rect x="47" y="18" width="6" height="26" rx="3" fill="${c1}" transform="rotate(${a} 50 50)"/>`).join("")}
  <circle cx="50" cy="50" r="12" fill="${c2}" opacity=".85"/>
  <circle cx="50" cy="50" r="5" fill="${c1}"/>`;

const kite: PropFactory = (c1, c2) => `
  <path d="M50 10 L74 42 L50 62 L26 42 Z" fill="${c1}"/>
  <path d="M50 10 L50 62 M26 42 L74 42" stroke="${c2}" stroke-width="2.4"/>
  <path d="M50 62 Q44 76 50 86 Q56 80 52 70" stroke="${c2}" stroke-width="2" fill="none"/>`;

const campfire: PropFactory = (c1, c2) => `
  <path d="M28 78 L72 66 M28 66 L72 78" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>
  <path d="M50 16 Q34 38 42 52 Q46 58 50 60 Q54 58 58 52 Q66 38 50 16Z" fill="${c2}"/>
  <path d="M50 32 Q44 44 50 54 Q56 44 50 32Z" fill="#fff2c0" opacity=".9"/>`;

const boat: PropFactory = (c1, c2) => `
  <path d="M14 62 L86 62 Q80 80 50 80 Q20 80 14 62Z" fill="${c1}"/>
  <rect x="46" y="30" width="4" height="32" fill="${c1}"/>
  <path d="M50 32 Q72 40 68 58 L50 58Z" fill="${c2}" opacity=".9"/>
  <path d="M46 36 Q30 44 34 58 L46 58Z" fill="${c2}" opacity=".7"/>
  <path d="M20 70 Q50 76 80 70" stroke="${c2}" stroke-width="2.4" fill="none" opacity=".6"/>`;

const lighthouse: PropFactory = (c1, c2) => `
  <path d="M40 88 L44 30 L56 30 L60 88 Z" fill="${c1}"/>
  <path d="M42 56 L58 56 M41 72 L59 72" stroke="${c2}" stroke-width="4"/>
  <rect x="42" y="18" width="16" height="12" rx="2" fill="${c2}"/>
  <circle cx="50" cy="24" r="4" fill="#fff2c0"/>
  <path d="M50 24 L20 14 M50 24 L20 34" stroke="#fff2c0" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M34 88 L66 88" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>`;

const waterfall: PropFactory = (c1, c2) => `
  <path d="M38 8 L38 58 Q38 66 44 66 L56 66 Q62 66 62 58 L62 8 Z" fill="${c2}" opacity=".8"/>
  <path d="M44 12 L44 54 M52 14 L52 56" stroke="#ffffff" stroke-width="2.4" opacity=".8"/>
  <ellipse cx="50" cy="72" rx="24" ry="8" fill="${c2}" opacity=".6"/>
  <circle cx="36" cy="70" r="2" fill="#fff"/><circle cx="62" cy="74" r="2.2" fill="#fff"/><circle cx="50" cy="78" r="2" fill="#fff"/>`;

const telescope: PropFactory = (c1, c2) => `
  <path d="M24 78 L74 42" stroke="${c1}" stroke-width="10" stroke-linecap="round"/>
  <circle cx="24" cy="78" r="7" fill="${c1}"/>
  <path d="M20 86 L28 70 M10 86 L38 86" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>
  <rect x="66" y="32" width="18" height="12" rx="3" fill="${c2}" transform="rotate(-35 74 40)"/>
  <circle cx="88" cy="30" r="4" fill="#fff2c0"/>`;

const eagle: PropFactory = (c1, c2) => `
  <path d="M50 46 Q30 26 12 36 Q28 44 40 50 Q26 52 20 60 Q36 62 48 54 L50 56 L52 54 Q64 62 80 60 Q74 52 60 50 Q72 44 88 36 Q70 26 50 46Z" fill="${c1}"/>
  <circle cx="50" cy="44" r="5" fill="${c2}"/>
  <path d="M47 40 L53 40 L50 44Z" fill="#ffd98a"/>`;

const fireflyCloud: PropFactory = (c1, c2) => `
  ${[[30, 50, 3], [44, 36, 2.4], [58, 52, 3.4], [70, 40, 2.2], [38, 64, 2], [64, 66, 2.6]].map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c1}"/><circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${c2}" opacity=".25"/>`).join("")}`;

const crystal: PropFactory = (c1, c2) => `
  <path d="M50 8 L66 38 L58 84 L42 84 L34 38 Z" fill="${c1}" opacity=".9"/>
  <path d="M50 8 L50 84 M34 38 L66 38" stroke="${c2}" stroke-width="2" opacity=".8"/>
  <path d="M42 84 L38 92 L62 92 L58 84Z" fill="${c2}" opacity=".7"/>`;

const camel: PropFactory = (c1, c2) => `
  <path d="M30 58 Q30 44 44 44 L62 44 Q70 44 72 52 L72 60 L66 60 L66 54 L38 54 L38 60 L32 60Z" fill="${c1}"/>
  <path d="M42 46 Q40 32 48 32 Q54 32 52 44 Z" fill="${c1}"/>
  <path d="M44 33 Q42 22 47 18 L50 22 Q46 26 48 32Z" fill="${c1}"/>
  <circle cx="49" cy="24" r="3.6" fill="${c1}"/>
  <path d="M52 21 L58 17" stroke="${c1}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M34 60 L34 78 M66 60 L66 78 M40 60 L40 76 M60 60 L60 76" stroke="${c1}" stroke-width="4.4" stroke-linecap="round"/>
  <path d="M36 50 Q50 44 64 50" stroke="${c2}" stroke-width="2.4" fill="none" opacity=".6"/>
  <circle cx="50" cy="20" r="1.2" fill="#1d2430"/>`;

/* ——— registry ——— */

export const PROPS: Record<string, PropFactory> = {
  cypress, treeRound, rose, tulip, flowerSmall, palm, lotus, camel,
  butterfly, bird, dove, deer, peacock, fish, eagle,
  fountain, pond, cloud, sun, moon, star: starProp, constellation, rainbow,
  arch, dome, windcatcher, tower, house, lantern, carpet, banner, flag: banner,
  pot, spiceJar, awning, teapot, tilestar, kite, campfire,
  boat, lighthouse, waterfall, telescope, fireflyCloud, crystal,
};

export type PropId = keyof typeof PROPS;

let uid = 0;

/** Build a positioned, animated prop element. Palette tinted via colors. */
export function makeProp(
  id: string,
  c1: string,
  c2: string,
  sizePct: number,
  xPct: number,
  yPct: number,
  delayMs: number,
  zIndex = 2,
): HTMLDivElement {
  const factory = PROPS[id] ?? PROPS.flowerSmall;
  const myId = `pg${++uid}`;
  const wrap = document.createElement("div");
  wrap.className = "prop";
  wrap.style.cssText = `width:${sizePct}%;left:${xPct}%;top:${yPct}%;z-index:${zIndex};--prop-delay:${delayMs}ms;`;
  wrap.innerHTML = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="${myId}" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="${c2}" flood-opacity="0.55"/>
        </filter>
      </defs>
      <g filter="url(#${myId})">${factory(c1, c2)}</g>
    </svg>`;
  return wrap;
}
