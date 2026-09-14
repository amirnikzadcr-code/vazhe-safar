/**
 * proc_bgs_o.js — session O: process the 30 new raw images
 *   • ch01..ch20  → public/assets/bg  (play-screen chapter backdrops)
 *   • m11..m20    → public/assets/map (hard-tier map realms)
 * Same vivid pipeline as proc_bgs.js (saturation + contrast + webp q82).
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const RAW = "/home/z/my-project/scripts/gen_raw";
const BG = "/home/z/my-project/public/assets/bg";
const MAP = "/home/z/my-project/public/assets/map";

const JOBS = [
  ...Array.from({ length: 20 }, (_, i) => ({
    key: `ch${String(i + 1).padStart(2, "0")}`,
    dir: BG,
    width: 820,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `m${String(i + 11).padStart(2, "0")}`,
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
    .linear(1.04, -6)
    .resize({ width, height: Math.round((width * 1344) / 768), fit: "cover" })
    .webp({ quality: 82, effort: 4 })
    .toFile(out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`OK  ${key} → ${out} (${kb} KB)`);
}
console.log("DONE");
