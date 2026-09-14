#!/usr/bin/env python3
"""Compose all processed icons on a magenta checkerboard to inspect alpha quality."""
from PIL import Image
import os

IMG = "/home/z/my-project/public/assets/img"
names = ["shop","mission","chest","house","books","tasks","coins","gift","bulb","swap","star","gear","grandpa","logo_banner"]
cell = 220
cols = 5
rows = (len(names)+cols-1)//cols
W,H = cols*cell, rows*cell
board = Image.new("RGB",(W,H),(255,0,255))
for y in range(0,H,20):
    for x in range(0,W,20):
        if (x//20+y//20)%2==0:
            for yy in range(y,min(y+20,H)):
                for xx in range(x,min(x+20,W)):
                    board.putpixel((xx,yy),(200,0,200))
for i,n in enumerate(names):
    p = f"{IMG}/{n}.png"
    if not os.path.exists(p): print("missing",n); continue
    im = Image.open(p).convert("RGBA")
    im.thumbnail((cell-16,cell-16), Image.LANCZOS)
    cx,cy = (i%cols)*cell, (i//cols)*cell
    board.paste(im,(cx+(cell-im.width)//2, cy+(cell-im.height)//2), im)
board.save("/home/z/my-project/assets_gen/icon_check.png")
print("saved icon_check.png")
