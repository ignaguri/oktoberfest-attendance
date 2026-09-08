"""Report, per glyph: opaque near-white %, and enclosed-hole pixel count."""
import sys
from PIL import Image, ImageDraw
for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA"); w, h = im.size; px = im.load()
    white = 0
    flags = Image.new("L", (w, h), 0); fp = flags.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128:
                if (0.299*r + 0.587*g + 0.114*b)/255 > 0.87:
                    white += 1
            else:
                fp[x, y] = 255
    for x in range(w):
        for y in (0, h-1):
            if fp[x, y] == 255:
                ImageDraw.floodfill(flags, (x, y), 128, thresh=0)
    for y in range(h):
        for x in (0, w-1):
            if fp[x, y] == 255:
                ImageDraw.floodfill(flags, (x, y), 128, thresh=0)
    holes = sum(1 for y in range(h) for x in range(w) if fp[x, y] == 255)
    tot = w*h
    print(f"{path.split('/')[-1]:32s} opaque-near-white {100*white/tot:5.2f}%   enclosed holes {holes:>7d} px")
