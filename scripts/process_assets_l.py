#!/usr/bin/env python3
"""Session L — process generated art into game-ready assets.

- Icon sheets: slice fixed boxes -> flood-fill chroma key from box borders
  (only background-connected green is removed; icon-internal greens survive)
  -> autotrim -> feather -> save PNG (crisp, small).
- Scenes: resize -> save webp q76.
- Logo banner: border flood key on dark green -> alpha feather -> PNG.
"""
from PIL import Image, ImageFilter
import os, sys
from collections import deque

GEN = "/home/z/my-project/assets_gen"
IMG_OUT = "/home/z/my-project/public/assets/img"
BG_OUT = "/home/z/my-project/public/assets/bg"
MAP_OUT = "/home/z/my-project/public/assets/map"
os.makedirs(IMG_OUT, exist_ok=True)
os.makedirs(BG_OUT, exist_ok=True)
os.makedirs(MAP_OUT, exist_ok=True)

def close(c, bg, t):
    return abs(c[0]-bg[0]) <= t and abs(c[1]-bg[1]) <= t and abs(c[2]-bg[2]) <= t

def border_key(im, tol=62, extra_light=False, feather=1.2):
    """Flood-fill from borders: remove only bg-connected pixels.
    extra_light: also treat near-white/gray (grid lines touching borders) as keyable."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    # sample bg from 4 corners (median-ish: average)
    cs = [px[0,0][:3], px[w-1,0][:3], px[0,h-1][:3], px[w-1,h-1][:3]]
    bg = tuple(sum(c[i] for c in cs)//4 for i in range(3))
    T = tol
    TL = 235  # near-white threshold for grid lines (if extra_light)
    def is_bg(c):
        if close(c, bg, T): return True
        if extra_light and c[0]>=TL and c[1]>=TL and c[2]>=TL: return True
        return False
    seen = bytearray(w*h)
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if not seen[y*w+x] and is_bg(px[x,y][:3]): seen[y*w+x]=1; q.append((x,y))
    for y in range(h):
        for x in (0, w-1):
            if not seen[y*w+x] and is_bg(px[x,y][:3]): seen[y*w+x]=1; q.append((x,y))
    while q:
        x,y = q.popleft()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny = x+dx,y+dy
            if 0<=nx<w and 0<=ny<h and not seen[ny*w+nx] and is_bg(px[nx,ny][:3]):
                seen[ny*w+nx]=1; q.append((nx,ny))
    # build alpha: 0 for keyed, 255 otherwise, soft edge via small blur
    alpha = Image.new("L", (w,h), 255)
    ap = alpha.load()
    for y in range(h):
        row = y*w
        for x in range(w):
            if seen[row+x]: ap[x,y]=0
    if feather:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    im.putalpha(alpha)
    return im

def autotrim(im, pad=6):
    bbox = im.getchannel("A").getbbox()
    if not bbox: return im
    x0,y0,x1,y1 = bbox
    x0=max(0,x0-pad); y0=max(0,y0-pad)
    x1=min(im.width,x1+pad); y1=min(im.height,y1+pad)
    return im.crop((x0,y0,x1,y1))

def save_icon(im, name, max_side=256):
    im = autotrim(im)
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(f"{IMG_OUT}/{name}.png", optimize=True)
    print(f"icon {name}: {im.size}")

# ---------------- icon sheet A (3x3 grid on light green) ----------------
a = Image.open(f"{GEN}/icons_a.png").convert("RGB")
W,H = a.size
cw, ch = W/3, H/3
def cell(img, cx, cy, inset=10):
    x0 = int(cx*cw)+inset; y0 = int(cy*ch)+inset
    x1 = int((cx+1)*cw)-inset; y1 = int((cy+1)*ch)-inset
    return img.crop((x0,y0,x1,y1))
save_icon(border_key(cell(a,0,0)), "shop")       # shop stall
save_icon(border_key(cell(a,1,0)), "mission")    # blue star book
save_icon(border_key(cell(a,2,0)), "chest")      # treasure chest
save_icon(border_key(cell(a,0,1)), "house")      # red house
save_icon(border_key(cell(a,1,1)), "books")      # book stack
save_icon(border_key(cell(a,2,1)), "tasks")      # clipboard
save_icon(border_key(cell(a,1,2)), "coins")      # coin stack

def hole_key(im, tol=62):
    """Second pass: remove ANY remaining pixels close to the sampled bg
    (for enclosed holes like the gear's center). Use only on icons whose
    body color is far from the bg green."""
    im = im.convert("RGBA")
    w,h = im.size
    px = im.load()
    cs = [px[0,0], px[w-1,0], px[0,h-1], px[w-1,h-1]]
    cs = [c for c in cs if c[3] > 0] or [(139,195,74,255)]
    bg = tuple(sum(c[i] for c in cs)//len(cs) for i in range(3))
    for y in range(h):
        for x in range(w):
            c = px[x,y]
            if c[3] > 0 and close(c[:3], bg, tol):
                px[x,y] = (0,0,0,0)
    return im

# ---------------- icon sheet B (3x3-ish on light green) ----------------
b = Image.open(f"{GEN}/icons_b.png").convert("RGB")
Wb,Hb = b.size
def box(img, x0,y0,x1,y1):
    return img.crop((x0,y0,x1,y1))
# eyeballed boxes (see sheet): cols ~ [30,320],[355,645],[680,1000]; rows ~ [50,370],[390,680],[700,1010]
save_icon(border_key(box(b,20,40,330,380)), "gift")
save_icon(border_key(box(b,350,40,660,385)), "bulb")
save_icon(border_key(box(b,670,50,1015,370)), "swap")
save_icon(border_key(box(b,20,390,330,690)), "star")
save_icon(hole_key(border_key(box(b,350,395,660,690), tol=54), tol=54), "gear")
save_icon(border_key(box(b,655,385,1024,1024)), "grandpa", max_side=320)
save_icon(border_key(box(b,20,700,330,1010)), "star2", max_side=1)  # dup skip -> tiny junk, will be overwritten
os.remove(f"{IMG_OUT}/star2.png")

# ---------------- logo banner (dark green bg) ----------------
lb = Image.open(f"{GEN}/logo_banner.png")
lbk = border_key(lb, tol=46, feather=1.6)
lbk = autotrim(lbk, pad=4)
lbk.thumbnail((1000, 1000), Image.LANCZOS)
lbk.save(f"{IMG_OUT}/logo_banner.png", optimize=True)
print("logo banner:", lbk.size)

# ---------------- scenes → webp ----------------
def scene(src, dst, width=720, q=76):
    im = Image.open(f"{GEN}/{src}").convert("RGB")
    r = width/im.width
    im = im.resize((width, int(im.height*r)), Image.LANCZOS)
    im.save(dst, quality=q, method=6)
    print(os.path.basename(dst), im.size, f"{os.path.getsize(dst)//1024}KB")

scene("home_bg.png", f"{BG_OUT}/home3.webp", 768, 78)
scene("game_bg.png", f"{BG_OUT}/play3.webp", 768, 78)
for i in range(1, 11):
    src = f"{GEN}/map{i:02d}.png"
    if os.path.exists(src):
        scene(f"map{i:02d}.png", f"{MAP_OUT}/m{i:02d}.webp", 700, 72)
    else:
        print(f"map{i:02d} missing — run gen_maps_l.sh again")
print("DONE")
