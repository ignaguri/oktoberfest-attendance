#!/usr/bin/env bash
# Export the approved glyphs into both apps.
#
# Size: the largest render is the xl hero badge, 96pt diameter x GLYPH_SIZE_RATIO
# (0.68) = 65pt, so a 3x screen needs 196px. 256 gives headroom without paying
# for the 1024px masters (12.5 MB -> ~1.2 MB across 30 glyphs).
set -euo pipefail
cd "$(dirname "$0")"
# Renders and intermediates are large and machine-local, so they live in an
# ignored work dir rather than beside the scripts. Override with GLYPH_WORK.
WORK="${GLYPH_WORK:-work}"
mkdir -p "$WORK/raw" "$WORK/cut" "$WORK/review"
PX=256
MOBILE="../../apps/mobile/assets/achievements/glyphs"
WEB="../../apps/web/public/achievements/glyphs"
mkdir -p "$MOBILE" "$WEB"
# Seed 4 was the winner for most glyphs, but a few were re-rolled later and their
# approved art carries a different seed. chosen.tsv records those so a full
# re-export cannot silently revert them to the original seed's art.
chosen_seed() {
  local want="$1" id seed
  while IFS=$'\t' read -r id seed; do
    if [ "$id" = "$want" ]; then
      echo "$seed"; return
    fi
  done < chosen.tsv
  echo 4
}

n=0
while IFS=$'\t' read -r id _rest; do
  if [ -z "$id" ]; then
    continue
  fi
  src="$WORK/cut/${id}-s$(chosen_seed "$id").png"
  if [ ! -f "$src" ]; then
    echo "MISSING $src" >&2; exit 1
  fi
  magick "$src" -resize "${PX}x${PX}" -strip "$MOBILE/${id}.png"
  cp "$MOBILE/${id}.png" "$WEB/${id}.png"
  n=$((n + 1))
done < prompts.tsv
echo "exported $n glyphs at ${PX}px to both apps"
du -sh "$MOBILE" "$WEB"
