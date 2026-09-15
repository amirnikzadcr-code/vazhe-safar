#!/usr/bin/env python3
"""v1.18 — عمو دانا from-scratch set → transparent webp + avatar chip.
Inputs: scripts/char_raw_v18/dana_{rest,seat,point,thumb,cheer,hello}.png
Outputs (same filenames → every usage in the game updates automatically):
  public/assets/char/{rest,seat,point,thumb,cheer,hello}.webp
  public/assets/img/grandpa.webp   (head+shoulders chip for map/party)
"""
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
import os

RAW = "/home/z/my-project/scripts/char_raw_v18"
OUT = "/home/z/my-project/public/assets/char"
IMG = "/home/z/my-project/public/assets/img"


def remove_white_edges(im: Image.Image, tol: int = 40) -> Image.Image:
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
        seed(h - 1, x)
    side_lim = int(h * 0.5)
    for y in range(h):
        if y < side_lim:
            seed(y, 0)
            seed(y, w - 1)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and near_bg[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    a[:, :, 3] = np.where(visited, 0, 255).astype(np.uint8)
    return Image.fromarray(a)


def largest_component(im: Image.Image, min_island: int = 900) -> Image.Image:
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
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
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


def soften_ground_shadow(im: Image.Image) -> Image.Image:
    """light-gray, low-saturation pixels under the character → fade them out
    (AI pose edits often bake a soft ground shadow that must not ship)"""
    a = np.array(im).astype(np.int16)
    rgb = a[:, :, :3]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = mx - mn
    light_gray = (mx > 195) & (sat < 18) & (a[:, :, 3] > 0)
    ys = np.where(light_gray.any(axis=1))[0]
    if len(ys):
        # only fade in the lower 45% of the sprite where a ground shadow lives
        y0 = int(im.height * 0.55)
        mask = light_gray.copy()
        mask[:y0, :] = False
        a[:, :, 3] = np.where(mask, 0, a[:, :, 3])
    return Image.fromarray(a.astype(np.uint8))


def erode_alpha(im: Image.Image, px: int = 2) -> Image.Image:
    al = im.getchannel("A").filter(ImageFilter.MinFilter(px * 2 + 1))
    al = al.filter(ImageFilter.GaussianBlur(0.6))
    out = im.copy()
    out.putalpha(al)
    return out


def crop_bbox(im: Image.Image, margin_frac: float = 0.015) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    mw = int((r - l) * margin_frac)
    mh = int((b - t) * margin_frac)
    l = max(0, l - mw)
    t = max(0, t - mh)
    r = min(im.width, r + mw)
    b = min(im.height, b + mh)
    return im.crop((l, t, r, b))


def save_char(name: str, target_w: int, tol: int = 40):
    im = Image.open(os.path.join(RAW, f"dana_{name}.png"))
    im = remove_white_edges(im, tol=tol)
    im = largest_component(im)
    im = soften_ground_shadow(im)
    im = erode_alpha(im)
    im = crop_bbox(im)
    if im.width > target_w:
        nh = round(im.height * target_w / im.width)
        im = im.resize((target_w, nh), Image.LANCZOS)
    p = os.path.join(OUT, f"{name}.webp")
    im.save(p, "WEBP", quality=88, method=6)
    print(f"dana_{name}.png -> {name}.webp {im.size} {os.path.getsize(p)//1024}KB")
    return im


# ---------------- six poses ----------------
rest = save_char("rest", 780)
save_char("seat", 820)
save_char("point", 720)
save_char("thumb", 720)
save_char("cheer", 720)
save_char("hello", 720)

# ---------------- grandpa avatar chip (head + shoulders, from master) ----
m = rest.copy()
w, h = m.size
# face occupies the upper-center; crop a square around head+shoulders
side = int(w * 0.86)
cx = w // 2
top = int(h * 0.02)
sq = m.crop((max(0, cx - side // 2), top, min(w, cx + side // 2), min(h, top + int(side * 1.02))))
# trim to the visible bbox then re-crop slightly tighter on the head
bb = sq.getbbox()
if bb:
    sq = sq.crop(bb)
# target: head+mustache fills the frame — keep upper ~78% of the bbox
sq = sq.crop((0, 0, sq.width, int(sq.height * 0.80)))
if sq.width > 320:
    sq = sq.resize((320, round(sq.height * 320 / sq.width)), Image.LANCZOS)
gp = os.path.join(IMG, "grandpa.webp")
sq.save(gp, "WEBP", quality=90, method=6)
print(f"grandpa.webp {sq.size} {os.path.getsize(gp)//1024}KB")
