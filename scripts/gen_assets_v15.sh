#!/bin/bash
# ============================================================
# v1.5 "exact reference redesign" assets
# Characters/objects -> solid green screen -> chroma keyed
# Scenes -> direct webp
# Sequential generation (parallel SDK calls crash), 3 retries each.
# ============================================================
RAW="/home/z/my-project/scripts/assets-raw"
BG_PNG="/home/z/my-project/public/assets/bg/png"
BG="/home/z/my-project/public/assets/bg"
mkdir -p "$RAW" "$BG_PNG" "$BG"

CHAR_STYLE="high-end 3D animated movie character render, Pixar style, soft studio lighting, subsurface skin shading, expressive warm face, ultra detailed, crisp edges, masterpiece quality, centered composition, full subject visible with margin around, on a completely flat solid uniform bright green screen background (chroma key green #00FF00), no shadows on background, no text, no watermark"
SCENE_STYLE="premium mobile game background art, cheerful stylized 3D illustration, rich saturated happy colors, soft volumetric light, ultra high quality, painterly polish, no people, no characters, no text, no letters, no watermark, masterpiece"

gen_char() { # name prompt
  local name="$1"; local prompt="$2"
  local out="$RAW/char-$name-raw.png"
  if [ -s "$out" ]; then echo "SKIP $name"; return 0; fi
  for attempt in 1 2 3; do
    z-ai image -p "$prompt, $CHAR_STYLE" -o "$out" -s 1024x1024 > /dev/null 2>&1
    [ -s "$out" ] && { echo "OK  $name"; return 0; }
    echo "RETRY($attempt) $name"; sleep 3
  done
  echo "FAIL $name"; return 1
}

gen_scene() { # name prompt size
  local name="$1"; local prompt="$2"; local size="${3:-768x1344}"
  local png="$BG_PNG/$name.png"
  local webp="$BG/$name.webp"
  if [ -s "$webp" ]; then echo "SKIP $name"; return 0; fi
  for attempt in 1 2 3; do
    z-ai image -p "$prompt, $SCENE_STYLE" -o "$png" -s "$size" > /dev/null 2>&1
    if [ -s "$png" ]; then
      python3 - "$png" "$webp" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im.save(dst, "WEBP", quality=84, method=6)
print(f"WEBP {dst} {__import__('os').path.getsize(dst)//1024}KB")
PY
      echo "OK  $name"; return 0
    fi
    echo "RETRY($attempt) $name"; sleep 3
  done
  echo "FAIL $name"; return 1
}

# ---- character: identical description every time for consistency ----
GP="adorable elderly Iranian grandfather, round friendly face, big warm smile, thick neat gray mustache and short gray beard, wearing a flat brown tweed newsboy cap, cream knitted shirt and a brown knitted sleeveless vest with subtle Persian pattern"

gen_char seat  "$GP, sitting behind a rustic round wooden tea table, holding a traditional Persian steaming glass of hot tea (dainty estekan glass with saucer), a cute chubby white cat with orange patches sitting on the table beside the tea, waving hello at the viewer with the other hand, cozy half-body composition"
gen_char thumb "$GP, joyful celebrating pose giving a big thumbs up with one hand, waist-up portrait, sparkling happy eyes"
gen_char rest  "$GP, cozy relaxed pose resting his cheek on one hand with a sleepy content smile, eyes softly closed, waist-up portrait, warm and calm"

gen_char gift  "festive wrapped gift box with glossy pink and gold ribbon bow, lid popping open, pile of shiny gold coins spilling out with sparkles and small stars, game UI icon style, single object"
gen_char chest "wooden treasure chest with golden metal bands, wide open, overflowing with glowing gold coins and a few blue gems, sparkles, game UI icon style, single object"

# ---- scenes ----
gen_scene home2 "joyful happy Iranian city plaza on a bright sunny day: vivid blue sky with big fluffy white clouds and smiling sun, turquoise-tiled mosque dome with two elegant minarets, warm old brick and beige houses with wooden bay windows, green trees and colorful flower beds in the foreground, cheerful inviting storybook mood, large clear sky area in top half"
gen_scene map2  "cheerful stylized storybook Iranian village seen from a gentle elevated angle: lush green meadows and terraces, round leafy trees, colorful flower bushes, tiny cozy houses with terracotta roofs, a distant turquoise domed mosque and soft blue mountains under a clear happy blue sky, soft even lighting, uncluttered center areas for game path overlay"
gen_scene sunset2 "magical cozy dusk scene from a balcony: silhouette of an elderly grandfather wearing a flat cap and a small cat sitting side by side on a balcony seen from behind, gazing at an old Iranian city skyline with mosque domes and minarets, glowing warm orange and pink sunset sky with the first twinkling stars, hanging string lights with warm glowing bulbs, potted flowers on the balcony railing, nostalgic heartwarming mood" 864x1152

echo "ALL DONE"
