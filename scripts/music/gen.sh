#!/usr/bin/env bash
# Generate brag-video music beds with Google Lyria RealTime.
#
#   ./gen.sh                         # every bed, seed 1
#   ./gen.sh crew-rivalry            # one bed
#   ./gen.sh crew-rivalry 1 2 3      # one bed, several seeds
#
# Each take is streamed as a 25s WAV into work/raw/, then loudness-matched to
# -15 LUFS into work/<id>-s<seed>.mp3, the level the stock beds had, so a brag's
# existing music-bed volume and SFX balance still hold after a swap.
set -euo pipefail
cd "$(dirname "$0")"
WORK="${MUSIC_WORK:-work}"
mkdir -p "$WORK/raw"
DURATION=25
NEGATIVE="vocals, singing, corporate, ukulele, elevator music"

if [ -z "${GEMINI_API_KEY:-}" ] && [ -f "$HOME/.config/gemini.env" ]; then
  set -a
  source "$HOME/.config/gemini.env"
  set +a
fi

target="${1:-all}"
if [ $# -gt 0 ]; then
  shift
fi
seeds="${*:-1}"

while IFS=$'\t' read -r id bpm brightness density prompt; do
  if [ -z "$id" ]; then
    continue
  fi
  if [ "$target" != "all" ] && [ "$target" != "$id" ]; then
    continue
  fi
  for seed in $seeds; do
    raw="$WORK/raw/${id}-s${seed}.wav"
    out="$WORK/${id}-s${seed}.mp3"
    if [ ! -f "$raw" ]; then
      echo "=== $id  seed $seed ==="
      uv run --quiet lyria.py --output "$raw" --duration "$DURATION" --seed "$seed" \
        --bpm "$bpm" --brightness "$brightness" --density "$density" \
        --prompt "$prompt" --negative-prompt "$NEGATIVE" </dev/null
    fi
    if [ ! -f "$out" ]; then
      ffmpeg -hide_banner -loglevel error -i "$raw" \
        -af loudnorm=I=-15:TP=-1.5:LRA=11 -ar 48000 -c:a libmp3lame -b:a 256k "$out"
    fi
  done
done < prompts.tsv
ls -1 "$WORK"/*.mp3
