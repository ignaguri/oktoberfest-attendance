# Achievement glyph pipeline

Turns a raw glyph render into the 256px PNG the apps ship.

```bash
pnpm glyphs:build --src ~/path/to/renders                  # rebuild the whole set
pnpm glyphs:build --src ~/path/to/renders --only masskrug  # just one glyph
```

Output goes to `apps/web/public/achievements/glyphs/` and
`apps/mobile/assets/achievements/glyphs/` at 256x256. Requires ImageMagick 7
(`brew install imagemagick`).

| Flag                 | Default          | Purpose                                                        |
| -------------------- | ---------------- | -------------------------------------------------------------- |
| `--src <dir>`        | required         | Folder of raw renders, one `<glyph-id>.png` each               |
| `--only <id>`        | all              | Build a single glyph                                           |
| `--out <dir>`        | both app folders | Write elsewhere, for previewing before committing              |
| `--masters <dir>`    | off              | Also dump the full-size de-keyed PNG, for diagnosing leftovers |
| `--size` / `--inner` | 256 / 212        | Canvas size and the box the glyph is fitted into               |
| `--colors`           | 48               | Palette size before PNG encoding                               |

The raw renders are ~3MB each and are not tracked here. Keep them wherever you
generate them; the pipeline is the reproducible part.

## Adding a new glyph

1. Add the id to `GLYPH_IDS` in `packages/shared/src/achievements/glyphs.ts`.
2. Drop `<id>.png` into your renders folder and run
   `pnpm glyphs:build --src <dir> --only <id>`.
3. Add a line to `apps/mobile/components/achievements/glyph-images.ts`. React
   Native's bundler needs a **static** `require()` per asset, in `GLYPH_IDS`
   order. The web side needs nothing: it builds the path from the id.
4. Check the result on light, dark, and a garish background (magenta shows fringes
   that neither theme does). If anything looks off, read the next section.
5. `pnpm test --filter=@prostcounter/mobile` asserts the registry, the asset
   folder, and `GLYPH_IDS` all agree.

## What the pipeline is fighting

The renders arrive with a "transparent background" checkerboard **painted into the
image** as opaque pixels. Everything here exists to undo that, and most of it is
not obvious:

**The checkerboard is diffusion-generated, not a real grid.** Cell widths jitter by
a few pixels, so no single grid fits the image. Keying by cell parity, the obvious
approach, scores about 59% against the actual pixels, barely better than chance.
So the key works on tone alone: find the two dominant neutral tones (typically 254
and around 205, with about 3 levels of noise) and clear them. Because that needs no
connectivity, background trapped **inside** the artwork goes with the rest, which
is what a flood fill from the border misses. The crown's pretzel cutout and the
shutter's blade seams are holes, not white shapes.

**It is not strictly two-tone either.** The model painted occasional cells at an
in-between grey, and those survive the key as flat grey rectangles. Three passes
remove them, in increasing order of desperation: isolated blobs judged by size and
flatness; regions re-segmented out of the artwork they fused with, kept only if
their exposed boundary sits on the checker grid (a foam cap or a cream card fails
that instantly, since its outline is its own); and finally the explicit rectangles
in `overrides.ts`.

**Every render carries a watermark.** A 32px four-point sparkle, inset about 104px
from the bottom-right corner. It is caught by the blob pass.

**There is no drop shadow.** The soft grey halo you think you see around the glyphs
is moire from downscaling the checkerboard. Do not try to remove it.

**Two glyphs have artwork sitting on their own checker tone.** `id-card`'s grey text
bars are at exactly its dark tone, and `polaroid`'s solid white bottom bar is at its
light tone. Keying globally erases them, so both are protected by rectangles in
`overrides.ts`. A protected region acts as a barrier to the cleanup passes rather
than a veto, otherwise leftovers touching it would inherit its immunity.

**Edges are un-composited, not eroded.** Artwork edges carry a 1-2px blend with the
tone behind them. Eroding is simpler but visibly thins the ferris wheel's spokes, so
instead each fringe pixel is solved back out: `observed = a*artwork + (1-a)*background`,
where the background tone is read from the transparent pixels beside it.

**The downscale is done in JavaScript on purpose.** ImageMagick's
`-alpha associate ... -resize ... -alpha disassociate` collapses the alpha channel
to 0/255, throwing away the antialiasing the downscale is supposed to create. The
128px set that shipped before this pipeline had fully binary alpha for that reason.
`fit.ts` area-averages premultiplied values instead, which is also what stops
transparent pixels bleeding their colour into opaque neighbours.

**Output is PNG32, not PNG8.** ImageMagick's PNG8 writer only supports on/off
transparency by design, so a palette PNG would throw the antialiasing away again.
`-colors 48` gets most of the size benefit while keeping a real alpha channel:
about 10KB per glyph.

## When something looks wrong

Build with `--masters <dir>` and inspect the full-size output. Leftover background
shows up as flat, neutral, suspiciously rectangular regions, usually a whole cell
or a run of them. Compositing over magenta makes them obvious:

```bash
magick <master>.png -background '#ff00ff' -alpha remove -alpha off out.png
```

If a leftover is fused to pale artwork and the automatic passes cannot judge it, add
its bounding box to `kill` in `overrides.ts`. Only flat, neutral, light pixels
inside the rectangle are cleared, so coloured artwork crossing it is left alone.

The per-glyph log line reports the detected tones, cell size, and how much each pass
removed. `residue` in the stats means opaque pixels still sitting on a checker tone,
which is either missed background or artwork sharing a tone. Either way, go look.
