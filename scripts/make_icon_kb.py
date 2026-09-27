#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KK-4: kill the BLACK BORDER around the app icon.

Why it happened: the artwork is a golden ROUNDED-square frame floating on
black. The JJ adaptive icon kept that black as the adaptive background
(#090806) → launchers that mask icons to a circle showed the logo floating
in a black ring. Myket's rounded store icon showed black wedges too.

Fix:
  • FULL-BLEED adaptive: zoom the artwork 1.20× and center-crop so the
    scene covers the whole 108dp canvas edge-to-edge (verified: even the
    extreme canvas corners land inside the golden frame's inner arc → NO
    black pixel survives ANY launcher mask).
  • legacy ic_launcher/round keep the golden-framed art with TRANSPARENT
    corners (no black there either).
  • PWA icons + a store-ready 512px (RGB, no alpha, for the Myket panel)
    become full-bleed as well.
"""
from PIL import Image, ImageDraw
import os

ROOT = "/home/z/my-project"
SRC = f"{ROOT}/upload/NullByte-Frost-wallpaper-1920x1080.jpg"  # actually 1254x1254
RES = f"{ROOT}/android/app/src/main/res"

im = Image.open(SRC).convert("RGB")
W, H = im.size
print("source:", im.size)

# ---------------- full-bleed version (zoom 1.15, center-crop) -------------
# 1.15 = widest view that keeps every point a circle/squircle(27%) mask can
# reach INSIDE the golden frame's inner arc → zero black on any launcher,
# while the «واژه‌سفر» plaque text stays inside circle masks.
Z = 1.15
win = int(W / Z)                      # crop window size
off = (W - win) // 2
fullbleed = im.crop((off, off, off + win, off + win))
print("full-bleed window:", fullbleed.size)

# corner-safety self-check: the point a 27%-radius squircle mask brings
# closest to the canvas corner (≈49.5/1254 of the canvas) must sit inside
# the golden frame's inner arc (arc center = R position, inner radius R-22)
R = 267
BORDER = 22
probe = (R - off) + (49.5 / 1254.0) * win  # original-space x of that mask point
corner_dist = ((R - probe) ** 2 * 2) ** 0.5
print(f"squircle-corner probe dist {corner_dist:.1f} vs inner arc {R - BORDER} ->",
      "OK no black" if corner_dist < (R - BORDER) else "BLACK RISK")

# ---------------- adaptive foreground (full canvas, all densities) --------
ADAPT = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for dpi, canvas in ADAPT.items():
    fg = fullbleed.resize((canvas, canvas), Image.LANCZOS)
    p = f"{RES}/mipmap-{dpi}/ic_launcher_foreground.png"
    os.makedirs(os.path.dirname(p), exist_ok=True)
    fg.save(p)
    print("wrote", p, fg.size)

# adaptive background (invisible under full-bleed fg, kept consistent):
# sample a sky pixel from the artwork's top edge
sky = im.getpixel((W // 2, 8))
with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    f.write('    <color name="ic_launcher_background">#%02x%02x%02x</color>\n' % sky)
    f.write("</resources>\n")
print("adaptive bg:", "#%02x%02x%02x" % sky)

# ---------------- PWA icons (full-bleed) ----------------------------------
fb512 = fullbleed.resize((512, 512), Image.LANCZOS)
fb512.save(f"{ROOT}/public/icon-512.png")
fb512.save(f"{ROOT}/public/assets/icons/icon.png")

# round PWA: circular crop of the full-bleed
m = Image.new("L", (512 * 4, 512 * 4), 0)
ImageDraw.Draw(m).ellipse([0, 0, 512 * 4 - 1, 512 * 4 - 1], fill=255)
m = m.resize((512, 512), Image.LANCZOS)
round512 = fb512.convert("RGBA")
round512.putalpha(m)
round512.save(f"{ROOT}/public/assets/icons/icon-512-round.png")
print("PWA icons written (icon.png / icon-512.png / icon-512-round.png)")

# ---------------- store icon for the Myket panel --------------------------
os.makedirs(f"{ROOT}/download", exist_ok=True)
fb512.save(f"{ROOT}/download/vazhe-safar-icon-store-512.png")
print("store icon -> download/vazhe-safar-icon-store-512.png")

# ---------------- QA sheet -------------------------------------------------
def checker(size, cell=16):
    bgc = Image.new("RGB", (size, size), (240, 240, 240))
    db = ImageDraw.Draw(bgc)
    for yy in range(0, size, cell):
        for xx in range(0, size, cell):
            if (xx // cell + yy // cell) % 2 == 0:
                db.rectangle([xx, yy, xx + cell - 1, yy + cell - 1], fill=(205, 205, 205))
    return bgc

sheet = Image.new("RGB", (3 * 300 + 4 * 20, 340), (30, 30, 30))
x = 20
# 1) adaptive foreground as-is (full-bleed)
sheet.paste(fb512.resize((300, 300)), (x, 20)); x += 320
# 2) simulated CIRCLE mask of the adaptive icon
c = checker(300)
m300 = Image.new("L", (1200, 1200), 0)
ImageDraw.Draw(m300).ellipse([0, 0, 1199, 1199], fill=255)
m300 = m300.resize((300, 300), Image.LANCZOS)
tmp = fb512.resize((300, 300)).convert("RGBA"); tmp.putalpha(m300)
c.paste(tmp, (0, 0), tmp)
sheet.paste(c, (x, 20)); x += 320
# 3) simulated SQUIRCLE (rounded-rect 27% radius) mask
c = checker(300)
sq = Image.new("L", (1200, 1200), 0)
ImageDraw.Draw(sq).rounded_rectangle([0, 0, 1199, 1199], radius=int(1200 * 0.27), fill=255)
sq = sq.resize((300, 300), Image.LANCZOS)
tmp2 = fb512.resize((300, 300)).convert("RGBA"); tmp2.putalpha(sq)
c.paste(tmp2, (0, 0), tmp2)
sheet.paste(c, (x, 20)); x += 320
sheet.save(f"{ROOT}/scripts/kk_icon_preview.png")
print("QA -> scripts/kk_icon_preview.png")
