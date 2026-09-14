#!/bin/bash
# Session L — generate ALL art assets to match the user's reference designs
# Style anchor: glossy 3D cartoon (Royal Match / Gardenscapes vibe)
set -u
OUT=/home/z/my-project/assets_gen
mkdir -p "$OUT"

STYLE="glossy 3D cartoon render for a casual mobile puzzle game, Royal Match art style, vibrant saturated colors, soft painterly shading, warm cheerful lighting, extremely detailed, high quality"
NOTXT="no text, no letters, no words, no numbers, no logos, no UI elements, no buttons"

gen() { # name prompt size
  local name="$1"; local prompt="$2"; local size="$3"
  if [ -s "$OUT/$name.png" ]; then echo "skip $name"; return 0; fi
  echo "=== gen $name ==="
  for i in 1 2 3; do
    z-ai image -p "$prompt" -o "$OUT/$name.png" -s "$size" && [ -s "$OUT/$name.png" ] && { echo "OK $name"; return 0; }
    echo "retry $name ($i)"; sleep 4
  done
  echo "FAIL $name"; return 1
}

# ---------------- batch 1: hero scenes ----------------
gen home_bg "Vertical mobile game home screen illustration. A cheerful 3D cartoon old Iranian man with a white beard, round nose, gray flat cap and brown vest sits at a wooden table on a flower-filled porch in the bottom half, sipping Persian tea from a blue porcelain cup, a cute orange tabby kitten sits on the table beside him. Behind them a beautiful village by a turquoise lake with mountains and bright blue sky, wooden pergola with lush green vines and pink flowers framing the top, colorful flowers and potted plants in the foreground corners, puffy white clouds. $STYLE. $NOTXT" 768x1344 &

gen game_bg "Vertical mobile game background. Dreamy soft-focus Persian village by a turquoise lake with mountains and blue sky in the upper half, slightly blurred. The bottom third is a warm wooden table surface with an empty polished area in the center. A cute orange tabby kitten with big eyes peeks over the table from the right side near the lower right, looking toward the center. On the left edge a small stack of old books, a blue porcelain teacup and pink flowers sit on the table. Colorful flowers along the bottom corners. $STYLE. $NOTXT" 768x1344 &

gen logo_banner "A horizontal wooden sign board shaped like a rounded light-brown wood log slab with carved darker wood border and soft glossy finish, decorated with lush green leaves and small red and white flowers growing on the top left and top right corners, a cute brown tweed flat cap with a red band resting on the top right edge of the board. The center of the board is completely EMPTY plain light wood. The board floats on a solid flat pure chroma green #00FF00 background that fills everything around it. $STYLE. $NOTXT" 1344x768 &
wait

# ---------------- batch 2: icon sheet A (3x2) ----------------
gen icons_a "Sprite sheet exactly 3 columns by 2 rows on a solid flat pure chroma green #00FF00 background, six 3D cartoon game icons evenly spaced, each fully inside its cell with wide green margins, icons never touch each other. Row 1: a cozy shop stall with a red and white striped awning and wooden counter; a magical blue book with a golden star on the cover; a wooden treasure chest overflowing with shiny gold coins. Row 2: a cute red cottage house with an orange roof and round window; a tidy stack of four colorful books; a wooden clipboard with a checklist and a pencil. Thick dark outlines, bold readable shapes, glossy highlights. $STYLE. $NOTXT" 1024x1024 &

# icon sheet B (3x2)
gen icons_b "Sprite sheet exactly 3 columns by 2 rows on a solid flat pure chroma green #00FF00 background, six 3D cartoon game icons evenly spaced, each fully inside its cell with wide green margins, icons never touch each other. Row 1: a red gift box with a golden ribbon bow; a glowing yellow light bulb with a warm shine; two crossing rounded white swap arrows with golden tips. Row 2: a big shiny golden five pointed star with sparkles; a bronze metal gear cog; the friendly face of a smiling 3D cartoon old man with a fluffy white beard, round nose and a gray flat cap, head and shoulders portrait. Thick dark outlines, bold readable shapes, glossy highlights. $STYLE. $NOTXT" 1024x1024 &
wait
echo "batch1+2 done"; ls -la "$OUT"
