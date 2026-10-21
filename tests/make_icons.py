#!/usr/bin/env python3
"""Draw the FE1 'Forge' icon (ember flame in a gold hex ring) as PNGs with PIL."""
import math
from PIL import Image, ImageDraw, ImageFilter

GOLD = (212, 167, 44)
GOLD_L = (246, 212, 122)
CREAM = (245, 238, 218)
BG = (10, 12, 17)
FIRE_TOP = (255, 233, 163)
FIRE_MID = (255, 176, 58)
FIRE_BOT = (224, 94, 31)

def cubic(p0, p1, p2, p3, n=28):
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t**3*p3[0]
        y = mt**3*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts

def flame_points(cx, top, w, h):
    """Teardrop flame outline via 4 cubic segments. w=half-width, h=height."""
    base_y = top + h
    pts = []
    pts += cubic((cx, top), (cx + w*0.52, top + h*0.34), (cx + w, top + h*0.52), (cx + w, base_y - h*0.22))
    pts += cubic((cx + w, base_y - h*0.22), (cx + w, base_y), (cx - w, base_y), (cx - w, base_y - h*0.22))
    pts += cubic((cx - w, base_y - h*0.22), (cx - w, top + h*0.52), (cx - w*0.52, top + h*0.34), (cx, top))
    return pts

def vgrad(size, top, mid, bot):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        if t < 0.45:
            k = t / 0.45
            c = tuple(int(top[i] + (mid[i] - top[i]) * k) for i in range(3))
        else:
            k = (t - 0.45) / 0.55
            c = tuple(int(mid[i] + (bot[i] - mid[i]) * k) for i in range(3))
        for x in range(size):
            px[x, y] = c
    return img

def draw_icon(size, path, pad_frac=0.0):
    S = size * 4  # supersample
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img, "RGBA")
    u = S / 100.0
    pad = pad_frac * 100

    # ember glow
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(int(30 * u), 0, -2):
        a = int(120 * (1 - r / (30 * u)) ** 1.6)
        gd.ellipse([50*u - r, 52*u - r, 50*u + r, 52*u + r], fill=(255, 157, 46, a))
    glow = glow.filter(ImageFilter.GaussianBlur(6 * u / 4))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    d = ImageDraw.Draw(img, "RGBA")

    def hexpts(cx, cy, r):
        return [(cx + r * math.cos(math.radians(60 * i - 90)),
                 cy + r * math.sin(math.radians(60 * i - 90))) for i in range(6)]

    lo, hi = pad, 100 - pad
    cx, cy, R = 50, 50, (hi - lo) / 2
    # outer hex ring
    d.polygon([(x*u, y*u) for (x, y) in hexpts(cx, cy, R)], outline=GOLD + (255,), width=max(2, int(3.4 * u * (100 - 2 * pad) / 100)))
    # inner echo ring
    d.polygon([(x*u, y*u) for (x, y) in hexpts(cx, cy, R * 0.86)], outline=GOLD + (110,), width=max(1, int(1.1 * u * (100 - 2 * pad) / 100)))
    # vertex node dots
    for (x, y) in hexpts(cx, cy, R):
        rr = 1.9 * u * (100 - 2 * pad) / 100
        d.ellipse([x*u - rr, y*u - rr, x*u + rr, y*u + rr], fill=GOLD_L + (255,))

    # flame with fire gradient, masked
    sc = (100 - 2 * pad) / 100
    fcx, ftop, fw, fh = cx, cy - 26 * sc, 15.8 * sc, 52 * sc
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.polygon([(x*u, y*u) for (x, y) in flame_points(fcx, ftop, fw, fh)], fill=255)
    grad = vgrad(S, FIRE_TOP, FIRE_MID, FIRE_BOT).convert("RGBA")
    img = Image.composite(grad, img, mask)
    d = ImageDraw.Draw(img, "RGBA")
    # inner cream flame
    icx, itop, iw, ih = fcx, ftop + fh * 0.44, fw * 0.44, fh * 0.52
    d.polygon([(x*u, y*u) for (x, y) in flame_points(icx, itop, iw, ih)], fill=(255, 243, 196, 255))

    img = img.convert("RGB").resize((size, size), Image.LANCZOS)
    img.save(path)
    print("wrote", path, size)

base = "/home/hatch/workspace/your_files/fithq-app/"
draw_icon(192, base + "icon-192.png")
draw_icon(512, base + "icon-512.png")
draw_icon(512, base + "icon-maskable-512.png", pad_frac=0.11)
