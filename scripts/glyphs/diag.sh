#!/usr/bin/env bash
# Diagnose a glyph's whites and matting. Three panels:
#   1. on white  - what the badge actually shows (white art vanishes here)
#   2. on grey   - reveals which pixels are opaque white vs transparent
#   3. alpha     - the matte itself, white = kept, black = cut
set -euo pipefail
cd "$(dirname "$0")"
# Renders and intermediates are large and machine-local, so they live in an
# ignored work dir rather than beside the scripts. Override with GLYPH_WORK.
WORK="${GLYPH_WORK:-work}"
mkdir -p "$WORK/raw" "$WORK/cut" "$WORK/review"
FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
id="$1"
src="$WORK/cut/${id}-s4.png"
out="$WORK/review/diag-${id}.png"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
magick "$src" -resize 300x300 -background white   -alpha remove -alpha off -gravity center -extent 320x320 "$tmp/1.png"
magick "$src" -resize 300x300 -background "#7a7a7a" -alpha remove -alpha off -gravity center -extent 320x320 "$tmp/2.png"
magick "$src" -resize 300x300 -alpha extract -gravity center -extent 320x320 "$tmp/3.png"
for i in 1 2 3; do
  case $i in
    1) t="on white (what you see)";; 2) t="on grey (whites exposed)";; 3) t="alpha matte";;
  esac
  magick -background white -fill black -font "$FONT" -pointsize 16 -gravity center -size 320x26 label:"$t" "$tmp/l$i.png"
  magick "$tmp/$i.png" "$tmp/l$i.png" -append "$tmp/c$i.png"
done
magick "$tmp/c1.png" "$tmp/c2.png" "$tmp/c3.png" +append -background white -alpha remove -alpha off "$out"
echo "$out"
