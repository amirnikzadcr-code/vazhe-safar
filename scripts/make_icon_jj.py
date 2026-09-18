#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JJ-1: Build the full app icon set for واژه‌سفر from the user-supplied artwork
(upload/NullByte-Frost-wallpaper-1920x1080.jpg — actually a 1254x1254 icon art).

Outputs:
  Android legacy : mipmap-{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png (+_round)
  Android adapt. : mipmap-{mdpi..xxxhdpi}/ic_launcher_foreground.png  (scaled, safe-zone fit)
                   values/ic_launcher_background.xml → near-black matching artwork corners
  PWA            : public/icon-512.png, public/assets/icons/icon.png, icon-512-round.png
  QA contact sheet: scripts/jj_icon_preview.png
"""
from PIL import Image, ImageDraw, ImageOps
import os

SRC = "/home/z/my-project/upload/NullByte-Frost-wallpaper-1920x1080.jpg"
ROOT = "/home/z/my-project"
RES = f"{ROOT}/android/app/src/main/res"

im = Image.open(SRC).convert("RGB")
W, H = im.size
print("source:", im.size)

# ------------------------------------------------------------------
# 1) Detect the golden rounded-frame rect + corner radius
#    Golden border is bright; outside corners are near-black.
# ------------------------------------------------------------------
px = im.load()

def bright(x, y):
    r, g, b = px[x, y]
    return (r + g + b) / 3

TH = 60  # brightness threshold separating black backdrop from artwork
cx = W // 2
cy = H // 2

left = next(x for x in range(W) if bright(x, cy) > TH)
right = next(x for x in range(W - 1, -1, -1) if bright(x, cy) > TH)
top = next(y for y in range(H) if bright(cx, y) > TH)
bot = next(y for y in range(H - 1, -1, -1) if bright(cx, y) > TH)
print("frame rect:", left, top, right, bot, "->", right - left + 1, "x", bot - top + 1)

# corner radius: walk the top edge — flat top starts after the curve.
# find, for each column, first bright row from the top; the curve zone = where it sinks.
flat_top = top
curve_end = 0
for x in range(left, right + 1):
    y0 = None
    for y in range(top - 6, top + int(0.25 * H)):
        if 0 <= y < H and bright(x, y) > TH:
            y0 = y
            break
    if y0 is None:
        continue
    if y0 <= flat_top + 3:
        curve_end = x
        break
radius = curve_end - left
print("detected corner radius:", radius)

# clamp to sane proportions
margin = min(left, top, W - 1 - right, H - 1 - bot)
radius = max(int(0.10 * W), min(radius, int(0.22 * W)))
print("margin:", margin, "radius used:", radius)

# ------------------------------------------------------------------
# 2) Rounded-rect alpha mask (supersampled 4x) on the frame rect
# ------------------------------------------------------------------
SS = 4
fw, fh = right - left + 1, bot - top + 1
crop = im.crop((left, top, right + 1, bot + 1)).convert("RGBA")

mask = Image.new("L", (fw * SS, fh * SS), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([0, 0, fw * SS - 1, fh * SS - 1], radius=radius * SS, fill=255)
mask = mask.resize((fw, fh), Image.LANCZOS)
crop.putalpha(mask)

# sample corner backdrop color (for adaptive background)
corner = im.getpixel((6, 6))
bg_hex = "#%02x%02x%02x" % corner
print("corner color:", corner, "->", bg_hex)

# ------------------------------------------------------------------
# 3) Round (circular) version — circle inscribed in the frame
# ------------------------------------------------------------------
side = min(fw, fh)
ccx, ccy = fw // 2, fh // 2
r = side // 2
circ = Image.new("L", (fw * SS, fh * SS), 0)
dc = ImageDraw.Draw(circ)
dc.ellipse([ccx * SS - r * SS, ccy * SS - r * SS, ccx * SS + r * SS, ccy * SS + r * SS], fill=255)
circ = circ.resize((fw, fh), Image.LANCZOS)
round_img = crop.copy()
round_img.putalpha(circ)

def save(img, path, size=None):
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("wrote", path, Image.open(path).size)

# ------------------------------------------------------------------
# 4) Android legacy mipmaps
# ------------------------------------------------------------------
DENS = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for dpi, s in DENS.items():
    save(crop, f"{RES}/mipmap-{dpi}/ic_launcher.png", s)
    save(round_img, f"{RES}/mipmap-{dpi}/ic_launcher_round.png", s)

# ------------------------------------------------------------------
# 5) Adaptive foreground: whole logo scaled into the 66% safe zone,
#    centered on transparency; background color file matches artwork.
#    Canvas = 108dp: mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432.
#    Logo width = 52% of canvas → fits fully inside the circular mask.
# ------------------------------------------------------------------
ADAPT = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for dpi, canvas in ADAPT.items():
    fg = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    logo = crop.resize((int(canvas * 0.52), int(canvas * 0.52)), Image.LANCZOS)
    off = (canvas - logo.width) // 2
    fg.paste(logo, (off, off), logo)
    save(fg, f"{RES}/mipmap-{dpi}/ic_launcher_foreground.png")

with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    f.write(f'    <color name="ic_launcher_background">{bg_hex}</color>\n')
    f.write("</resources>\n")
print("wrote adaptive background color", bg_hex)

# ------------------------------------------------------------------
# 6) PWA / web icons
# ------------------------------------------------------------------
save(crop, f"{ROOT}/public/icon-512.png", 512)
save(crop, f"{ROOT}/public/assets/icons/icon.png", 512)
save(round_img, f"{ROOT}/public/assets/icons/icon-512-round.png", 512)

# ------------------------------------------------------------------
# 7) QA contact sheet on checkered bg (to see transparency)
# ------------------------------------------------------------------
def checker(size, cell=16):
    bgc = Image.new("RGB", (size, size), (240, 240, 240))
    db = ImageDraw.Draw(bgc)
    for yy in range(0, size, cell):
        for xx in range(0, size, cell):
            if (xx // cell + yy // cell) % 2 == 0:
                db.rectangle([xx, yy, xx + cell - 1, yy + cell - 1], fill=(205, 205, 205))
    return bgc

cells = []
for label, img, sz in [
    ("legacy", crop, 300),
    ("round", round_img, 300),
    ("adaptive fg", fg, 300),
]:
    c = checker(sz)
    c.paste(img.resize((sz, sz), Image.LANCZOS), (0, 0), img.resize((sz, sz), Image.LANCZOS))
    cells.append(c)

sheet = Image.new("RGB", (300 * len(cells) + 20 * (len(cells) + 1), 340), (30, 30, 30))
xoff = 20
for c in cells:
    sheet.paste(c, (xoff, 20))
    xoff += 320

# simulated circular-mask adaptive result
sim = checker(300)
big = fg.resize((300, 300), Image.LANCZOS)
m = Image.new("L", (600, 600), 0)
dm = ImageDraw.Draw(m)
dm.ellipse([0, 0, 599, 599], fill=255)
m = m.resize((300, 300), Image.LANCZOS)
sim.paste(big, (0, 0), Image.composite(Image.new("RGBA", big.size, (255,255,255,255)), Image.new("RGBA", big.size, (0,0,0,0)), m).split()[3])
sheet.paste(sim, (xoff, 20))
sheet.save(f"{ROOT}/scripts/jj_icon_preview.png")
print("QA sheet -> scripts/jj_icon_preview.png")
