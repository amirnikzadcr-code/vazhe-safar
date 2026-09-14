#!/bin/bash
# ---------------------------------------------------------------------------
# gen_maps_o.sh — session O: level-map realm scenes m11..m20 (hard tier).
# Same painted-path style as m01..m10. Raw → scripts/gen_raw, processed by
# proc_bgs_o.js into public/assets/map.
# ---------------------------------------------------------------------------
set -u
OUT=/home/z/my-project/scripts/gen_raw
mkdir -p "$OUT"

STYLE="glossy 3D cartoon render for a casual mobile puzzle game, Royal Match level map art style, vibrant saturated colors, soft painterly shading, warm cheerful lighting, extremely detailed, high quality"
PATHDESC="A light beige stone-paved path starts wide at the bottom center and winds upward in a smooth S-curve (curving right, then left, then right again), becoming narrower, ending at the top center. The path is completely empty, clean and clearly visible the whole way."
NOTXT="no characters, no text, no letters, no numbers, no UI buttons, no icons on the path"

declare -A T
T[m11]="The path climbs through a mystical cloud forest of giant ancient trees with wooden rope bridges, glowing soft mist between the trunks, emerald moss and glowing fireflies along the path, teal and green tones, sunbeams from above."
T[m12]="The path follows the shore of a serene silver mountain lake at magical night, a huge full moon and its glowing reflection, glowing lotus flowers on the water, a small wooden pier at the top, fireflies and smooth stones along the path, deep indigo and teal night palette."
T[m13]="The path winds through a magical crystal cave with giant glowing amethyst and turquoise crystals, a calm underground pool with sparkling reflections, crystal clusters and glowing pebbles along the path, violet and cyan glow."
T[m14]="The path climbs through red rock canyon hills with striped fairy chimneys at golden hour, warm crimson and orange cliffs, a green valley with red poppies and small shrubs along the path, bright turquoise sky."
T[m15]="The path climbs across floating sky islands with lush hanging gardens, waterfalls pouring into soft clouds below, a rainbow arch, colorful hot air balloons far away, pastel blue sky, flower bushes and lanterns along the path."
T[m16]="The path climbs along a tropical turquoise lagoon with coral reefs visible under crystal clear water, pearl oysters and starfish on white sand, palm trees and hibiscus along the path, a wooden tower at the top, bright sunny sky."
T[m17]="The path climbs toward a majestic ancient golden Persian city with grand columns, golden palaces and ornate carvings at sunset, colorful banners and braziers along the path, warm epic golden light."
T[m18]="The path climbs snowy mountain slopes under a glowing teal and purple northern-lights night sky, brilliant stars, warm lit wooden cabins and pine trees along the path, silver snow sparkling."
T[m19]="The path crosses a frozen lake toward a grand ice palace with crystal towers, aurora light reflecting on the ice, snow drifts and ice crystals along the path, ice blue and silver palette with soft snowfall."
T[m20]="The path climbs to an epic golden palace on a mountain summit at celebration night, colorful fireworks and glowing lanterns in the sky, garlands of pennant flags, a shining golden trophy above the palace gate, festive magical light."

for key in m11 m12 m13 m14 m15 m16 m17 m18 m19 m20; do
  if [ -s "$OUT/$key.png" ]; then
    echo "skip $key (exists)"
    continue
  fi
  echo ">>> generating $key ..."
  z-ai image -p "Vertical mobile game level map. ${PATHDESC} ${T[$key]} ${STYLE}. ${NOTXT}" -o "$OUT/$key.png" -s 768x1344 && echo "ok $key" || echo "FAILED $key"
done
echo "DONE-MAPS"
