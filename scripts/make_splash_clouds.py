#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — native Android splash v8 (CLOUD SCENE)
(user: «صفحه لودینگ رو حالت ابر بکن … اون صفحه لودینگ آبی حذف کن»)

Replaces the stock Capacitor blue-logo splash with the same storybook
sky the in-app Splash now shows: soft gradient, warm sun glow, puffy
cloud layers, عمو دانا riding his cloud, and the واژه‌سفر banner.
Drawn once at master resolution (portrait 1280x1920, landscape
1920x1280), then resized into every density bucket.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = "/home/z/my-project"
RES = f"{ROOT}/android/app/src/main/res"

SKY_TOP = (191, 231, 255)
SKY_MID = (158, 212, 255)
SKY_MID2 = (200, 235, 255)
SKY_LOW = (230, 246, 226)
SUN_CORE = (255, 243, 190)


def gradient(w, h):
    """vertical sky gradient with a soft green-ish horizon wash"""
    im = Image.new("RGB", (w, h))
    px = im.load()
    stops = [(0.0, SKY_TOP), (0.42, SKY_MID), (0.74, SKY_MID2), (1.0, SKY_LOW)]
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0)
                r = round(c0[0] + (c1[0] - c0[0]) * k)
                g = round(c0[1] + (c1[1] - c0[1]) * k)
                b = round(c0[2] + (c1[2] - c0[2]) * k)
                break
        for x in range(w):
            px[x, y] = (r, g, b)
    return im


def sun_glow(w, h, cx, cy, rad):
    """warm radial sun glow composited onto an RGBA layer"""
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    steps = 26
    for i in range(steps, 0, -1):
        k = i / steps
        r = rad * (0.35 + 0.65 * k)
        a = int(190 * (1 - k) ** 1.6)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 231, 140, a))
    core = rad * 0.34
    d.ellipse([cx - core, cy - core, cx + core, cy + core], fill=(SUN_CORE + (235,)))
    return glow


def cloud(layer, cx, cy, s, alpha=255, shade=True):
    """puffy cloud from ellipse lobes; s = half-width scale unit"""
    d = ImageDraw.Draw(layer)
    white = (255, 255, 255, alpha)
    lobes = [
        (0.00, 0.00, 1.00, 0.52),
        (0.62, -0.34, 0.72, 0.62),
        (-0.60, -0.22, 0.62, 0.50),
        (1.05, 0.05, 0.50, 0.40),
        (-1.08, 0.08, 0.46, 0.38),
        (0.30, -0.55, 0.55, 0.55),
    ]
    for dx, dy, lw, lh in lobes:
        x0 = cx + dx * s - lw * s
        y0 = cy + dy * s - lh * s
        x1 = cx + dx * s + lw * s
        y1 = cy + dy * s + lh * s
        d.ellipse([x0, y0, x1, y1], fill=white)
    if shade:  # soft blue under-shadow for depth
        sh = (214, 236, 255, alpha)
        for dx, dy, lw, lh in [(-0.35, 0.30, 0.55, 0.20), (0.42, 0.32, 0.6, 0.20)]:
            x0 = cx + dx * s - lw * s
            y0 = cy + dy * s - lh * s
            x1 = cx + dx * s + lw * s
            y1 = cy + dy * s + lh * s
            d.ellipse([x0, y0, x1, y1], fill=sh)


