"""Two alpha repairs for BiRefNet's inconsistent handling of interior light regions.

  cut   - opaque near-white becomes transparent (glass/air that should see through)
  fill  - transparent regions fully enclosed by opaque art become opaque in a colour
          (stripes the matte wrongly punched out)

  python3 alphafix.py cut  src.png dst.png [luma_threshold]
  python3 alphafix.py fill src.png dst.png '#D9C1F4'
"""
import sys
from PIL import Image, ImageDraw

mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()

if mode == "cut":
    thr = float(sys.argv[4]) if len(sys.argv) > 4 else 0.87
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128 and (0.299 * r + 0.587 * g + 0.114 * b) / 255 > thr:
                px[x, y] = (r, g, b, 0)
                n += 1
    print(f"{dst}  cut {n} px to transparent")

elif mode == "fill":
    hexcol = sys.argv[4].lstrip("#")
    col = tuple(int(hexcol[i:i + 2], 16) for i in (0, 2, 4))
    # mark transparency reachable from the border as "outside"
    flags = Image.new("L", (w, h), 0)
    fp = flags.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] <= 128:
                fp[x, y] = 255          # candidate transparent
    d = ImageDraw.Draw(flags)
    for x in range(w):
        for y in (0, h - 1):
            if fp[x, y] == 255:
                ImageDraw.floodfill(flags, (x, y), 128, thresh=0)
    for y in range(h):
        for x in (0, w - 1):
            if fp[x, y] == 255:
                ImageDraw.floodfill(flags, (x, y), 128, thresh=0)
    n = 0
    for y in range(h):
        for x in range(w):
            if fp[x, y] == 255:          # transparent but NOT border-connected = hole
                px[x, y] = (*col, 255)
                n += 1
    print(f"{dst}  filled {n} px of enclosed holes with #{hexcol}")
else:
    sys.exit("mode must be cut or fill")

im.save(dst)
