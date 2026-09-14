/**
 * proc_bgs.js — post-process generated raw PNGs for the game:
 *   1. saturation boost (user: «رنگ شاداب نداره») via sharp modulate
 *   2. slight contrast + brightness tune
 *   3. resize to device-friendly width, encode webp (quality 82)
 * Writes straight into public/assets/{bg,map}.
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const RAW = "/home/z/my-project/scripts/gen_raw";
const BG = "/home/z/my-project/public/assets/bg";
const MAP = "/home/z/my-project/public/assets/map";

const JOBS = [
  { key: "home3", dir: BG, width: 820 },
  { key: "play3", dir: BG, width: 820 },
  { key: "home2", dir: BG, width: 820 },
  { key: "map2", dir: BG, width: 820 },
  { key: "sunset2", dir: BG, width: 820 },
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `m${String(i + 1).padStart(2, "0")}`,
    dir: MAP,
    width: 720,
  })),
];

for (const { key, dir, width } of JOBS) {
  const src = path.join(RAW, `${key}.png`);
  if (!fs.existsSync(src)) { console.log(`MISS ${key}`); continue; }
  const out = path.join(dir, `${key}.webp`);
  await sharp(src)
    .modulate({ saturation: 1.22, brightness: 1.03 })
    .linear(1.04, -6)               /* gentle contrast lift */
    .resize({ width, height: Math.round((width * 1344) / 768), fit: "cover" })
    .webp({ quality: 82, effort: 4 })
    .toFile(out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`OK  ${key} → ${out} (${kb} KB)`);
}
console.log("DONE");
