#!/usr/bin/env python3
"""Recompress webp assets (q=76, method=6) — halves payload for faster loading.
Writes to a temp file first and only replaces the original when smaller."""
from PIL import Image
import os, glob

total_before = total_after = 0
for pattern in ("public/assets/bg/*.webp", "public/assets/char/*.webp", "public/assets/obj/*.webp"):
    for p in sorted(glob.glob(pattern)):
        before = os.path.getsize(p)
        im = Image.open(p)
        tmp = p + ".tmp.webp"
        im.save(tmp, "WEBP", quality=76, method=6)
        after = os.path.getsize(tmp)
        if after < before:
            os.replace(tmp, p)
            print(f"{p}: {before//1024}KB -> {after//1024}KB")
        else:
            os.remove(tmp)
            after = before
            print(f"{p}: kept ({before//1024}KB)")
        total_before += before
        total_after += after
print(f"TOTAL: {total_before//1024}KB -> {total_after//1024}KB  ({100 - total_after*100//total_before}% saved)")
