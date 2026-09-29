#!/usr/bin/env bash
# Generate the Wrapped persona crests and export them into both apps.
#
#   ./crests.sh                 # every crest, seed 1
#   ./crests.sh nachteule       # one crest
#   ./crests.sh nachteule 1 2   # one crest, several seeds (export still takes seed 1)
#
# Same model as gen.sh, but not gen.sh's style: a crest is a framed shield, which
# gen.sh's "no enclosing ring" style forbids. Seed 1 is the approved look (it reads
# like a sewn-on fabric patch); other seeds draw a cleaner vector outline.
#
# Matting is a flood fill from the four corners, not rembg. The cream shield is too
# close to the white background and rembg cuts the fill out; the navy outline
# encloses the shield, so a corner fill stops at it.
set -euo pipefail
cd "$(dirname "$0")"
WORK="${GLYPH_WORK:-work}/crests"
mkdir -p "$WORK/raw" "$WORK/cut"
export PATH="$HOME/.local/bin:$PATH"
MODEL="filipstrand/Z-Image-Turbo-mflux-4bit"
PX=512
MOBILE="../../apps/mobile/assets/wrapped/crests"
WEB="../../apps/web/public/wrapped/crests"

target="${1:-all}"
if [ $# -gt 0 ]; then
  shift
fi
seeds="${*:-1}"

while IFS=$'\t' read -r id subject; do
  if [ -z "$id" ]; then
    continue
  fi
  if [ "$target" != "all" ] && [ "$target" != "$id" ]; then
    continue
  fi
  for seed in $seeds; do
    raw="$WORK/raw/${id}-s${seed}.png"
    cut="$WORK/cut/${id}-s${seed}.png"
    if [ ! -f "$raw" ]; then
      echo "=== $id  seed $seed ==="
      mflux-generate-z-image-turbo \
        --model "$MODEL" --base-model z-image-turbo \
        --prompt "a heraldic shield crest emblem in a flat paper-stamp print style, thick dark navy outline, cream fill, one warm amber accent, containing ${subject}, flat, centered composition, generous empty margin around the shield, plain solid white background" \
        --width 1024 --height 1024 --steps 9 --vae-tiling \
        --seed "$seed" --metadata --output "$raw" </dev/null
    fi
    magick "$raw" -alpha set -fuzz 6% -fill none \
      -draw "color 0,0 floodfill" -draw "color 1023,0 floodfill" \
      -draw "color 0,1023 floodfill" -draw "color 1023,1023 floodfill" \
      -trim +repage -resize 852x852 -background none -gravity center -extent 1024x1024 "$cut"
  done
done < crest-prompts.tsv

# 256-colour PNG8 is visually identical here and ~3.5x smaller (~70 KB a crest).
mkdir -p "$MOBILE" "$WEB"
while IFS=$'\t' read -r id _subject; do
  src="$WORK/cut/${id}-s1.png"
  if [ -f "$src" ]; then
    magick "$src" -resize "${PX}x${PX}" -strip -colors 256 "PNG8:$MOBILE/${id}.png"
    cp "$MOBILE/${id}.png" "$WEB/${id}.png"
  fi
done < crest-prompts.tsv
du -sh "$MOBILE" "$WEB"
