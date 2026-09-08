#!/usr/bin/env bash
# Compare every seed of one glyph side by side: full size on top, the 22px badge
# rung (point-upscaled 4x, no smoothing) underneath. The bottom row is the one
# that decides whether art survives the list view.
#
#   ./sheet.sh masskrug
set -euo pipefail
cd "$(dirname "$0")"
# Renders and intermediates are large and machine-local, so they live in an
# ignored work dir rather than beside the scripts. Override with GLYPH_WORK.
WORK="${GLYPH_WORK:-work}"
mkdir -p "$WORK/raw" "$WORK/cut" "$WORK/review"
# ImageMagick has no fonts registered on this box; point it at a system one.
FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
id="$1"
out="$WORK/cut/${id}-sheet.png"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

shopt -s nullglob
files=("$WORK"/cut/${id}-s*.png)
variants=()
for f in "${files[@]}"; do
  case "$f" in
    *-sizes.png|*-sheet.png) continue ;;
  esac
  variants+=("$f")
done
if [ ${#variants[@]} -eq 0 ]; then
  echo "no $WORK/cut variants for $id" >&2
  exit 1
fi

for f in "${variants[@]}"; do
  seed="$(basename "$f" .png)"; seed="${seed##*-s}"
  magick "$f" -background white -alpha remove -alpha off -resize 200x200 \
    -gravity center -extent 210x210 "$tmp/top-$seed.png"
  magick "$f" -resize 22x22 -background white -alpha remove -alpha off \
    -filter point -resize 88x88 -bordercolor "#cccccc" -border 1 \
    -background white -gravity center -extent 210x110 "$tmp/bot-$seed.png"
  magick -background white -fill black -font "$FONT" -pointsize 18 -gravity center \
    -size 210x26 label:"seed $seed" "$tmp/lbl-$seed.png"
done

magick "$tmp"/top-*.png +append "$tmp/row-top.png"
magick "$tmp"/bot-*.png +append "$tmp/row-bot.png"
magick "$tmp"/lbl-*.png +append "$tmp/row-lbl.png"
magick "$tmp/row-top.png" "$tmp/row-bot.png" "$tmp/row-lbl.png" -append \
  -background white -alpha remove -alpha off "$out"
echo "$out"
