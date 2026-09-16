#!/usr/bin/env python3
"""Session AB — kill the residual dark-green smear fringe at the very
bottom of the logo banner (rows 502-505, x<620). Session AA cropped the
image at y506 but wave2's anti-aliased top edge still reaches up into
the last 3 rows — on screen that is the thin «خط کوچولو» sitting right
on the «کلمه بساز؛ حالِ خوب بچین» tagline pill. The right wreath
(x>=620) is untouched."""
from PIL import Image
import shutil

SRC = "public/assets/img/logo_banner.webp"
BAK = "scripts/logo_banner_raw2.webp"

shutil.copy(SRC, BAK)
im = Image.open(SRC).convert("RGBA")
w, h = im.size
px = im.load()
killed = 0
for y in range(502, h):          # 502..505
    for x in range(0, 620):      # keep the wreath (x>=620) intact
        if px[x, y][3] != 0:
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)
            killed += 1
im.save(SRC, "WEBP", lossless=True, method=6)
print(f"size {w}x{h}, killed {killed} px")

# verify
im2 = Image.open(SRC).convert("RGBA")
p2 = im2.load()
leftover = [(x, y) for y in range(502, h) for x in range(0, 620) if p2[x, y][3] > 0]
print("leftover:", leftover[:5])
