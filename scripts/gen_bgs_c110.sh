#!/bin/bash
# ---------------------------------------------------------------------------
# gen_bgs_c110.sh — session O: play-screen chapter backdrops ch01..ch10
# (the chapters.ts entries referenced them but the files never existed).
# ---------------------------------------------------------------------------
set -u
OUT=/home/z/my-project/scripts/gen_raw
mkdir -p "$OUT"

STYLE="colorful cartoon mobile game background art, vibrant saturated colors, cheerful storybook illustration style, crisp clean shapes, soft warm lighting, high quality, detailed, no text, no words, no characters, no UI, no path"

declare -A PROMPTS
PROMPTS[ch01]="lush spring garden with blooming cherry and almond trees, tulips and daisies everywhere, butterflies, distant pink blossoms, bright blue sky, $STYLE"
PROMPTS[ch02]="vast flower meadow with a small waterfall, colorful butterflies, poppies and daisies to the horizon, warm spring light, rainbow after a light shower, $STYLE"
PROMPTS[ch03]="golden desert dunes at sunset, camel caravan silhouettes far on the horizon, orange and pink sky, a small oasis with palm trees, cozy campfire, $STYLE"
PROMPTS[ch04]="misty green forest with tall trees, sunbeams piercing through fog, glowing fireflies, emerald moss and ferns, magical atmosphere, $STYLE"
PROMPTS[ch05]="majestic mountain castle on a snowy peak above the clouds, fluttering colorful flags, alpine meadow with wildflowers in the foreground, bright daylight, $STYLE"
PROMPTS[ch06]="desert city with Persian windcatcher towers and adobe walls at dusk, warm glowing windows, turquoise dome, orange-purple sky, hanging lanterns, $STYLE"
PROMPTS[ch07]="tropical pearl coast with turquoise sea, wooden lenj boats with white sails, sandy beach with palm trees, seashells and starfish, bright sunny day, $STYLE"
PROMPTS[ch08]="stepped village houses stacked on a green mountainside like Masuleh, terraced roofs with flowers, waterfalls, morning mist, warm windows, $STYLE"
PROMPTS[ch09]="starry night over desert, brilliant milky way, glowing constellations, crescent moon, cozy campfire with carpet and teapot in the foreground, deep blue night, $STYLE"
PROMPTS[ch10]="magical garden festival at twilight, glowing lanterns in trees, colorful fireworks, flower arches, joyful celebration decorations, purple and gold sky, $STYLE"

for key in ch01 ch02 ch03 ch04 ch05 ch06 ch07 ch08 ch09 ch10; do
  if [ -s "$OUT/$key.png" ]; then
    echo "skip $key (exists)"
    continue
  fi
  echo ">>> generating $key ..."
  z-ai image -p "${PROMPTS[$key]}" -o "$OUT/$key.png" -s 768x1344 && echo "ok $key" || echo "FAILED $key"
done
echo "DONE-C110"
