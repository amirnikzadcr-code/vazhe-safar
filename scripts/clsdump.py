#!/usr/bin/env python3
"""Parse a .class constant pool → print method signatures (no javap needed)."""
import struct, sys

def parse(path):
    d = open(path, 'rb').read()
    i = 8  # magic+minor+major
    n = struct.unpack_from('>H', d, i)[0]; i += 2
    cp = [None] * n
    j = 1
    while j < n:
        tag = d[i]; i += 1
        if tag == 1:  # Utf8
            ln = struct.unpack_from('>H', d, i)[0]; i += 2
            cp[j] = ('utf8', d[i:i+ln].decode('utf-8', 'replace')); i += ln
        elif tag == 7: cp[j] = ('class', struct.unpack_from('>H', d, i)[0]); i += 2
        elif tag == 9 or tag == 10 or tag == 11:  # Field/Method/Iface ref
            cp[j] = ('ref', struct.unpack_from('>HH', d, i)); i += 4
        elif tag == 3: cp[j] = ('int',); i += 4
        elif tag == 4: cp[j] = ('float',); i += 4
        elif tag == 5: cp[j] = ('long',); i += 8; j += 1
        elif tag == 6: cp[j] = ('double',); i += 8; j += 1
        elif tag == 8: cp[j] = ('str', struct.unpack_from('>H', d, i)[0]); i += 2
        elif tag == 12: cp[j] = ('name_type', struct.unpack_from('>HH', d, i)); i += 4
        elif tag == 15: cp[j] = ('methodhandle',); i += 3
        elif tag == 16: cp[j] = ('methodtype', struct.unpack_from('>H', d, i)[0]); i += 2
        elif tag == 17 or tag == 18: cp[j] = ('dynamic', struct.unpack_from('>HH', d, i)); i += 4
        elif tag == 19: cp[j] = ('module', struct.unpack_from('>H', d, i)[0]); i += 2
        elif tag == 20: cp[j] = ('package', struct.unpack_from('>H', d, i)[0]); i += 2
        else: raise ValueError(f'tag {tag} at {j}')
        j += 1
    def utf(idx): return cp[idx][1]
    out = set()
    for e in cp:
        if e and e[0] == 'ref':
            cls_idx, nt_idx = e[1]
            cls = utf(cp[cls_idx][1])
            name_idx, desc_idx = cp[nt_idx][1]
            out.add(f"{cls} :: {utf(name_idx)} {utf(desc_idx)}")
    return out

base = '/tmp/mk118x/cls/'
want = sys.argv[1:] or ['IabHelper.class', 'util/Purchase.class', 'util/Inventory.class', 'util/IabResult.class']
import glob, os
for w in want:
    for f in glob.glob(base + w):
        print('=====', os.path.basename(f))
        for s in sorted(parse(f)):
            cls, rest = s.split(' :: ', 1)
            short = cls.split('/')[-1]
            print(f"  {short} :: {rest}")
