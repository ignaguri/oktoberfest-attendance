/*
  Per-glyph corrections, keyed by glyph id.

  Most glyphs need none of this. Two need `keep` because their artwork sits on
  exactly one of their own checker tones, and keying that tone globally would erase
  it. The rest need `kill` because an in-between-tone cell ended up fused to pale
  artwork, which puts it beyond what the automatic tests can judge.

  All coordinates are in the source render's pixel space (2048x2048 for this set).
  To find a new one, build with `--masters <dir>` and inspect the 2048px output:
  leftovers show up as flat, neutral, suspiciously rectangular regions.
*/

import type { Rect } from "./dekey";

export type GlyphOverride = {
  keep?: Rect;
  keepout?: Rect;
  kill?: Rect[];
};

export const OVERRIDES: Record<string, GlyphOverride> = {
  // Grey text bars at exactly this render's dark tone (199). Protect the bars, but
  // punch out the circular portrait, which really is a cutout showing background.
  "id-card": {
    keep: [600, 540, 1420, 1240],
    keepout: [600, 540, 935, 880],
  },
  // Solid white bottom bar sits on the light tone (253); without this the bar is
  // hollowed out and only its cream outline survives.
  polaroid: {
    keep: [412, 1488, 1584, 1686],
    kill: [[300, 1692, 1700, 2047]],
  },

  "banner-pole": { kill: [[609, 1638, 719, 2047]] },
  "double-sun": {
    kill: [
      [973, 613, 1105, 716],
      [1123, 614, 1231, 790],
    ],
  },
  "flame-steady": { kill: [[409, 819, 614, 1128]] },
  "laurel-cup": { kill: [[1432, 0, 1536, 204]] },
  "podium-steps": { kill: [[409, 1224, 615, 1230]] },
  "signal-flag": { kill: [[408, 819, 564, 1126]] },
  "spark-heart": { kill: [[1228, 510, 1330, 641]] },
  "tent-ring": { kill: [[1123, 611, 1229, 819]] },
  "three-figures": {
    kill: [
      [256, 1023, 413, 1127],
      [1365, 1330, 1424, 1535],
    ],
  },
  "wiesn-crown": { kill: [[1330, 1432, 1433, 1487]] },
};
