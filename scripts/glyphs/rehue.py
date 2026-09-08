"""Shift one hue band to another, preserving shading and leaving outlines alone.

Used where the model draws the right SHAPE only in the wrong colour: recolouring
is reliable, re-prompting for the colour changed the shape.
"""
import colorsys, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
h_lo, h_hi, h_new = map(float, sys.argv[3:6])
# gold reads brighter than green at equal value, so allow a value/sat lift
v_mul = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
s_mul = float(sys.argv[7]) if len(sys.argv) > 7 else 1.05
im = Image.open(src).convert("RGBA")
px = im.load()
w, h = im.size
changed = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 8:
            continue
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        # only saturated pixels inside the band; dark outlines have low saturation/value
        if h_lo <= hh <= h_hi and ss > 0.25 and vv > 0.18:
            nr, ng, nb = colorsys.hsv_to_rgb(h_new, min(1.0, ss * s_mul), min(1.0, vv * v_mul))
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
            changed += 1
im.save(dst)
print(f"{dst}  ({changed} px rehued)")
