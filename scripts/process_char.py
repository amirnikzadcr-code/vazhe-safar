#!/usr/bin/env python3
"""Convert white-bg character PNGs to clean transparent WebP assets.
Edge flood-fill white removal (interior whites kept) + 1px alpha erosion
to kill fringe + bbox crop with margin + resize + WebP."""
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
import os

RAW = "/home/z/my-project/scripts/char_raw"
OUT = "/home/z/my-project/public/assets/char"
os.makedirs(OUT, exist_ok=True)

def remove_white_edges(im: Image.Image, tol: int = 30, seed_bottom: bool = False) -> Image.Image:
    """Flood-fill transparent from TOP bg region (bg color sampled from top strip).
    Figure + table normally occupy the bottom — table reaching the bottom edge is KEPT.
    Seeds: top edge + upper 45% of left/right edges (+ bottom edge if seed_bottom)."""
    im = im.convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    bg = np.median(a[:6, :, :3].reshape(-1, 3), axis=0)  # top strip = sky/bg
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

def grow_shadow_cut(im: Image.Image, lum_thresh: int = 208, passes: int = 40) -> Image.Image:
    """Expand transparency into the soft gray shadow halo around the figure.
    BFS from transparent pixels into low-saturation bright (shadow) pixels."""
    a = np.array(im)
    alpha = a[:, :, 3]
    rgb = a[:, :, :3].astype(np.int16)
    mx = rgb.max(axis=2); mn = rgb.min(axis=2)
    grayish = (mx - mn) < 42  # low saturation
    bright = mn > lum_thresh
    can_eat = grayish & bright
    trans = alpha == 0
    for _ in range(passes):
        # dilate transparency by 1, then intersect with can_eat
        pad = np.pad(trans, 1, constant_values=False)
        dil = pad[:-2,1:-1] | pad[2:,1:-1] | pad[1:-1,:-2] | pad[1:-1,2:]
        new = dil & can_eat & ~trans
        if not new.any():
            break
        trans |= new
    a[:, :, 3] = np.where(trans, 0, 255).astype(np.uint8)
    return Image.fromarray(a)

def largest_component_and_despeckle(im: Image.Image, min_island: int = 400) -> Image.Image:
    """Keep only the largest opaque connected component; drop floating specks."""
    a = np.array(im)
    alpha = a[:, :, 3] > 0
    h, w = alpha.shape
    labels = np.zeros((h, w), dtype=np.int32)
    cur = 0
    sizes = {}
    from collections import deque as _dq
    for y in range(h):
        for x in range(w):
            if alpha[y, x] and labels[y, x] == 0:
                cur += 1
                q = _dq([(y, x)])
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

def erode_alpha(im: Image.Image, px: int = 1) -> Image.Image:
    """Shrink alpha by px to remove halo fringe."""
    al = im.getchannel("A").filter(ImageFilter.MinFilter(px * 2 + 1))
    # soften edge back a touch
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

jobs = [
    # (src, dst, target_width, flood_tol, shadow_lum, seed_bottom)
    ("seat.png",  "seat.webp",  820, 36, 0,   False),  # lum 0 → grow disabled (keeps tea glass)
    ("thumb.png", "thumb.webp", 740, 26, 208, True),
    ("rest.png",  "rest.webp",  780, 22, 210, False),
]
for src, dst, target, tol, slum, sbot in jobs:
    p = os.path.join(RAW, src)
    im = Image.open(p)
    im = remove_white_edges(im, tol=tol, seed_bottom=sbot)
    if slum:
        im = grow_shadow_cut(im, lum_thresh=slum, passes=60)
    im = largest_component_and_despeckle(im, min_island=600)
    im = erode_alpha(im, 2)
    im = crop_bbox(im)
    if im.width > target:
        nh = round(im.height * target / im.width)
        im = im.resize((target, nh), Image.LANCZOS)
    outp = os.path.join(OUT, dst)
    im.save(outp, "WEBP", quality=88, method=6)
    print(f"{src} -> {dst}: {im.size}, {os.path.getsize(outp)//1024} KB")
print("done")
