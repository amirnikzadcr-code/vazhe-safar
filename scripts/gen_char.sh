#!/bin/bash
# Regenerate عمو دانا character poses — full body inside frame, white bg for clean matting
set -e
OUT=/home/z/my-project/scripts/char_raw
mkdir -p "$OUT"

# seat: waving hand FULLY visible with margin above (fixes cropped-hand bug)
z-ai image -p "Pixar style 3D cartoon render, cheerful elderly Persian grandpa, white beard, gray flat cap, cream shirt, brown embroidered vest, sitting behind round wooden tea table with steaming glass tea cup, cute orange and white fluffy cat sitting on the table beside him, RIGHT hand raised high in friendly open-palm wave, entire raised hand fully visible with generous empty margin above fingers, wide landscape composition, character fully inside frame, nothing cropped at any edge, isolated on pure solid white background, soft warm studio lighting, ultra high quality, detailed, adorable game character" -o "$OUT/seat.png" -s 1152x864
echo "seat done"

# thumb: clean thumbs-up, margin above fist
z-ai image -p "Pixar style 3D cartoon render, cheerful elderly Persian grandpa bust portrait, white beard, gray flat cap, cream shirt, brown embroidered vest, big happy proud smile, RIGHT hand giving big thumbs up, entire fist fully visible with generous margin above, square composition, character fully inside frame with margin on all sides, nothing cropped, isolated on pure solid white background, soft warm studio lighting, ultra high quality, detailed, adorable game character" -o "$OUT/thumb.png" -s 1024x1024
echo "thumb done"

# rest: relaxed cheek-on-hand pose
z-ai image -p "Pixar style 3D cartoon render, relaxed elderly Persian grandpa bust portrait, white beard, gray flat cap, cream knitted sweater, eyes closed peaceful happy smile, resting his cheek against his palm, elbow on wooden table, square composition, character fully inside frame with margin on all sides, nothing cropped at any edge, isolated on pure solid white background, soft warm studio lighting, ultra high quality, detailed, adorable game character" -o "$OUT/rest.png" -s 1024x1024
echo "rest done"
