#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BB.5 — fix the «خط کوچولو روی متن کلمه بساز…» bug.

ROOT CAUSE: public/assets/img/logo_banner.webp has hard near-black
hairline rows baked into its TOP (rows 0..5, mean 0..4.5) and BOTTOM
(rows 502..505, mean 7.6..10) edges. The bottom edge sits exactly where
the slogan pill overlaps the banner (margin-top:-12px), so a thin dark
line appeared to cross the slogan text.

FIX: crop the hard edge rows and add a 10px alpha fade on both ends so
the banner melts into the page instead of ending in a hard line.
"""
from PIL import Image
import numpy as np

SRC = "/home/z/my-project/public/assets/img/logo_banner.webp"
DST = SRC  # in-place; a .bak copy is kept first

import shutil
shutil.copy(SRC, SRC.replace(".webp", ".bak.webp"))

im = Image.open(SRC).convert("RGBA")
a = np.asarray(im).copy()
h, w, _ = a.shape

CROP_TOP, CROP_BOT = 7, 8          # hard edge rows to remove
a = a[CROP_TOP:h - CROP_BOT]
h2 = a.shape[0]

# alpha fade: 10px at top and bottom (0 → 255) so no hard edge remains
FADE = 10
alpha = np.full((h2, w), 255.0)
ramp = np.linspace(0, 1, FADE)
alpha[:FADE] *= ramp[:, None]
alpha[-FADE:] *= ramp[::-1][:, None]
a[..., 3] = (a[..., 3].astype(float) * (alpha / 255.0)).astype(np.uint8)

out = Image.fromarray(a, "RGBA")
out.save(DST, "WEBP", quality=92, method=6)
print("fixed:", out.size, "→", DST)
