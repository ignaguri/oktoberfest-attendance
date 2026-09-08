#!/usr/bin/env bash
# Show a cut glyph at the sizes the badge actually renders it, composited on white.
# Badge diameters are 32/40/56/96 px (SIZE_PX) and the glyph gets GLYPH_SIZE_RATIO
# (0.68) of that, so the real ladder is 22/27/38/65 px.
#
# Each rung is downsampled to its true size, then point-upscaled 4x with no
# smoothing, so what you see is exactly the pixels the phone would show.
#
#   ./preview.sh work/cut/masskrug-s42.png
set -euo pipefail
cd "$(dirname "$0")"
# Renders and intermediates are large and machine-local, so they live in an
# ignored work dir rather than beside the scripts. Override with GLYPH_WORK.
WORK="${GLYPH_WORK:-work}"
mkdir -p "$WORK/raw" "$WORK/cut" "$WORK/review"
src="$1"
base="$(basename "$src" .png)"
out="$WORK/cut/${base}-sizes.png"
tmp="$(mktemp -d)"
for px in 22 27 38 65; do
  big=$((px * 4))
  magick "$src" -resize "${px}x${px}" \
    -background white -alpha remove -alpha off \
    -filter point -resize "${big}x${big}" \
    -bordercolor "#cccccc" -border 1 \
    -background white -gravity center -extent "$((big + 12))x272" "$tmp/$px.png"
done
magick "$tmp/22.png" "$tmp/27.png" "$tmp/38.png" "$tmp/65.png" +append \
  -background white -alpha remove -alpha off "$out"
rm -rf "$tmp"
echo "$out"
