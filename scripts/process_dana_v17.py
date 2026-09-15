#!/usr/bin/env python3
"""v1.17 — عمو دانا consistency pass + new game icon.

1) dana_seat.png / dana_rest.png (white bg) → transparent seat.webp / rest.webp
   reusing the proven flood-fill white-removal pipeline.
2) icon_raw.png → crop to the rounded-square artwork, then emit:
   • public/icon-512.png            (store + PWA)
   • public/assets/icons/icon.png   (webmanifest)
   • assets/icon-only.png           (capacitor assets source)
   • android mipmaps ic_launcher / round / foreground (all densities)
"""
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
from collections import deque
import os

RAW = "/home/z/my-project/scripts/char_raw"
OUT = "/home/z/my-project/public/assets/char"
ROOT = "/home/z/my-project"
ICON_RAW = os.path.join(RAW, "..", "icon_raw.png")

# ---------------------------------------------------------------- matting
def remove_white_edges(im: Image.Image, tol: int = 30, seed_bottom: bool = False) -> Image.Image:
    im = im.convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    bg = np.median(a[:6, :, :3].reshape(-1, 3), axis=0)
    dist = np.sqrt(((a[:, :, :3].astype(np.int16) - bg) ** 2).sum(axis=2))
    near_bg = dist < tol
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    def seed(y, x):
        if 0 <= y < h and 0 <= x < w and near_bg[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))
    for x in range(w):
        seed(0, x)
        if seed_bottom:
            seed(h - 1, x)
    side_lim = int(h * 0.45)
    for y in range(h):
        if y < side_lim:
            seed(y, 0); seed(y, w - 1)
        if seed_bottom:
            seed(y, 0); seed(y, w - 1)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and near_bg[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    a[:, :, 3] = np.where(visited, 0, 255).astype(np.uint8)
    return Image.fromarray(a)

def largest_component(im: Image.Image, min_island: int = 600) -> Image.Image:
    a = np.array(im)
    alpha = a[:, :, 3] > 0
    h, w = alpha.shape
    labels = np.zeros((h, w), dtype=np.int32)
    cur = 0
    sizes = {}
    for y in range(h):
        for x in range(w):
            if alpha[y, x] and labels[y, x] == 0:
                cur += 1
                q = deque([(y, x)])
                labels[y, x] = cur
                n = 0
                while q:
                    cy, cx = q.popleft()
                    n += 1
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = cur
                            q.append((ny, nx))
                sizes[cur] = n
    if not sizes:
        return im
    big = max(sizes, key=sizes.get)
    kill = np.isin(labels, [k for k, v in sizes.items() if v < min_island or k != big])
    a[:, :, 3] = np.where(kill, 0, a[:, :, 3]).astype(np.uint8)
    return Image.fromarray(a)

def erode_alpha(im: Image.Image, px: int = 2) -> Image.Image:
    al = im.getchannel("A").filter(ImageFilter.MinFilter(px * 2 + 1))
    al = al.filter(ImageFilter.GaussianBlur(0.6))
    out = im.copy()
    out.putalpha(al)
    return out

def crop_bbox(im: Image.Image, margin_frac: float = 0.02) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    mw = int((r - l) * margin_frac); mh = int((b - t) * margin_frac)
    l = max(0, l - mw); t = max(0, t - mh)
    r = min(im.width, r + mw); b = min(im.height, b + mh)
    return im.crop((l, t, r, b))

def save_char(src, dst, target_w, tol):
    im = Image.open(os.path.join(RAW, src))
    im = remove_white_edges(im, tol=tol)
    im = largest_component(im)
    im = erode_alpha(im)
    im = crop_bbox(im)
    if im.width > target_w:
        nh = round(im.height * target_w / im.width)
        im = im.resize((target_w, nh), Image.LANCZOS)
    p = os.path.join(OUT, dst)
    im.save(p, "WEBP", quality=88, method=6)
    print(f"{src} -> {dst}: {im.size}, {os.path.getsize(p)//1024} KB")

save_char("dana_seat.png", "seat.webp", 820, 30)
save_char("dana_rest.png", "rest.webp", 780, 24)

# ---------------------------------------------------------------- icon
icon = Image.open(ICON_RAW).convert("RGB")

# crop away the white margin around the rounded-square artwork:
# find the largest non-white bbox (the artwork edges)
a = np.array(icon)
nonwhite = (a.astype(np.int16).sum(axis=2) < 720)  # not near-white
ys, xs = np.where(nonwhite)
l, r = xs.min(), xs.max() + 1
t, b = ys.min(), ys.max() + 1
# make it square, centered on the artwork
side = min(r - l, b - t)
cx, cy = (l + r) // 2, (t + b) // 2
half = side // 2
l2, t2 = max(0, cx - half), max(0, cy - half)
icon = icon.crop((l2, t2, min(icon.width, l2 + side), min(icon.height, t2 + side)))
icon = icon.resize((1024, 1024), Image.LANCZOS)

# corner/edge color for the adaptive-icon background layer
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

# store / PWA / capacitor sources
icon.resize((512, 512), Image.LANCZOS).save(f"{ROOT}/public/icon-512.png", optimize=True)
icon.resize((512, 512), Image.LANCZOS).save(f"{ROOT}/public/assets/icons/icon.png", optimize=True)
icon.save(f"{ROOT}/assets/icon-only.png", optimize=True)
icon.resize((512, 512), Image.LANCZOS).save(f"{ROOT}/public/assets/icons/icon-512-round.png", optimize=True)

# android legacy launcher bitmaps (full-bleed square + round)
DENS = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
RES = f"{ROOT}/android/app/src/main/res"
for d, s in DENS.items():
    icon.resize((s, s), Image.LANCZOS).save(f"{RES}/mipmap-{d}/ic_launcher.png", optimize=True)
    circle(icon.resize((s, s), Image.LANCZOS)).save(f"{RES}/mipmap-{d}/ic_launcher_round.png", optimize=True)
icon.resize((36, 36), Image.LANCZOS).save(f"{RES}/mipmap-ldpi/ic_launcher.png", optimize=True)
circle(icon.resize((36, 36), Image.LANCZOS)).save(f"{RES}/mipmap-ldpi/ic_launcher_round.png", optimize=True)

# adaptive foreground: art inside the 66% safe zone, transparent elsewhere
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

print("icon set done:", icon.size)
