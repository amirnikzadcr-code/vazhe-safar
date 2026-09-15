#!/usr/bin/env python3
"""Icon-only re-crop: strip the pinkish-white margin so the artwork is
edge-to-edge, then regenerate the full launcher/PWA icon set."""
from PIL import Image, ImageDraw
import numpy as np
import os

ROOT = "/home/z/my-project"
ICON_RAW = f"{ROOT}/scripts/icon_raw.png"

icon = Image.open(ICON_RAW).convert("RGB")
a = np.array(icon).astype(np.int16)
mx = a.max(axis=2); mn = a.min(axis=2)
sat = mx - mn
# margin = bright AND near-neutral (pinkish-white glow around the card)
margin = (mn > 205) & (sat < 34)
keep = ~margin
ys, xs = np.where(keep)
l, r = int(xs.min()), int(xs.max()) + 1
t, b = int(ys.min()), int(ys.max()) + 1
side = min(r - l, b - t)
cx, cy = (l + r) // 2, (t + b) // 2
half = side // 2
l2, t2 = max(0, cx - half), max(0, cy - half)
icon = icon.crop((l2, t2, min(icon.width, l2 + side), min(icon.height, t2 + side)))
icon = icon.resize((1024, 1024), Image.LANCZOS)

edge = np.array(icon)[8:24, 8:24].reshape(-1, 3).mean(axis=0).astype(int)
bg_hex = "#{:02x}{:02x}{:02x}".format(*edge)
print("adaptive bg color:", bg_hex)

def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out

def circle(im):
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, im.width - 1, im.height - 1], fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out

icon.resize((512, 512), Image.LANCZOS).save(f"{ROOT}/public/icon-512.png", optimize=True)
icon.resize((512, 512), Image.LANCZOS).save(f"{ROOT}/public/assets/icons/icon.png", optimize=True)
icon.save(f"{ROOT}/assets/icon-only.png", optimize=True)

DENS = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
RES = f"{ROOT}/android/app/src/main/res"
for d, s in DENS.items():
    icon.resize((s, s), Image.LANCZOS).save(f"{RES}/mipmap-{d}/ic_launcher.png", optimize=True)
    circle(icon.resize((s, s), Image.LANCZOS)).save(f"{RES}/mipmap-{d}/ic_launcher_round.png", optimize=True)
icon.resize((36, 36), Image.LANCZOS).save(f"{RES}/mipmap-ldpi/ic_launcher.png", optimize=True)
circle(icon.resize((36, 36), Image.LANCZOS)).save(f"{RES}/mipmap-ldpi/ic_launcher_round.png", optimize=True)

FG = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for d, s in FG.items():
    fg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    art = rounded(icon.resize((s, s), Image.LANCZOS), int(s * 0.22))
    inner = int(s * 0.66)
    art = art.resize((inner, inner), Image.LANCZOS)
    fg.paste(art, ((s - inner) // 2, (s - inner) // 2), art)
    fg.save(f"{RES}/mipmap-{d}/ic_launcher_foreground.png", optimize=True)

with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    f.write(f'    <color name="ic_launcher_background">{bg_hex}</color>\n</resources>\n')

print("icon set re-cropped:", icon.size)
