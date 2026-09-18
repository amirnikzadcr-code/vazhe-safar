#!/usr/bin/env bash
# EE — new chapter backdrops (user feedback round):
#   ch01 «باغ نخستین»  → grander, more attractive Persian garden
#   ch03 «کویر زرین»   → شاداب: bright midday desert, joyful caravan
#   ch04 «جنگل مه‌آلود» → شاداب: sunny vivid forest
#   ch06 «پارسه کوروش» → historical Persepolis (NO religious motifs)
#   m01/m03/m04/m06    → matching map-realm variants
# Raw 768x1344 → processed by proc_bgs_ee.js (saturation+webp).
set -uo pipefail
RAW=/home/z/my-project/scripts/gen_raw
mkdir -p "$RAW"

gen () { # $1 name  $2 prompt
  local out="$RAW/$1.png"
  for try in 1 2 3; do
    echo "== $1 (try $try)"
    z-ai image -p "$2" -o "$out" -s 768x1344 && [ -s "$out" ] && return 0
    sleep 3
  done
  echo "!! FAILED $1"; return 1
}

gen ch01 "Magical grand Persian garden with a beautiful turquoise-tiled pavilion, golden fountains, symmetrical flower beds full of colorful tulips roses and daisies, blooming pink and white trees, warm morning sunlight, butterflies flying, deep dreamy perspective, cheerful vibrant flat vector illustration, mobile game background art, rich saturated colors, high quality, no text, no people" &
gen ch03 "Cheerful golden desert at bright midday, vivid turquoise blue sky with fluffy white clouds, rolling golden sand dunes, happy smiling camel caravan with colorful tassels and small flags crossing the dunes, lush green oasis with tall palm trees and a turquoise pool in the foreground, joyful vibrant flat vector illustration, mobile game background, saturated warm colors, high quality, no text, no people faces" &
wait
gen ch04 "Vibrant enchanted sunny forest, bright saturated green ferns and mossy rocks, colorful wildflowers and red capped mushrooms, cheerful golden sunbeams streaming between tall trees, colorful butterflies and glowing fireflies, winding dirt path, lively joyful atmosphere, vivid flat vector illustration, mobile game background art, rich saturated colors, high quality, no text, no people" &
gen ch06 "Majestic ancient Persepolis in bright golden daylight, grand Achaemenid stone columns, Gate of All Nations with winged bull lamassu statues, wide ceremonial stone stairway with carvings, colorful banner flags, rocky mountains behind, clear blue sky, historic royal atmosphere, strictly no religious symbols, no mosque, no dome, flat vector illustration, mobile game background, warm gold and lapis blue colors, high quality, no text, no people" &
wait
gen m01 "Wide storybook view of a lush Persian garden realm, turquoise pavilion on a hill, winding stone paths, flower fields in pink red and yellow, fountains, small bridges, sunny blue sky, cheerful flat vector illustration, mobile game map background, rich saturated colors, high quality, no text, no people" &
gen m03 "Wide storybook view of a golden desert realm, dunes with a winding caravan trail, palm oasis with turquoise pond, colorful market tents, camels resting, bright turquoise sky with soft clouds, cheerful flat vector illustration, mobile game map background, saturated warm colors, high quality, no text, no people" &
wait
gen m04 "Wide storybook view of a vivid green forest realm clearing, giant old trees, glowing fireflies, colorful flowers and mushrooms, small wooden cottage, sunbeams, butterflies, joyful flat vector illustration, mobile game map background, rich saturated colors, high quality, no text, no people" &
gen m06 "Wide storybook view of ancient Persepolis terrace from afar, rows of tall stone columns, lamassu gate statues, ceremonial stairways, golden plains and mountains, bright blue sky, historical royal mood, strictly no religious symbols, no mosque, no dome, flat vector illustration, mobile game map background, warm gold and lapis colors, high quality, no text, no people" &
wait
echo DONE
