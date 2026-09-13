#!/bin/bash
# v1.3 asset regeneration — Unity-level quality, output as optimized WebP
# Sequential generation (parallel SDK calls crash), 3 retries each.
OUT_PNG="/home/z/my-project/public/assets/bg/png"
OUT="/home/z/my-project/public/assets/bg"
mkdir -p "$OUT_PNG"

STYLE="premium mobile game key art, rich painterly illustration with deep atmospheric depth, layered foreground midground background parallax composition, volumetric god rays, soft rim lighting, glowing warm highlights, subtle floating dust motes, simplified Persian miniature inspired geometry, cinematic composition, no people, no characters, no text, no letters, no watermark, masterpiece, ultra high quality digital painting"
CALM="large calm uncluttered sky area in upper third for UI overlay, gentle ground detail in lower half"

gen() { # name prompt
  local name="$1"; local prompt="$2"
  local png="$OUT_PNG/$name.png"
  local webp="$OUT/$name.webp"
  if [ -s "$webp" ]; then echo "SKIP $name"; return 0; fi
  for attempt in 1 2 3; do
    z-ai image -p "$prompt, $STYLE, $CALM" -o "$png" -s 768x1344 > /dev/null 2>&1
    if [ -s "$png" ]; then
      python3 - "$png" "$webp" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im.save(dst, "WEBP", quality=82, method=6)
print(f"WEBP {dst} {__import__('os').path.getsize(dst)//1024}KB")
PY
      echo "OK  $name"; return 0
    fi
    echo "RETRY($attempt) $name"; sleep 3
  done
  echo "FAIL $name"; return 1
}

gen menu "breathtaking panoramic view of Naqsh-e Jahan inspired grand Persian square at golden hour: majestic turquoise tiled mosque portal with intricate muqarnas, grand bazaar domes with colorful mosaics, warm amber light flooding stone pavement, distant snowy mountains, floating glowing golden petals, deep brown and gold palette"

gen ch01 "serene Persian paradise garden in soft morning light: turquoise tiled fountain pool with still water reflections, blooming rose bushes, tall dark cypress trees, ornate stone arch bridge, white doves flying, morning mist, emerald rose and gold palette"

gen ch02 "cozy old Persian bazaar street at warm afternoon: high arched brick vaults with skylight holes casting light beams, hanging colorful glass lanterns, spice bowls with saffron and turmeric pyramids, rolled Persian carpets, warm terracotta and saffron palette, soft golden dust in air"

gen ch03 "vast golden desert dunes at fiery sunset: long caravan of camels silhouette winding over a distant dune ridge, small palm oasis with calm reflecting pond, huge warm amber and coral sky with soft violet clouds, wind-blown sand sparkles, deep brown and gold palette"

gen ch04 "misty ancient hyrcanian rainforest: colossal moss-covered trees, dramatic god rays piercing through luminous fog, giant ferns, glowing fireflies floating, small waterfall, deep emerald and teal palette with golden light accents"

gen ch05 "majestic snowy mountain peaks with ancient stone citadel on a cliff edge: round watchtowers with small fluttering flags, warm torchlight in windows, sea of clouds below summit, cold blue twilight with golden torch accents"

gen ch06 "ancient adobe desert city at dusk: tall windcatcher badgir towers, clay domes, warm ochre earthen walls glowing in last light, indigo twilight sky with first stars, warm lantern light beginning to glow in windows"

gen ch07 "turquoise southern sea coast at bright midday: traditional wooden lenj boats with colorful prows on calm crystal water, palm trees leaning over pearl-white beach, gentle waves sparkling, coral turquoise and gold palette, seagulls far away"

gen ch08 "terraced mountain village on lush green cliffside: cascading flat-roofed houses stacked on the slope with glowing warm windows, wooden balconies, thin waterfall and evening mist, alpine meadow flowers, cozy dusk glow"

gen ch09 "deep starry night over calm desert plain: vivid milky way arching across huge sky, glowing constellations connected by thin golden lines, small astronomical observatory dome silhouette, warm campfire glow in foreground, midnight blue and gold palette"

gen ch10 "magical grand Persian palace garden at celebration night: illuminated mirrored fountain with golden water jets, glowing colorful tiled arches and iwans, proud peacocks, floating golden lanterns and gentle distant fireworks, jewel tones with warm brown and gold"

echo "=== ALL DONE ==="
