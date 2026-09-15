#!/bin/bash
# v1.18 — عمو دانا FROM SCRATCH (user: «عمو دانا رو از صفر پیاده سازی کن
# شکلش قشنگ نیست یک پیر مرد گرافیگی خوشگل»)
# One MASTER design → 5 pose edits from the same identity → matting pipeline.
set -e
RAW=/home/z/my-project/scripts/char_raw_v18
mkdir -p "$RAW"
cd /home/z/my-project

STYLE="cute premium 2D storybook cartoon mascot, thick clean dark-brown outlines, soft rounded shapes, flat warm shading with gentle gradients, warm palette of cream gold and wood brown, children mobile game character design, adorable, high quality, isolated on plain pure white background, no shadow, no text"

MASTER="full body character of a kind cheerful elderly Persian grandfather standing straight facing front, one hand raised waving hello, big warm smile. Huge round golden eyeglasses, fluffy white eyebrows, very big bushy white mustache covering the top lip, rosy cheeks, round bald head with puffy white hair on the sides, warm light-tan skin. Cozy mustard-yellow knitted vest with subtle Persian paisley motifs over a cream long-sleeve shirt, dark brown trousers, soft brown shoes. $STYLE"

echo "== master (rest/wave) =="
z-ai image -p "$MASTER" -o "$RAW/dana_rest.png" -s 864x1152

edit_pose () { # $1 name  $2 pose description
  echo "== $1 =="
  z-ai image-edit -p "Keep the EXACT same character: same face, same huge round golden glasses, same big bushy white mustache, same white side hair, same mustard-yellow paisley vest over cream shirt, same colors and cartoon style, same white background. Only change the pose: $2" \
    -i "$RAW/dana_rest.png" -o "$RAW/dana_$1.png" -s 864x1152
}

edit_pose seat  "he is sitting on a small wooden stool, leaning slightly forward, happily holding a steaming golden cup of Persian tea with both hands, legs visible, cozy and relaxed, big smile"
edit_pose point "he is teaching: one arm raised with index finger pointing up, the other hand holding a small wooden pointer stick, eyebrows raised, mouth open in a friendly explaining smile"
edit_pose thumb "he gives a big confident thumbs-up with one hand close to his chest, the other hand resting on his belly, proud happy closed-mouth smile"
edit_pose cheer "he celebrates: both arms raised high in the air, head tilted up a little, huge joyful open-mouth smile, eyes shining behind the golden glasses"
edit_pose hello "he waves hello energetically with his right hand raised high, left hand on his hip, head slightly tilted, big welcoming smile"

echo done; ls -la "$RAW"
