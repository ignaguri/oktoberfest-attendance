"""Derive the loader's empty mug from the full masskrug glyph.

The loader reveals the full mug over the empty one, so the two must be pixel
aligned. Generating an empty mug would redraw the shape (see README), so it is
derived instead: drop the foam cloud above the rim, turn beer and in-glass foam
into pale glass, keep the dark outlines, and draw a rim across the body.

  python3 mug-empty.py full.png empty.png [rim_y]
"""
import colorsys, sys
from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
px = im.load()
w, h = im.size
# rim row in a 256px frame; scaled so a different export size keeps the cut
rim = round(int(sys.argv[3]) if len(sys.argv) > 3 else 86 * h / 256)
GLASS_HUE = 0.55
OUTLINE = (45, 22, 12, 255)

for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 8:
            continue
        if y < rim:
            px[x, y] = (0, 0, 0, 0)
            continue
        _, _, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        # dark outlines stay; everything lighter becomes glass, keeping its shading
        if v > 0.3:
            nr, ng, nb = colorsys.hsv_to_rgb(GLASS_HUE, 0.08, min(1.0, 0.55 + v * 0.42))
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)

# Outer edges of the body walls, measured on masskrug below the handle joint
# (above it the handle's top arm is fused to the wall, so no row there has a
# clean body span). Fixed because this script only ever takes masskrug.
x0, x1 = round(57 * w / 256), round(164 * w / 256)
rim_h = round(6 * h / 256)
ImageDraw.Draw(im).rounded_rectangle([x0, rim, x1, rim + rim_h], radius=rim_h // 2, fill=OUTLINE)
im.save(dst)
print(f"{dst}  rim y={rim} x={x0}..{x1}")
