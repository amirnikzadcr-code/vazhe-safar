#!/bin/bash
# ============================================================
# v1.7 "match the reference photo" backgrounds
# Bright storybook Persian scenes + LUSH GREEN FOLIAGE FRAME
# around the screen edges (signature of the user's mockup).
# Sequential generation (parallel SDK calls crash), 3 retries.
# ============================================================
RAW="/home/z/my-project/scripts/assets-raw"
BG_PNG="/home/z/my-project/public/assets/bg/png"
BG="/home/z/my-project/public/assets/bg"
mkdir -p "$RAW" "$BG_PNG" "$BG"

FRAME="dense lush green vine leaves and small pink flowers framing all four edges of the screen, bright cheerful storybook mobile-game art, rich saturated happy colors, vivid blue sky, soft volumetric sunlight, clean uncluttered center, premium casual game illustration, ultra detailed, masterpiece, no people, no characters, no text, no letters, no watermark, portrait"

gen_scene() { # name prompt
  local name="$1"; local prompt="$2"
  local png="$BG_PNG/$name.png"
  local webp="$BG/$name.webp"
  if [ -s "$webp" ] && [ "$webp" -nt "$BG_PNG" ]; then echo "SKIP $name"; return 0; fi
  for attempt in 1 2 3; do
    z-ai image -p "$prompt, $FRAME" -o "$png" -s 768x1344 > /dev/null 2>&1
    if [ -s "$png" ]; then
      python3 - "$png" "$webp" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im.save(dst, "WEBP", quality=84, method=6)
import os
print(f"WEBP {dst} {os.path.getsize(dst)//1024}KB")
PY
      echo "OK  $name"; return 0
    fi
    echo "RETRY($attempt) $name"; sleep 3
  done
  echo "FAIL $name"; return 1
}

gen_scene ch01 "magical Persian spring garden with rose bushes, turquoise fountain, stone bridge over water channel, Persepolis-style pillars in distance"
gen_scene ch02 "cheerful Persian bazaar courtyard with colorful spice stalls, red brick arches, glowing lanterns, carpets hanging"
gen_scene ch03 "golden desert dunes with a happy camel caravan on the horizon, warm sunny sky, palm oasis"
gen_scene ch04 "enchanted green forest with soft sunbeams through leaves, glowing fireflies, mossy stones and mushrooms"
gen_scene ch05 "fairytale mountain castle above pink clouds, green flags dancing in wind, snowy peaks, rainbow"
gen_scene ch06 "cute desert city of Yazd with clay windcatcher towers at warm sunset, glowing windows, String of lights"
gen_scene ch07 "turquoise Persian gulf beach with wooden lenj boats, white waves, palm trees, seashells on golden sand"
gen_scene ch08 "stepped mountain village with terraced houses, waterfalls, green rice fields, morning light"
gen_scene ch09 "magical starry desert night, glowing milky way, cute constellations, warm campfire glow between dunes"
gen_scene ch10 "grand celebration garden of light with fireworks, glowing flower trees, golden lanterns, joyful festival"
gen_scene map2 "cute Persian village winding cobblestone path going up a green hill, tiny houses, flower gardens, sunny sky" 

echo "ALL DONE"
