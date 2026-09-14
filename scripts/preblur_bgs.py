# -*- coding: utf-8 -*-
"""
preblur_bgs.py — v4 PERF
The inner screens used CSS `filter: blur(2px)` on full-screen backdrops.
On weak phone GPUs a blurred full-screen layer is one of the most
expensive rasters there is (re-done on every invalidation). We bake the
blur into the WEBP files once, offline, and drop the CSS filter.

CSS blur(2px) at ~430 CSS px width on an 820px source ≈ 3.8px source
radius → we bake radius 4.
"""
from PIL import Image, ImageFilter
import os

BASE = "/home/z/my-project/public/assets/bg"
JOBS = [
    ("home2.webp",   "home2b.webp",   4),
    ("map2.webp",    "map2b.webp",    4),
    ("sunset2.webp", "sunset2b.webp", 4),
]

for src, dst, r in JOBS:
    sp, dp = os.path.join(BASE, src), os.path.join(BASE, dst)
    im = Image.open(sp).convert("RGB")
    out = im.filter(ImageFilter.GaussianBlur(radius=r))
    out.save(dp, "WEBP", quality=78, method=6)
    print(f"{dst}: {im.size} -> {os.path.getsize(dp)//1024}KB")
