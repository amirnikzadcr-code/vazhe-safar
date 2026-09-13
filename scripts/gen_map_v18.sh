#!/bin/bash
# ============================================================
# v1.8 — joyful COLORFUL map ground (user: "زمینش رو شاد تر
# رنگا رنگ تر بکن") — replaces the muted cobblestone map.
# NO road in the art (the game draws its own SVG level path),
# open vivid flower meadow so level nodes stay readable.
# ============================================================
RAW="/home/z/my-project/scripts/assets-raw"
BG="/home/z/my-project/public/assets/bg"
mkdir -p "$RAW" "$BG"

PROMPT="bright cheerful storybook mobile-game level map background, entire ground is a wide open lush VIVID GREEN grass meadow densely dotted with many colorful flowers, red orange pink purple yellow tulips daisies and blossoms, tiny cute Persian village houses with terracotta roofs far along the left and right edges, round bushy green trees, soft rolling hills, vivid blue sky with fluffy white clouds and a warm glowing sun, joyful saturated candy colors, premium casual puzzle game map art style, big clean open grass area in the middle for level markers, ultra detailed, masterpiece, no people, no characters, no animals, no birds, no text, no letters, no road, no path, no cobblestones, no watermark"

FRAME="dense lush green vine leaves and small pink flowers framing all four edges of the screen, portrait"

for attempt in 1 2 3; do
  z-ai image -p "$PROMPT, $FRAME" -o "$RAW/map3.png" -s 768x1344 > /dev/null 2>&1
  if [ -s "$RAW/map3.png" ]; then
    python3 - "$RAW/map3.png" "$BG/map2.webp" <<'PY'
import sys
from PIL import Image, ImageEnhance
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im = ImageEnhance.Color(im).enhance(1.12)      # extra saturation punch
im = ImageEnhance.Brightness(im).enhance(1.03)
im.save(dst, "WEBP", quality=84, method=6)
import os
print(f"WEBP {dst} {os.path.getsize(dst)//1024}KB")
PY
    exit 0
  fi
  echo "retry $attempt"
  sleep 2
done
echo "FAILED"
exit 1
