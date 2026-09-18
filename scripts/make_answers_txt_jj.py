#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JJ-4: Build the complete answer sheet (all levels, all chapters) as a TXT cheat sheet.
Sources: src/game/data/levels/ch01..ch20.json + chapter titles from src/game/data/chapters.ts
Output:  download/vazhe-safar-answers.txt
"""
import json, re, io

ROOT = "/home/z/my-project"

# --- chapter titles in order ------------------------------------------------
# title/subtitle alternate in chapters.ts → keep every 2nd match starting at 0
titles = []
with open(f"{ROOT}/src/game/data/chapters.ts", encoding="utf-8") as f:
    for m in re.finditer(r'(?:title|subtitle):\s*"([^"]+)"', f.read()):
        titles.append(m.group(1))
titles = titles[0::2]
print("chapters found:", len(titles))

fa = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
def fa_num(n):
    return str(n).translate(fa)

out = io.StringIO()
w = out.write

total_levels = 0
total_main = 0
total_bonus = 0

w("واژه‌سفر — پاسخ‌نامهٔ کامل همهٔ مراحل\n")
w("همهٔ پاسخ‌های ۲۲۰ مرحلهٔ بازی در ۲۰ فصل (کلمات اصلی + کلمات جایزهٔ مخفی)\n")
w("=" * 46 + "\n\n")

for ch in range(1, 21):
    data = json.load(open(f"{ROOT}/src/game/data/levels/ch{ch:02d}.json", encoding="utf-8"))
    title = titles[ch - 1] if ch - 1 < len(titles) else ""
    w("■" * 46 + "\n")
    w(f"■ فصل {fa_num(ch)} — {title}\n")
    w("■" * 46 + "\n\n")
    for lv in data:
        total_levels += 1
        wheel = "، ".join(list(lv["wheel"]))
        main_words = " ، ".join(lv["words"])
        bonus = lv.get("bonus", [])
        total_main += len(lv["words"])
        total_bonus += len(bonus)
        w(f"─ مرحلهٔ {fa_num(lv['id'])} ─ حروف چرخ: {wheel}\n")
        w(f"   کلمات اصلی: {main_words}\n")
        if bonus:
            w(f"   کلمات جایزه (مخفی): {" ، ".join(bonus)}\n")
        w("\n")

w("=" * 46 + "\n")
w(f"پایان — {fa_num(total_levels)} مرحله، {fa_num(total_main)} کلمهٔ اصلی، {fa_num(total_bonus)} کلمهٔ جایزه\n")

content = out.getvalue()
dst = f"{ROOT}/download/vazhe-safar-answers.txt"
with open(dst, "w", encoding="utf-8") as f:
    f.write(content)
print("levels:", total_levels, "| main words:", total_main, "| bonus words:", total_bonus)
print("bytes:", len(content.encode("utf-8")), "->", dst)
