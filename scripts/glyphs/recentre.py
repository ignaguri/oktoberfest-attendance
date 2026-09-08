"""Recentre a dark mark inside a coloured face (used for the calendar check).

The mark is near-black on saturated green, so the G channel separates them cleanly.
Erase the mark, refill from the nearest clean face pixel on the same row (which
preserves any vertical gradient), then paste the mark back on centre.
"""
import sys
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()

xs = [x for y in range(h) for x in range(w) if px[x, y][3] > 128]
ys = [y for y in range(h) for x in range(w) if px[x, y][3] > 128]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
gw, gh = x1 - x0, y1 - y0
ix0, ix1 = x0 + int(0.16 * gw), x1 - int(0.16 * gw)
iy0, iy1 = y0 + int(0.34 * gh), y1 - int(0.10 * gh)

# mark mask: inside the face, green channel low
mask = Image.new("L", (w, h), 0); mp = mask.load()
for y in range(iy0, iy1):
    for x in range(ix0, ix1):
        r, g, b, a = px[x, y]
        if a > 128 and g < 120:
            mp[x, y] = 255
mask = mask.filter(ImageFilter.MaxFilter(5))   # cover anti-aliased edge
mp = mask.load()

pts = [(x, y) for y in range(iy0, iy1) for x in range(ix0, ix1) if mp[x, y]]
if not pts:
    sys.exit("no mark found")
mxs = [p[0] for p in pts]; mys = [p[1] for p in pts]
cx, cy = (min(mxs) + max(mxs)) / 2, (min(mys) + max(mys)) / 2
dx = round((ix0 + ix1) / 2 - cx)
dy = round((iy0 + iy1) / 2 - cy)
print(f"shifting mark by dx={dx} dy={dy}")

mark = {(x, y): px[x, y] for x, y in pts}

# erase: refill each mark pixel from the nearest clean face pixel on its row
out = im.copy(); op = out.load()
for x, y in pts:
    fill = None
    for step in range(1, gw):
        for cand in (x - step, x + step):
            if ix0 <= cand < ix1 and not mp[cand, y] and px[cand, y][3] > 128:
                fill = px[cand, y]; break
        if fill:
            break
    op[x, y] = fill or (34, 197, 94, 255)

# paste back on centre
for (x, y), col in mark.items():
    nx, ny = x + dx, y + dy
    if 0 <= nx < w and 0 <= ny < h:
        op[nx, ny] = col
out.save(dst)
print(f"wrote {dst}")
