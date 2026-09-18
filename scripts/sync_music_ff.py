#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""FF — sync music_configs.json entries for ch06 + ch11 with the new
bright configs from src/game/data/chapters.ts (mahur/rast santur+daf,
فصل-۲۰ family; user: «موزیک فصل 6 و 11 مشکل دارن، مثله فصل‌های دیگ»)."""
import json

MAHUR = [0, 204, 408, 498, 702, 906, 1108]
RAST = [0, 204, 356, 498, 702, 906, 1050]

CH06 = {
    "track": "ch06", "scale": "mahur", "root": 293.66, "cents": MAHUR,
    "bpm": 104, "meter": 6, "perc": "daf", "lead": "santur", "octave": 1, "drone": 0.45,
    "motif": [[0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 0.5], [5, 1], [4, 0.5], [3, 0.5],
              [4, 1], [2, 0.5], [1, 0.5], [2, 1], [3, 0.5], [2, 0.5], [1, 0.5], [0, 1.5]],
    "motifB": [[5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [1, 1], [2, 1], [3, 1], [2, 0.5],
               [1, 0.5], [0, 1], [-1, 0.5], [2, 0.5], [1, 0.5], [0, 1.5]],
}

CH11 = {
    "track": "ch11", "scale": "rast", "root": 261.63, "cents": RAST,
    "bpm": 100, "meter": 6, "perc": "daf", "lead": "santur", "octave": 1, "drone": 0.45,
    "motif": [[0, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [6, 0.5], [5, 0.5], [4, 1], [3, 0.5],
              [4, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [2, 1], [1, 0.5], [2, 0.5], [3, 0.5],
              [2, 0.5], [1, 0.5], [0, 1.5]],
    "motifB": [[4, 0.5], [5, 0.5], [6, 1], [5, 0.5], [4, 0.5], [3, 1], [2, 0.5], [3, 0.5],
               [4, 0.5], [3, 0.5], [2, 0.5], [1, 1], [0, 2]],
}

PATH = "/home/z/my-project/scripts/music_configs.json"
cfgs = json.load(open(PATH))
for item in cfgs:
    if item["id"] == 6:
        item["music"] = CH06
    elif item["id"] == 11:
        item["music"] = CH11
json.dump(cfgs, open(PATH, "w"), ensure_ascii=False, indent=1)
print("synced ch06 + ch11 configs")
