#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AA — clean the messy green paint-smear line on the bottom edge of
logo_banner.webp (user: «بالای صفحه جایی که کلمه بساز نوشته یک خطی
کشیده شده، بهم‌ریختگی رنگش چیه؟ برطرفش کن»).

Measured geometry (from logo_banner_raw.webp, 880x531):
  • smear wave 1: rows 478-496, x ≈ 130-590 (wide centre streak)
  • smear wave 2: rows 506-531, x ≈ 0-713 (full-width bottom streak)
  • LEGIT wreath leaves live at x < 300 (above y≈478) and x 620-780
So: crop at row 506, then inside the bottom band only x<620 remove
green-dominant pixels (right wreath untouched), with a soft ramp."""
from PIL import Image
import numpy as np
import os

BAK = "/home/z/my-project/scripts/logo_banner_raw.webp"
P = "/home/z/my-project/public/assets/img/logo_banner.webp"

im = Image.open(BAK).convert("RGBA")
a = np.array(im).astype(np.float32)
H, W = a.shape[:2]

CUT = 506                                   # wave-2 starts here
a = a[:CUT]
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
vis = al > 10
green = vis & (g > r + 18) & (g > b + 18) & (g > 55)

# top-zone splatter: green blob between the daisies and the board
# (x 214-360, y 36-114) + green fringe on the hat's left edge
# (x 533-562, y 13-87) — both pure paint artifacts, no legit art there
top1 = np.zeros_like(green); top1[36:114, 214:360] = green[36:114, 214:360]
top2 = np.zeros_like(green); top2[13:87, 533:562] = green[13:87, 533:562]
al[top1] = 0
al[top2] = 0

# wave-1 removal: bottom band (rows 472..CUT), x < 620 only
y0 = 472
kill = np.zeros_like(green)
kill[y0:, :620] = green[y0:, :620]
# soft ramp: 4 rows at the top of the band fade out instead of hard cut
for i, y in enumerate(range(y0, y0 + 4)):
    kill[y, :620] &= green[y, :620]
    al[y, :620][kill[y, :620]] *= i / 4.0 * 0.6
for y in range(y0 + 4, a.shape[0]):
    al[y, :620][kill[y, :620]] = 0

a[..., 3] = al
out = Image.fromarray(a.astype(np.uint8))
out.save(P, "WEBP", quality=92)
print("saved", P, out.size, os.path.getsize(P) // 1024, "KB")
