#!/bin/bash
# ---------------------------------------------------------------------------
# gen_bgs_o.sh — session O: chapter backgrounds ch11..ch20 (10 NEW HARD
# chapters). Portrait 768x1344 → processed by proc_bgs_o.js (vivid webp).
# ---------------------------------------------------------------------------
set -u
OUT=/home/z/my-project/scripts/gen_raw
mkdir -p "$OUT"

STYLE="colorful cartoon mobile game background art, vibrant saturated colors, cheerful storybook illustration style, crisp clean shapes, soft warm lighting, high quality, detailed, no text, no words, no characters, no UI, no path"

declare -A PROMPTS
PROMPTS[ch11]="mystical cloud forest canopy high above the clouds, giant ancient trees with wooden rope bridges, soft glowing mist, emerald and teal tones, rays of sunlight, glowing fireflies, $STYLE"
PROMPTS[ch12]="serene silver mountain lake at magical night, huge full moon and its reflection, glowing lotus flowers floating on water, fireflies, small wooden pier, indigo and teal palette, $STYLE"
PROMPTS[ch13]="magical crystal cave with giant glowing amethyst and turquoise crystals, calm underground pool with reflections, sparkling dust motes, violet and cyan glow, fantasy atmosphere, $STYLE"
PROMPTS[ch14]="red rock canyon hills with fairy chimneys at golden hour, warm crimson and orange striped cliffs, green valley with red poppies at the bottom, bright turquoise sky, $STYLE"
PROMPTS[ch15]="floating sky islands with lush hanging gardens, waterfalls falling into soft clouds, rainbows, colorful hot air balloons far away, pastel blue sky, dreamy fantasy, $STYLE"
PROMPTS[ch16]="tropical turquoise lagoon with coral reefs visible under crystal clear water, pearl oysters and starfish on white sand, palm trees, bright sunny day, colorful fish, $STYLE"
PROMPTS[ch17]="majestic ancient golden Persian city with grand columns, palaces and ornate carvings at golden sunset, colorful banners, warm epic light, $STYLE"
PROMPTS[ch18]="northern lights aurora over snowy mountain peaks at night, teal and purple glowing sky, brilliant stars, cozy warm lit cabin in the valley below, $STYLE"
PROMPTS[ch19]="grand ice palace with crystal towers on a frozen lake, aurora light reflections on ice, gently falling snowflakes, ice blue and silver palette, magical winter, $STYLE"
PROMPTS[ch20]="epic fantasy golden palace on a mountain summit at celebration night, colorful fireworks, glowing lanterns, garlands, purple and gold sky, grand festive finale, $STYLE"

for key in ch11 ch12 ch13 ch14 ch15 ch16 ch17 ch18 ch19 ch20; do
  if [ -s "$OUT/$key.png" ]; then
    echo "skip $key (exists)"
    continue
  fi
  echo ">>> generating $key ..."
  z-ai image -p "${PROMPTS[$key]}" -o "$OUT/$key.png" -s 768x1344 && echo "ok $key" || echo "FAILED $key"
done
echo "DONE-BGS"
