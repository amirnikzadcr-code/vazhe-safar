#!/usr/bin/env bash
# FF — chapter 6 retheme, FORGET CYRUS (user: «زمینه فصل 6 رو عوض کن و
# یچی دیگ بزار بیخیال کوروش شو»): new art = the windcatcher city (Yazd)
# — historical Persian architecture, zero religious motifs, zero royal
# figures. Raw 768x1344 → processed by proc_bgs_ff.js.
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

gen ch06 "Cheerful storybook view of the ancient desert city of Yazd Iran at bright golden morning, many tall adobe windcatcher towers badgirs with vertical decorative slats rising from warm clay rooftops, small arched rooftop skylights, a winding alley of mud-brick walls in the foreground with clay pots of green plants, distant golden desert mountains, vivid turquoise sky with soft white clouds, warm sunlight, joyful vibrant flat vector illustration, mobile game background art, saturated warm ochre and turquoise colors, strictly no mosque, no dome, no minaret, no religious symbols, no flags, no text, no people, high quality" &
gen m06 "Wide storybook view of a golden desert realm filled with adobe windcatcher towers, sprawling warm clay rooftops with many tall badgir wind towers of different heights, palm groves and turquoise pools at the city edge, a winding caravan trail, golden dunes and soft mountains behind, bright turquoise sky with puffy clouds, cheerful vibrant flat vector illustration, mobile game map background, saturated warm colors, strictly no mosque, no dome, no minaret, no religious symbols, no text, no people, high quality" &
wait
echo DONE
