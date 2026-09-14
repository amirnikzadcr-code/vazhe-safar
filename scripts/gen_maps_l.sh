#!/bin/bash
# Session L — 10 chapter map scenes (serial + rate-limit friendly)
set -u
OUT=/home/z/my-project/assets_gen
mkdir -p "$OUT"

STYLE="glossy 3D cartoon render for a casual mobile puzzle game, Royal Match level map art style, vibrant saturated colors, soft painterly shading, warm cheerful lighting, extremely detailed, high quality"
PATHDESC="A light beige stone-paved path starts wide at the bottom center and winds upward in a smooth S-curve (curving right, then left, then right again), becoming narrower, ending at the top center. The path is completely empty, clean and clearly visible the whole way."
NOTXT="no characters, no text, no letters, no numbers, no UI buttons, no icons on the path"

declare -A P
P[map01]="The path climbs a lush green hillside garden beside a turquoise sea on the right with a small coastal town, Mediterranean village houses with terracotta roofs among green trees on the left, pink blossom trees at the top, colorful flower bushes and lampposts along the path, bright blue sky with puffy clouds."
P[map02]="The path climbs through a warm Persian bazaar town of brick domes and arched stalls, colorful fabrics and hanging red lanterns, strings of flags, crates of fruits and pottery along the path, golden afternoon light, warm orange sky."
P[map03]="The path crosses golden desert sand dunes with a caravan of camels resting far away, palm trees and desert plants along the way, a sandstone arch gate, warm sunset sky with orange and pink clouds."
P[map04]="The path climbs through a lush misty green forest with tall trees, ferns and glowing fireflies, soft sunbeams slipping between branches, small mushrooms and moss stones along the path, emerald and teal tones."
P[map05]="The path climbs a rocky mountain toward a gray stone castle with blue cone towers and red flags at the top, snowy peaks in the background, mountain flowers and pine trees along the path, crisp blue sky."
P[map06]="The path climbs through a desert city of mud-brick houses with tall windcatcher towers at warm dusk, glowing windows and hanging lanterns, clay pots and rugs along the path, peach and violet evening sky."
P[map07]="The path climbs along a turquoise tropical coast with a wooden sailing boat on the shining sea, white shells and starfish on the sand, palm trees and hibiscus flowers along the path, a lighthouse at the top, bright sunny sky."
P[map08]="The path climbs terraced green hillsides of a mountain village with stone stepped houses with warm lit windows, waterfalls between terraces, walnut trees and blossom branches along the path, fresh morning light."
P[map09]="The path crosses a calm desert at night under a deep blue starry sky with a big crescent moon and shooting stars, glowing lanterns and fireflies along the path, dark blue dunes with silver light, cozy tents in the distance."
P[map10]="The path climbs to a grand celebration garden party at the top: colorful fireworks and confetti in the sky, garlands of pennant flags, glowing lanterns, a golden trophy on a podium at the summit, flower arches and lush rose gardens along the path, magical festive evening light."

order=(map01 map02 map03 map04 map05 map06 map07 map08 map09 map10)

for name in "${order[@]}"; do
  [ -s "$OUT/$name.png" ] && { echo "skip $name"; continue; }
  echo "=== gen $name ==="
  ok=0
  for i in 1 2 3 4 5; do
    if timeout 240 z-ai image -p "Vertical mobile game level map. $PATHDESC ${P[$name]} $STYLE. $NOTXT" -o "$OUT/$name.png" -s 768x1344 && [ -s "$OUT/$name.png" ]; then
      echo "OK $name"; ok=1; break
    fi
    echo "retry $name ($i) — backoff"; sleep 30
  done
  [ $ok -eq 0 ] && echo "FAIL $name"
  sleep 12
done
echo "ALL MAPS DONE"
