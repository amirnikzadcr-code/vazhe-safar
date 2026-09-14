#!/usr/bin/env python3
"""Contact sheet of all 10 maps with a 10% grid overlay for node alignment."""
from PIL import Image, ImageDraw
import os

GEN = "/home/z/my-project/assets_gen"
cell_w = 340
cols = 5
rows = 2
sheet = Image.new("RGB", (cell_w * cols, cell_w * rows * 2 // 1), (30, 30, 30))
# each map 768x1344 → thumbnail height proportional
th_h = int(cell_w * 1344 / 768)  # 595
sheet = Image.new("RGB", (cell_w * cols, th_h * rows), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i in range(10):
    p = f"{GEN}/map{i+1:02d}.png"
    im = Image.open(p).convert("RGB").resize((cell_w, th_h), Image.LANCZOS)
    dr = ImageDraw.Draw(im, "RGBA")
    for gx in range(0, 11):
        x = cell_w * gx // 10
        dr.line([(x, 0), (x, th_h)], fill=(255, 0, 0, 90), width=1)
        if gx < 10:
            dr.text((x + 2, 2), str(gx * 10), fill=(255, 255, 0))
    for gy in range(0, 11):
        y = th_h * gy // 10
        dr.line([(0, y), (cell_w, y)], fill=(255, 0, 0, 90), width=1)
        if gy < 10:
            dr.text((2, y + 2), str(gy * 10), fill=(255, 255, 0))
    cx, cy = (i % cols) * cell_w, (i // cols) * th_h
    sheet.paste(im, (cx, cy))
    dr2 = ImageDraw.Draw(sheet)
    dr2.rectangle([cx, cy, cx + 40, cy + 18], fill=(0, 0, 0))
    dr2.text((cx + 4, cy + 3), f"ch{i+1}", fill=(255, 255, 0))
sheet.save(f"{GEN}/maps_grid.png", optimize=True)
print("saved", sheet.size)
