#!/usr/bin/env python3
"""Convert generated chapter-2 nature art → optimized map webp (700x1225)."""
from PIL import Image, ImageEnhance

SRC = "/home/z/my-project/scripts/m02_raw.png"
DST = "/home/z/my-project/public/assets/map/m02.webp"

img = Image.open(SRC).convert("RGB")
# target aspect 700:1225 (0.5714)
tw, th = 700, 1225
ar_t = tw / th
w, h = img.size
ar = w / h
if ar > ar_t:  # too wide → crop sides
    nw = int(h * ar_t)
    x = (w - nw) // 2
    img = img.crop((x, 0, x + nw, h))
else:          # too tall → crop top/bottom (keep center-weighted upper)
    nh = int(w / ar_t)
    y = max(0, int((h - nh) * 0.42))
    img = img.crop((0, y, w, y + nh))
img = img.resize((tw, th), Image.LANCZOS)
# gentle vibrance lift so it pops on phone screens
img = ImageEnhance.Color(img).enhance(1.12)
img = ImageEnhance.Contrast(img).enhance(1.04)
img.save(DST, "WEBP", quality=82, method=6)
print("saved", DST, img.size)
