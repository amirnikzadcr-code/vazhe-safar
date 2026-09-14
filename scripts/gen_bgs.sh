#!/bin/bash
# ---------------------------------------------------------------------------
# gen_bgs.sh — regenerate ALL game backgrounds with vivid, saturated
# cartoon game-art prompts (user: «زمینه‌ها کیفیت نداره رنگ شاداب نداره»).
# Portrait 768x1344 → post-processed by proc_bgs.js (saturation boost + webp).
# ---------------------------------------------------------------------------
set -u
OUT=/home/z/my-project/scripts/gen_raw
mkdir -p "$OUT"

STYLE="colorful cartoon mobile game background art, vibrant saturated colors, cheerful storybook illustration style, crisp clean shapes, soft warm lighting, high quality, detailed, no text, no words, no characters, no UI, no path"

declare -A PROMPTS
PROMPTS[home3]="Persian village courtyard at bright morning, cozy mud-brick house with wooden door, blooming pomegranate trees, colorful flower pots, distant blue mountains, clear turquoise sky with fluffy clouds, $STYLE"
PROMPTS[play3]="warm Persian teahouse interior wall backdrop, soft cream and honey tones, decorative arabesque tiles on the edges, gentle bokeh, bright and airy, calm simple center area, $STYLE"
PROMPTS[m01]="lush spring garden with blooming cherry and almond trees, tulips and daisies everywhere, butterflies, distant pink blossoms, bright blue sky, $STYLE"
PROMPTS[m02]="bustling Persian bazaar street with brick arches, colorful spice stalls, hanging lanterns, vibrant carpets and textiles, golden afternoon light, $STYLE"
PROMPTS[m03]="golden desert dunes at sunset, camel caravan silhouettes far on the horizon, orange and pink sky, a small oasis with palm trees, $STYLE"
PROMPTS[m04]="misty green forest with tall trees, sunbeams piercing through fog, glowing fireflies, emerald moss and ferns, magical atmosphere, $STYLE"
PROMPTS[m05]="majestic mountain castle on a snowy peak above the clouds, fluttering colorful flags, alpine meadow with wildflowers in the foreground, bright daylight, $STYLE"
PROMPTS[m06]="desert city with Persian windcatcher towers and adobe walls at dusk, warm glowing windows, turquoise dome, orange-purple sky, $STYLE"
PROMPTS[m07]="tropical pearl coast with turquoise sea, wooden lenj boats with white sails, sandy beach with palm trees, seashells and starfish, bright sunny day, $STYLE"
PROMPTS[m08]="stepped village houses stacked on a green mountainside like Masuleh, terraced roofs with flowers, waterfalls, morning mist, $STYLE"
PROMPTS[m09]="starry night over desert, brilliant milky way, glowing constellations, crescent moon, cozy campfire with carpet and teapot in the foreground, deep blue night, $STYLE"
PROMPTS[m10]="magical garden festival at twilight, glowing lanterns in trees, colorful fireworks, flower arches, joyful celebration decorations, purple and gold sky, $STYLE"

for key in home3 play3 m01 m02 m03 m04 m05 m06 m07 m08 m09 m10; do
  if [ -s "$OUT/$key.png" ]; then
    echo "skip $key (exists)"
    continue
  fi
  echo ">>> generating $key ..."
  z-ai image -p "${PROMPTS[$key]}" -o "$OUT/$key.png" -s 768x1344 && echo "ok $key" || echo "FAILED $key"
done
echo "DONE"
