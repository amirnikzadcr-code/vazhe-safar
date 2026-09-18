/**
 * proc_bgs_ff.js — FF: process the 2 new raw images
 *   ch06 → public/assets/bg  (820px, saturated, webp q82)
 *   m06  → public/assets/map (720px)
 * Same vivid pipeline as proc_bgs_ee.js.
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const RAW = "/home/z/my-project/scripts/gen_raw";
const JOBS = [
  { key: "ch06", dir: "/home/z/my-project/public/assets/bg", width: 820 },
  { key: "m06", dir: "/home/z/my-project/public/assets/map", width: 720 },
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
