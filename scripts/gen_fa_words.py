#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — gen_fa_words.py  (session Y, v1.24)

USER: «هر چرت پرتی وارد میکنم قبول میکنه — برگرد ب بکاپ قبلی و 159 هزار
پاک کن و فقط جمله های ایرانی بزار حداقل 30 هزار تا جمله ایرانی»

The v1.23 lexicon (159,454 tokens scraped from mixed web lists) shipped
GARBAGE: «آآ»، «آارخیس»، «استرزی»، «میطیدانون»… so دورهمی accepted
nonsense. This script REPLACES that file with a clean, frequency-ranked
Persian word list:

  SOURCES (both real-usage corpora, not web scrapes):
   1. wordfreq (pip) top-N for 'fa'   — OpenSubtitles + Twitter + Reddit
   2. hermitdave/FrequencyWords fa_50k — OpenSubtitles ranked tokens
   3. the game's own curated dictionaries (dictionary/extra/party —
      the «بکاپ قبلی» the user asked to return to)

  HARD FILTERS (the anti-چرت‌وپرت pass):
   • Persian letters ONLY after normalization (ي→ی ك→ک ة→ه أإ→ا …)
   • diacritics stripped, ZWNJ joined (same rules as normWord)
   • length 2..12
   • NO doubled adjacent letters (Persian has no gemination in writing;
     the one writing-exception لله is kept)
   • no letter occurring 4+ times in one word
   • no repeated-syllable junk (…با echo of «لالا»-style ≥3 cycles)
   • known-garbage blocklist + anything the QA probes flag
   • frequency threshold from the corpus ranks (kills hapax noise)

Output: public/assets/dict/fa_words.txt  (one word per line, ranked)
"""
import io
import json
import os
import re
import subprocess
import sys
import urllib.request

ROOT = "/home/z/my-project"
OUT = f"{ROOT}/public/assets/dict/fa_words.txt"
MIN_WORDS = 30_000
TARGET_CAP = 46_000          # keep the clean list tight (fast first decode)

# ---------------------------------------------------------------- sources
def load_wordfreq(n=120_000):
    try:
        from wordfreq import top_n_list
        return list(top_n_list("fa", n))
    except Exception as e:                                     # noqa: BLE001
        print(f"[warn] wordfreq unavailable ({e}) → FrequencyWords only")
        return []

def load_freqwords():
    url = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fa/fa_50k.txt"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "vazhesafar-dict"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read().decode("utf-8", "ignore")
        pairs = []
        for line in data.splitlines():
            parts = line.split()
            if len(parts) != 2:
                continue
            w, c = parts[0], parts[1]
            if c.isdigit():
                pairs.append((w, int(c)))
        return pairs
    except Exception as e:                                     # noqa: BLE001
        print(f"[warn] FrequencyWords unavailable ({e})")
        return []

def load_curated():
    import re as _re
    def arr(path, var):
        src = open(path, encoding="utf-8").read()
        m = _re.search(r"export const %s[^=]*=\s*\[(.*?)\n\];" % var, src, _re.S)
        return _re.findall(r'"([^"]+)"', m.group(1))
    d = arr(f"{ROOT}/src/game/data/dictionary.ts", "DICT_WORDS")
    e = arr(f"{ROOT}/src/game/data/dictionary_extra.ts", "EXTRA_WORDS")
    p = arr(f"{ROOT}/src/game/data/dictionary_party.ts", "PARTY_WORDS")
    return d + e + p

# ---------------------------------------------------------------- filters
FA_OK = set("آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیئء")
DIACRITICS = re.compile(r"[\u064b-\u065f\u0670\u0640]")

def norm(w):
    w = DIACRITICS.sub("", w)
    for a, b in (("ي", "ی"), ("ك", "ک"), ("ة", "ه"), ("أ", "ا"),
                 ("إ", "ا"), ("ؤ", "و"), ("ۀ", "ه"), ("\u200c", "")):
        w = w.replace(a, b)
    return w.strip()

def has_bad_pairs(w):
    """no doubled adjacent letters — except لله's «لل»."""
    for i in range(len(w) - 1):
        if w[i] == w[i + 1] and not (w[i] == "ل" and i + 2 < len(w) and w[i + 2] == "ه"):
            return True
    return False

