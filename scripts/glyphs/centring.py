"""Measure how well the dark mark sits inside the calendar face.

Isolates dark pixels within the face interior (excluding the frame and the header
band), then reports the offset of their bounding box centre from the face centre,
as a percentage of face width/height. 0% = perfectly centred.
"""
import sys
from PIL import Image

for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA"); w, h = im.size; px = im.load()
    xs = [x for y in range(h) for x in range(w) if px[x, y][3] > 128]
    ys = [y for y in range(h) for x in range(w) if px[x, y][3] > 128]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    gw, gh = x1 - x0, y1 - y0
    # face interior: inset past the frame, below the header band
    ix0, ix1 = x0 + int(0.16 * gw), x1 - int(0.16 * gw)
    iy0, iy1 = y0 + int(0.34 * gh), y1 - int(0.10 * gh)
    dark = [(x, y) for y in range(iy0, iy1) for x in range(ix0, ix1)
            if px[x, y][3] > 128 and sum(px[x, y][:3]) / 3 < 90]
    if not dark:
        print(f"{path.split('/')[-1]:30s} no dark mark found"); continue
    dxs = [p[0] for p in dark]; dys = [p[1] for p in dark]
    cx, cy = (min(dxs) + max(dxs)) / 2, (min(dys) + max(dys)) / 2
    fx, fy = (ix0 + ix1) / 2, (iy0 + iy1) / 2
    ox = 100 * (cx - fx) / (ix1 - ix0)
    oy = 100 * (cy - fy) / (iy1 - iy0)
    print(f"{path.split('/')[-1]:30s} offset  x {ox:+6.1f}%   y {oy:+6.1f}%")
