# Brag-video music

Original music beds for the `/brag` launch videos, generated locally with Google
Lyria RealTime. The audio is not committed: the beds live in the gitignored
`brags/<run>/composition/assets/music/`, and this folder is the formula to
regenerate or extend them.

## Setup

```sh
brew install ffmpeg uv
```

Lyria needs a Gemini API key from https://aistudio.google.com/apikey. Keep it in
`~/.config/gemini.env` as `GEMINI_API_KEY=...`; `gen.sh` reads it from there when
the variable is not already set. `uv` installs `google-genai` on first run.

## Workflow

```sh
./gen.sh                        # every bed, seed 1
./gen.sh crew-rivalry           # one bed
./gen.sh crew-rivalry 1 2 3 4   # one bed, four seeds to audition
```

Takes land in `work/` (gitignored): the raw 25s WAV in `work/raw/` and a
loudness-matched MP3 next to it. Existing files are skipped, so re-running only
fills gaps; use a new seed for a different take.

A seed is reproducible: the same row and seed stream back a byte-identical WAV.
The three beds that shipped on 2026-10-02 predate this script and were generated
without a seed, so they cannot be regenerated exactly. Their prompts are the rows
in `prompts.tsv`; the files themselves exist only in `brags/`.

## Prompts

`prompts.tsv` is `id <TAB> bpm <TAB> brightness <TAB> density <TAB> prompt`.
The id matches the brag run's suffix (`brags/2026-09-25-164442-<id>/`).
Brightness and density are 0 to 1. A negative prompt in `gen.sh` steers every bed
away from vocals and the corporate stock-library sound the beds replaced.

## Swapping a bed into a brag

1. Copy `work/<id>-s<seed>.mp3` into `brags/<run>/composition/assets/music/`.
2. Point `#music-bed`'s `src` in `composition/index.html` at it. Leave its
   `data-volume` and automation alone: the MP3 is normalized to -15 LUFS, the
   level of the stock beds the volumes were mixed against.
3. Re-render with the composition's pinned CLI (`npm run render`), keep the old
   cut as `brag-stock.mp4`, and listen to the result over the video before
   posting, not the bare track.