def wordmark(target_w):
    """«واژه‌سفر» wordmark auto-fitted to target_w, drawn to match the
    in-game .title3d style: cream fill, warm brown stroke, soft shadow."""
    import arabic_reshaper
    from bidi.algorithm import get_display
    text = get_display(arabic_reshaper.reshape("واژه‌سفر"))
    from PIL import ImageFont
    fpath = f"{ROOT}/scripts/fonts_ttf/Vazirmatn-ExtraBold.ttf"

    def render(size):
        f = ImageFont.truetype(fpath, size)
        tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
        box = tmp.textbbox((0, 0), text, font=f, stroke_width=max(2, size // 22))
        return f, box

    # auto-fit: measure at 100, scale to the requested width
    _, box0 = render(100)
    w0 = max(1, box0[2] - box0[0])
    size = max(24, int(100 * target_w / w0))
    f, box = render(size)
    tw, th = box[2] - box[0], box[3] - box[1]
    pad = size // 4
    layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    ox, oy = pad - box[0], pad - box[1]
    stroke = max(3, size // 20)
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((ox, oy + size // 16), text, font=f,
                            fill=(70, 40, 10, 170), stroke_width=stroke,
                            stroke_fill=(70, 40, 10, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(max(1, size // 22)))
    layer = Image.alpha_composite(layer, sh)
    d = ImageDraw.Draw(layer)
    d.text((ox, oy), text, font=f, fill=(255, 247, 224, 255),
           stroke_width=stroke, stroke_fill=(93, 58, 18, 255))
    d.text((ox, oy - max(1, size // 60)), text, font=f,
           fill=(255, 252, 240, 110), stroke_width=0)
    return layer


def compose(w, h, portrait=True):
    im = gradient(w, h).convert("RGBA")

    # sun
    sun_cx, sun_cy = int(w * 0.16), int(h * (0.13 if portrait else 0.2))
    im = Image.alpha_composite(im, sun_glow(w, h, sun_cx, sun_cy, int(w * 0.34)))

    # far tiny clouds (soft, semi-transparent)
    far = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for fx, fy, fs, fa in [
        (0.74, 0.10, 0.055, 150), (0.30, 0.24, 0.042, 120),
        (0.88, 0.34, 0.048, 130), (0.12, 0.47, 0.040, 110),
        (0.62, 0.20, 0.036, 120),
    ]:
        cloud(far, fx * w, fy * h, fs * w, alpha=fa, shade=False)
    im = Image.alpha_composite(im, far)

    # hero: grandpa on a big cloud
    hero = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    seat = Image.open(f"{ROOT}/public/assets/char/seat.webp").convert("RGBA")
    seat_h = int(h * (0.30 if portrait else 0.52))
    seat_w = int(seat.width * seat_h / seat.height)
    seat = seat.resize((seat_w, seat_h), Image.LANCZOS)
    gcx, gcy = w // 2, int(h * (0.40 if portrait else 0.46))
    cloud(hero, gcx, gcy + int(seat_h * 0.44), int(w * 0.17), alpha=255)
    im = Image.alpha_composite(im, hero)
    im.alpha_composite(seat, (gcx - seat_w // 2, gcy - int(seat_h * 0.62)))

    # foreground drifting clouds (bigger, lower, overlap the frame edges)
    fg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if portrait:
        for fx, fy, fs, fa in [
            (-0.05, 0.68, 0.16, 235), (1.02, 0.80, 0.19, 245),
            (0.20, 0.90, 0.15, 235), (0.85, 0.62, 0.12, 215),
        ]:
            cloud(fg, fx * w, fy * h, fs * w, alpha=fa)
    else:
        for fx, fy, fs, fa in [
            (-0.06, 0.72, 0.14, 235), (1.04, 0.24, 0.16, 235),
            (0.86, 0.84, 0.17, 245), (0.25, 0.16, 0.11, 205),
        ]:
            cloud(fg, fx * w, fy * h, fs * w, alpha=fa)
    im = Image.alpha_composite(im, fg)

    # واژه‌سفر banner (transparent wordmark plaque) under the hero
    banner = Image.open(f"{ROOT}/public/assets/img/logo_banner.webp").convert("RGBA")
    bw = int(w * (0.72 if portrait else 0.40))
    bh = int(banner.height * bw / banner.width)
    banner = banner.resize((bw, bh), Image.LANCZOS)
    bx = (w - bw) // 2
    by = gcy + int(seat_h * 0.44 + w * 0.17 * 0.55) + int(h * 0.03)
    if by + bh > h * 0.94:
        by = int(h * 0.94) - bh
    im.alpha_composite(banner, (bx, by))

    # …the plaque is the EMPTY wooden board — draw the wordmark on it
    # (46% width, nudged left: the hat leans over the board's right end)
    mark = wordmark(int(bw * 0.44))
    mx = bx + int(bw * 0.46) - mark.width // 2
    my = by + int(bh * 0.44) - mark.height // 2
    im.alpha_composite(mark, (mx, my))

    return im.convert("RGB")


def save_master(im, path):
    im.save(path, "PNG", optimize=True)
    print("master", path, im.size)


def export(portrait_master, landscape_master):
    port_sizes = {
        "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280), "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
    }
    land_sizes = {
        "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720), "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
    }
    for d, (w, h) in port_sizes.items():
        portrait_master.resize((w, h), Image.LANCZOS).save(f"{RES}/{d}/splash.png", optimize=True)
        print("ok", d, (w, h))
    for d, (w, h) in land_sizes.items():
        landscape_master.resize((w, h), Image.LANCZOS).save(f"{RES}/{d}/splash.png", optimize=True)
        print("ok", d, (w, h))
    # default drawable keeps the landscape ratio (as the old 480x320)
    landscape_master.resize((480, 320), Image.LANCZOS).save(f"{RES}/drawable/splash.png", optimize=True)
    print("ok drawable (480, 320)")


if __name__ == "__main__":
    pm = compose(1280, 1920, portrait=True)
    lm = compose(1920, 1280, portrait=False)
    os.makedirs(f"{ROOT}/assets/splash_v8", exist_ok=True)
    save_master(pm, f"{ROOT}/assets/splash_v8/portrait.png")
    save_master(lm, f"{ROOT}/assets/splash_v8/landscape.png")
    export(pm, lm)
    print("DONE")
