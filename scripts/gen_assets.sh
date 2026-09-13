#!/bin/bash
# Sequential asset generation (parallel SDK calls crash — keep strict order)
OUT="/home/z/my-project/public/assets/bg"
ICON="/home/z/my-project/public/assets/icons"

STYLE="stylized mobile game key art, flat layered painterly illustration, simplified Persian miniature inspired geometry, soft gradients, atmospheric haze, glowing warm highlights, cinematic composition, no people, no text, no letters, no watermark, ultra high quality digital painting"
CALM="large calm empty sky area in upper third, gentle ground detail in lower half, uncluttered composition"

gen() { # name size prompt
  local name="$1"; local size="$2"; local prompt="$3"
  local target="$OUT/$name.png"
  [ "$size" = "1024x1024" ] && target="$ICON/$name.png"
  if [ -s "$target" ]; then echo "SKIP $name"; return 0; fi
  for attempt in 1 2 3; do
    z-ai image -p "$prompt, $STYLE, $CALM" -o "$target" -s "$size" > /dev/null 2>&1
    if [ -s "$target" ]; then echo "OK  $name"; return 0; fi
    echo "RETRY($attempt) $name"; sleep 3
  done
  echo "FAIL $name"; return 1
}

B="breathtaking panoramic stylized view of a magical Persian paradise at golden hour: turquoise tiled garden fountains, grand bazaar domes with colorful tiles, snowy mountain peak in far distance, floating glowing petals"

gen menu  768x1344 "$B"
gen ch01  768x1344 "serene Persian paradise garden in morning light: turquoise tiled fountain pool, rose bushes, tall cypress trees, stone arch bridge, doves in sky, emerald and rose palette"
gen ch02  768x1344 "cozy old Persian bazaar street at warm afternoon: arched brick domes, hanging colorful glass lanterns, spice bowls and rolled carpets in stalls, saffron and terracotta palette, soft dust light rays"
gen ch03  768x1344 "vast golden desert dunes at sunset: distant camel caravan silhouette on a dune ridge, small palm oasis with a calm pond, big warm amber sky with soft violet clouds"
gen ch04  768x1344 "misty ancient hyrcanian rainforest: tall mossy trees, soft god rays through fog, ferns and giant leaves, glowing fireflies, deep emerald and teal palette"
gen ch05  768x1344 "majestic snowy mountain peaks with an ancient stone citadel on a cliff: watchtowers with small flags, cold blue tones with warm torch light, clouds below the summit"
gen ch06  768x1344 "ancient adobe desert city at dusk: windcatcher towers, clay domes, warm ochre walls under an indigo twilight sky, first lantern lights glowing in windows"
gen ch07  768x1344 "turquoise southern sea coast at bright day: wooden lenj boats on calm water, palm trees on shore, pearl-white beach, coral and turquoise palette, seagulls far away"
gen ch08  768x1344 "terraced mountain village on lush green cliffside: cascading flat-roofed houses stacked on the slope, wooden balconies, waterfall and mist, evening glow"
gen ch09  768x1344 "deep starry night over a calm desert plain: vivid milky way sky, glowing constellations, small observatory dome silhouette, warm campfire glow, midnight blue and gold palette"
gen ch10  768x1344 "magical grand Persian palace garden at celebration night: illuminated mirrored fountain, glowing colorful tiled arches, peacocks, floating golden lights and gentle fireworks, jewel tones"
gen icon  1024x1024 "minimal premium game icon: circular Persian geometric girih medallion in turquoise and gold with a subtle speech-bubble shaped negative space in center, dark elegant background, soft glow"

echo "=== ALL DONE ==="
