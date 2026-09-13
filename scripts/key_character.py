#!/usr/bin/env python3
"""Chroma-key the wise-uncle character renders -> transparent WebP cutouts.

Strategy: background is a near-uniform green screen. We:
  1. estimate the bg color from the image border (median),
  2. flood-fill from every border pixel, removing only bg-CONNECTED pixels
     whose color is close to the bg estimate (protects the teal robe),
  3. despill green fringes, feather the alpha, autocrop, downscale,
  4. save as WebP with alpha (small + high quality).
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

RAW = "/home/z/my-project/scripts/assets-raw"
OUT = "/home/z/my-project/public/assets/char"
TARGET_H = 720  # px height after downscale (retina headroom for ~420px display)

def border_bg(px, w, h):
    """median color of the outer 6px frame"""
    samples = []
    band = 6
    for y in range(band):
        for x in range(0, w, 7):
            samples.append(px[x, y])
    for y in range(h - band, h):
        for x in range(0, w, 7):
            samples.append(px[x, y])
    for x in range(band):
        for y in range(0, h, 7):
            samples.append(px[x, y])
    for x in range(w - band, w):
        for y in range(0, h, 7):
            samples.append(px[x, y])
    rs = sorted(s[0] for s in samples)
    gs = sorted(s[1] for s in samples)
    bs = sorted(s[2] for s in samples)
    m = len(samples) // 2
    return (rs[m], gs[m], bs[m])

def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

def key_image(name, tol):
    im = Image.open(f"{RAW}/char-{name}-raw.png").convert("RGB")
    w, h = im.size
    px = im.load()
    bg = border_bg(px, w, h)
    t2 = tol * tol
    print(f"[{name}] bg={bg} tol={tol}", end=" ")

    bgmap = bytearray(w * h)
    q = deque()
    # seed: all border pixels that look like bg
    def try_seed(x, y):
        i = y * w + x
        if not bgmap[i] and dist2(px[x, y], bg) < t2:
            bgmap[i] = 1
            q.append((x, y))
    for x in range(w):
        try_seed(x, 0); try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y); try_seed(w - 1, y)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not bgmap[i] and dist2(px[nx, ny], bg) < t2:
                    bgmap[i] = 1
                    q.append((nx, ny))
    removed = sum(bgmap)
    print(f"removed={removed * 100.0 / (w * h):.1f}%", end=" ")

    # build RGBA with soft alpha: pixels near the bg threshold get partial alpha
    out = Image.new("RGBA", (w, h))
    op = out.load()
    soft_lo, soft_hi = t2 * 0.55, t2
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if bgmap[i]:
                op[x, y] = (0, 0, 0, 0)
                continue
            r, g, b = px[x, y]
            d2 = dist2((r, g, b), bg)
            if d2 < soft_hi:
                # edge zone: partial alpha ramp
                a = int(255 * (d2 - soft_lo) / (soft_hi - soft_lo))
                a = max(0, min(255, a))
            else:
                a = 255
            # despill: cap green for translucent edge pixels (green fringe)
            if a < 255 and g > r and g > b:
                cap = (r + b) // 2 + 18
                if g > cap:
                    g = cap
            op[x, y] = (r, g, b, a)
    # slight alpha blur -> smooth edges
    alpha = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.8))
    out.putalpha(alpha)

    bbox = out.getbbox()
    out = out.crop(bbox)
    th = TARGET_H
    tw = round(out.width * th / out.height)
    out = out.resize((tw, th), Image.LANCZOS)
    out.save(f"{OUT}/{name}.webp", "WEBP", quality=88, method=6)
    import os
    kb = os.path.getsize(f"{OUT}/{name}.webp") / 1024
    print(f"-> {name}.webp {out.width}x{out.height} {kb:.0f}KB")

if __name__ == "__main__":
    jobs = {
        "seat": 70,
        "thumb": 70,
        "rest": 70,
        "gift": 72,
        "chest": 58,   # darker green bg -> lower tol
    }
    if len(sys.argv) > 1:
        jobs = {k: v for k, v in jobs.items() if k in sys.argv}
    for name, tol in jobs.items():
        key_image(name, tol)