def repeat_junk(w):
    """same letter ≥4× (…اااا) or a short syllable looped ≥3× (لالا…)."""
    from collections import Counter
    c = Counter(w)
    if max(c.values()) >= 4:
        return True
    for k in range(1, 4):                       # syllable length 1..3
        if len(w) >= 3 * k and w[:k] * 3 == w[:3 * k] and len(set(w[:k])) >= 1:
            # full word being ≥3 copies of the same syllable
            if len(w) % k == 0 and w == w[:k] * (len(w) // k) and k < len(w):
                return True
    return False

BLOCK = {
    # junk caught in review (v1.23 leftovers + obvious non-words)
    "چرت", "پرت", "ایباب", "باباب", "آآ", "اا", "هه", "ههه", "خخ", "لو",
    "الاا", "ییی", "وممم", "اووو", "آهاا", "ایای",
}
KEEP_PROBE = ["سلام", "کتاب", "آب", "خورشید", "مادر", "بابا", "ایران",
              "تهران", "واژه", "بازی", "چرخ", "دوست", "شب", "روز", "گل",
              "کوه", "دریا", "عشق", "زندگی", "خانه", "قلم", "مداد", "باغ",
              "پنجره", "معلم", "دانش‌آموز", "کودک", "قلب", "آسمان"]
KILL_PROBE = ["آآ", "آآر", "آآرو", "آئب", "آارخیس", "استرزی", "میطیدانون",
              "ژولپ", "قرضبة", "بعضة", "تریبة", "قطیفة", "صیاجة", "حواریة",
              "ناغض", "معروش", "لاعون", "ابوخداش", "آباقا", "آبافت",
              "آئس", "آئرپلان", "آار", "آآب"]

def ok(w):
    if not (2 <= len(w) <= 12):
        return False
    if not all(ch in FA_OK for ch in w):
        return False
    if has_bad_pairs(w) or repeat_junk(w):
        return False
    return True

# ---------------------------------------------------------------- build
def main():
    wf = load_wordfreq()
    fw = load_freqwords()
    curated = load_curated()
    print(f"sources: wordfreq={len(wf)} freqwords={len(fw)} curated={len(curated)}")

    rank = {}                                    # word → best (kind, score)
    for i, tok in enumerate(wf):
        w = norm(tok)
        if w and w not in rank:
            rank[w] = i
    for i, (tok, cnt) in enumerate(fw):
        w = norm(tok)
        # FrequencyWords rank i ≈ wordfreq rank; keep the better (lower)
        if w and (w not in rank or i < rank[w]):
            rank[w] = i

    words = set()
    for w in curated:
        nw = norm(w)
        if ok(nw):
            words.add(nw)
    n_curated = len(words)

    # frequency threshold: corpus rank ≤ 65k (real usage) or curated.
    # Y-FIX — corpus 2-letter tokens are SUBTITLE FRAGMENTS («جق», «دث»,
    # «کع») = the exact «چرت پرت» the user rejected. 2-letter acceptance
    # stays owned by the CURATED dictionaries (the «بکاپ قبلی»), the
    # corpus only vouches for 3+ letter real words.
    for w, r in rank.items():
        if r <= 65_000 and ok(w) and len(w) >= 3:
            words.add(w)

    words = {w for w in words if w not in BLOCK and not repeat_junk(w)}

    # ranked output: curated first (game-critical), then corpus order
    ordered = sorted(words, key=lambda w: (0 if w else 1, rank.get(w, 10**9), w))
    if len(ordered) > TARGET_CAP:
        # never drop curated words; trim only corpus tail
        cur = [w for w in ordered if norm(w) and _is_curated(w, curated)]
        rest = [w for w in ordered if w not in set(cur)]
        ordered = cur + rest[: max(0, TARGET_CAP - len(cur))]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(ordered) + "\n")

    # ---------------------------------------------------------------- QA
    have = set(ordered)
    missing_keep = [w for w in KEEP_PROBE if norm(w) not in have]
    junk_found = [w for w in KILL_PROBE if norm(w) in have]
    print(f"curated-kept: {n_curated}")
    print(f"TOTAL: {len(ordered)}  ({os.path.getsize(OUT)//1024} KB)")
    print("missing real words:", missing_keep or "NONE ✔")
    print("junk leaked:", junk_found or "NONE ✔")
    print("sample:", " ".join(ordered[9000:9012]))
    assert len(ordered) >= MIN_WORDS, f"only {len(ordered)} words (<{MIN_WORDS})"
    assert not missing_keep, f"lost real words: {missing_keep}"
    assert not junk_found, f"junk survived: {junk_found}"
    json.dump({"total": len(ordered)}, open(f"{ROOT}/scripts/fa_words_meta.json", "w"))
    print("OK ✔ fa_words.txt regenerated")

def _is_curated(w, curated):
    return w in _CUR_SET

_CUR_SET = set()

if __name__ == "__main__":
    _CUR_SET = {norm(w) for w in load_curated()}
    main()
