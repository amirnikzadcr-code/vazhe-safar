#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EE — clean dictionary_hidden.ts:
   remove any entry containing '?', '؟', ZWNJ, spaces, Latin/digits,
   Arabic ي/ك/ة… and a few targeted fixes. Reports what it removed."""
import re, unicodedata

P = "/home/z/my-project/src/game/data/dictionary_hidden.ts"
src = open(P, encoding="utf-8").read()

# targeted fixes first
src = src.replace('"دراوردن"', '"درآوردن"').replace('"الگوی"', '"الگو"')
src = src.replace('"فلك"', '"فلک"').replace('"میان?"', '"میان"')

entries = re.findall(r'"([^"]*)"', src)
def ok(w: str) -> bool:
    if not w: return False
    if any(c in w for c in "؟?_ \u200c\u200f\u200e"): return False
    for ch in w:
        o = ord(ch)
        if 0x0041 <= o <= 0x007A or 0x0030 <= o <= 0x0039: return False  # latin/digits
        # Persian/Arabic block only + ZWNJ already excluded; allow آ ا...ی پ چ ژ گ ک ی ة? no
    # reject Arabic-specific letters
    for bad in "\u0643\u064A\u0629\u0649\u064A\u0622\u0654\u0655":
        if bad in w: 
            # آ (U+0622) is VALID Persian alef-with-madda — do not reject
            pass
    for bad in "\u0643\u0649\u064A\u0629":  # Arabic kaf, arabic yeh variants, teh marbuta
        if bad in w: return False
    return True

bad = [w for w in entries if not ok(w)]
print(f"total entries: {len(entries)}")
for w in bad:
    src = src.replace(f'"{w}"', '""')
# drop the now-empty string literals together with a trailing/leading comma
src = re.sub(r'""\s*,\s*', '', src)
src = re.sub(r'\s*,\s*""', '', src)

open(P, "w", encoding="utf-8").write(src)

# final stats
final = re.findall(r'"([^"]*)"', src)
final = [w for w in final if w]
uniq = sorted(set(final))
print(f"kept: {len(final)} (unique {len(uniq)})")
print("removed:", ", ".join(bad) if bad else "(none)")
# verify no leftovers
left = [w for w in uniq if not ok(w)]
print("invalid remaining:", left if left else "(none)")
