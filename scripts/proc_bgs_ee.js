/**
 * proc_bgs_ee.js — EE: process the 8 new raw images
 *   ch01/ch03/ch04/ch06 → public/assets/bg (820px, saturated, webp q82)
 *   m01/m03/m04/m06     → public/assets/map (720px)
 * Same vivid pipeline as proc_bgs_o.js.
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const RAW = "/home/z/my-project/scripts/gen_raw";
const BG = "/home/z/my-project/public/assets/bg";
const MAP = "/home/z/my-project/public/assets/map";

const JOBS = [
  ...["ch01", "ch03", "ch04", "ch06"].map((key) => ({ key, dir: BG, width: 820 })),
  ...["m01", "m03", "m04", "m06"].map((key) => ({ key, dir: MAP, width: 720 })),
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
