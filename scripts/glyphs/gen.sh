#!/usr/bin/env bash
# Generate achievement glyph art with Z-Image Turbo (MLX), then matte the background out.
#
#   ./gen.sh                    # every glyph, seed 42
#   ./gen.sh masskrug           # one glyph, seed 42
#   ./gen.sh masskrug 1 2 3 4   # one glyph, four seeds
#
# Raw renders land in $WORK/raw, alpha-cut versions in $WORK/cut. Existing files are skipped,
# so re-running only fills the gaps.
set -euo pipefail
cd "$(dirname "$0")"
# Renders and intermediates are large and machine-local, so they live in an
# ignored work dir rather than beside the scripts. Override with GLYPH_WORK.
WORK="${GLYPH_WORK:-work}"
mkdir -p "$WORK/raw" "$WORK/cut" "$WORK/review"
export PATH="$HOME/.local/bin:$PATH"
export HF_HUB_ENABLE_HF_TRANSFER=1

# Pre-quantized 4-bit weights (5.9 GB). The unquantized repo is 31 GB of bf16 that
# has to be quantized in RAM, which exhausted both disk and memory on a 36 GB M3 Pro.
MODEL="filipstrand/Z-Image-Turbo-mflux-4bit"

STYLE="bold flat vector icon illustration, thick clean confident dark brown outlines, strong contrast between the dark outline and the bright fill, no enclosing ring or circular frame around the subject, centered composition, simple graphic badge art, generous empty margin around the subject, plain solid white background, no text, no lettering, no words"

target="${1:-all}"
if [ $# -gt 0 ]; then
  shift
fi
seeds="${*:-42}"

while IFS=$'\t' read -r id category color subject; do
  if [ -z "$id" ]; then
    continue
  fi
  if [ "$target" != "all" ] && [ "$target" != "$id" ]; then
    continue
  fi
  for seed in $seeds; do
    raw="$WORK/raw/${id}-s${seed}.png"
    if [ -f "$raw" ]; then
      echo "skip $raw"
      continue
    fi
    echo "=== $id  seed $seed  ($category, $color) ==="
    mflux-generate-z-image-turbo \
      --model "$MODEL" --base-model z-image-turbo \
      --prompt "${subject}, duotone ${color} palette, ${STYLE}" \
      --width 1024 --height 1024 --steps 9 --vae-tiling \
      --seed "$seed" --metadata --output "$raw"
    cut="$WORK/cut/${id}-s${seed}.png"
    rembg i -m birefnet-general "$raw" "$cut"
    # Trim to the alpha bounding box and re-centre at 83% of the frame, matching the
    # vector set's "keep art clear of the outer 2px of 24" rule. Without this the
    # model's generous margin eats the badge's pixel budget.
    magick "$cut" -trim +repage -resize 852x852 \
      -background none -gravity center -extent 1024x1024 "$cut"
  done
done < prompts.tsv
