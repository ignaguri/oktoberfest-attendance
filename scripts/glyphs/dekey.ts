/*
  Strips the baked-in "fake transparency" checkerboard from a glyph render and
  recovers real alpha. See scripts/glyphs/README.md for why each pass exists.
*/

export type Rect = [x0: number, y0: number, x1: number, y1: number];

export type DekeyOptions = {
  /** Half-width of the tone key. Raise if background survives, lower if artwork is eaten. */
  tone?: number;
  /** Max r/g/b spread for a pixel to count as neutral. */
  spread?: number;
  /** Bounded nibble passes over the cell-boundary ramp. */
  nibblePasses?: number;
  /** Protect a rectangle, for artwork sitting on a checker tone. */
  keep?: Rect;
  /** ...except inside this inner rectangle. */
  keepout?: Rect;
  /** Clear flat neutral light pixels in these rectangles. */
  kill?: Rect[];
};

export type DekeyStats = {
  light: number;
  dark: number;
  period: number;
  keyedPct: number;
  nibbled: number;
  fringe: number;
  blobs: number;
  reclaimed: number;
  killed: number;
  ghosts: number;
  enclosedPct: number;
  residuePct: number;
};

const NIBBLE_SPREAD = 12;
const NIBBLE_FLOOR_BELOW_DARK = 8;
const FRINGE_RADIUS = 5;
const CRUMB = 8; // px: single-pixel un-composite noise
const SMALL_BLOB = 700; // px: watermark and streak fragments
const FLAT_BLOB = 25000; // px: whole in-between-tone cells, and merged pairs
const FLAT_SD = 9;
const FLAT_SPREAD = 20;
const GHOST_PEAK = 128;

/**
 * Takes raw RGBA at `width` x `height` and returns it with the checkerboard keyed
 * out. The input buffer is mutated.
 */
export function dekey(
  buf: Buffer,
  width: number,
  height: number,
  options: DekeyOptions = {},
): DekeyStats {
  const {
    tone: TONE = 6,
    spread: SPREAD = 7,
    nibblePasses = 3,
    keep = null,
    keepout = null,
    kill = [],
  } = options;

  const W = width;
  const H = height;
  const N = W * H;
  const orig = Buffer.from(buf); // fringe un-compositing reads pre-key values

  const level = (i: number) => (buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2]) / 3;
  const spread = (i: number) => {
    const r = buf[i * 4];
    const g = buf[i * 4 + 1];
    const b = buf[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const inRect = (rect: Rect | null, x: number, y: number) =>
    rect !== null && x >= rect[0] && y >= rect[1] && x <= rect[2] && y <= rect[3];
  const protectedPx = (x: number, y: number) => inRect(keep, x, y) && !inRect(keepout, x, y);

  const neighbours = (i: number) => {
    const x = i % W;
    const y = (i / W) | 0;
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < W - 1) out.push(i + 1);
    if (y > 0) out.push(i - W);
    if (y < H - 1) out.push(i + W);
    return out;
  };

  // ---- the two checker tones: dominant neutral level above and below 245 ----
  const hist = new Float64Array(256);
  for (let i = 0; i < N; i++) {
    if (spread(i) <= 6) hist[Math.round(level(i))]++;
  }
  const modeIn = (lo: number, hi: number) => {
    let best = -1;
    let bestCount = -1;
    for (let v = lo; v <= hi; v++) {
      if (hist[v] > bestCount) {
        bestCount = hist[v];
        best = v;
      }
    }
    return best;
  };
  const LIGHT = modeIn(245, 255);
  const DARK = modeIn(150, 244);

  // ---- key the two tones ----
  const alpha = new Uint8Array(N).fill(255);
  let keyed = 0;
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    if (protectedPx(x, y) || spread(i) > SPREAD) continue;
    const v = level(i);
    if (Math.abs(v - LIGHT) <= TONE || Math.abs(v - DARK) <= TONE) {
      alpha[i] = 0;
      keyed++;
    }
  }

  // ---- nibble the cell-boundary ramp ----
  // Neutral, no darker than the dark tone, touching something already transparent.
  // Bounded passes, so artwork can only ever lose a hair.
  let nibbled = 0;
  const nibbleFloor = DARK - NIBBLE_FLOOR_BELOW_DARK;
  for (let pass = 0; pass < nibblePasses; pass++) {
    const add: number[] = [];
    for (let i = 0; i < N; i++) {
      if (alpha[i] === 0) continue;
      const x = i % W;
      const y = (i / W) | 0;
      if (protectedPx(x, y)) continue;
      if (spread(i) > NIBBLE_SPREAD || level(i) < nibbleFloor) continue;
      if (neighbours(i).some((q) => alpha[q] === 0)) add.push(i);
    }
    for (const i of add) {
      if (alpha[i] !== 0) {
        alpha[i] = 0;
        nibbled++;
      }
    }
  }

  // ---- un-composite the artwork-edge fringe: O = a*C + (1-a)*K ----
  // K is the background tone found next to the pixel, C the artwork colour just
  // inside it, so the recovered pixel carries no trace of the checker. Doing this
  // rather than eroding is what keeps thin strokes at full width.
  const isFringe = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (alpha[i] === 0) continue;
    if (neighbours(i).some((q) => alpha[q] === 0)) isFringe[i] = 1;
  }
  const mid = (values: number[]) => {
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  };
  let fringe = 0;
  const patch: [index: number, r: number, g: number, b: number, a: number][] = [];
  for (let i = 0; i < N; i++) {
    if (!isFringe[i]) continue;
    fringe++;
    const cx = i % W;
    const cy = (i / W) | 0;
    const core: number[][] = [[], [], []];
    const back: number[] = [];
    for (let dy = -FRINGE_RADIUS; dy <= FRINGE_RADIUS; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = -FRINGE_RADIUS; dx <= FRINGE_RADIUS; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= W) continue;
        const q = y * W + x;
        if (alpha[q] === 0) {
          back.push((orig[q * 4] + orig[q * 4 + 1] + orig[q * 4 + 2]) / 3);
        } else if (!isFringe[q]) {
          for (let ch = 0; ch < 3; ch++) core[ch].push(orig[q * 4 + ch]);
        }
      }
    }
    if (core[0].length < 3 || back.length === 0) {
      patch.push([i, 0, 0, 0, 0]);
      continue;
    }
    const C = [mid(core[0]), mid(core[1]), mid(core[2])];
    const k = mid(back);
    const alphas: number[] = [];
    for (let ch = 0; ch < 3; ch++) {
      if (Math.abs(C[ch] - k) < 25) continue;
      alphas.push((orig[i * 4 + ch] - k) / (C[ch] - k));
    }
    const a = alphas.length ? Math.min(1, Math.max(0, mid(alphas))) : 1;
    patch.push([i, C[0], C[1], C[2], Math.round(a * 255)]);
  }
  for (const [i, r, g, b, a] of patch) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    alpha[i] = a;
  }

  // Protected pixels act as barriers to the cleanup passes below, so a `keep`
  // region neither gets swept away itself nor lends its immunity to leftovers that
  // happen to touch it.
  const guard = new Uint8Array(N);
  if (keep !== null) {
    for (let i = 0; i < N; i++) {
      if (protectedPx(i % W, (i / W) | 0)) guard[i] = 1;
    }
  }

  // ---- drop background left over as isolated blobs ----
  // The checkerboard is not strictly two-tone: the model painted occasional cells
  // and blotches at an in-between grey, and every render carries a 32px sparkle
  // watermark inset from the bottom-right corner. None of that is keyed by tone.
  // Measured across the set, every in-between cell has sd <= 9 and spread <= 10,
  // while every real component in that size range is either dark (chain-links'
  // chain, v=124) or strongly tinted (double-sun's rays, spread ~168).
  const LARGE_BLOB = Math.round(N * 0.06); // merged runs of cells, still rectangular
  let blobs = 0;
  {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (seen[s] || alpha[s] === 0 || guard[s]) continue;
      const stack = [s];
      seen[s] = 1;
      const members: number[] = [];
      let sumL = 0;
      let sumSq = 0;
      let sumSpread = 0;
      let x0 = W;
      let y0 = H;
      let x1 = -1;
      let y1 = -1;
      while (stack.length) {
        const i = stack.pop()!;
        members.push(i);
        const x = i % W;
        const y = (i / W) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        const v = level(i);
        sumL += v;
        sumSq += v * v;
        sumSpread += spread(i);
        for (const q of neighbours(i)) {
          if (!seen[q] && alpha[q] !== 0 && !guard[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
      const n = members.length;
      const meanL = sumL / n;
      const sd = Math.sqrt(Math.max(0, sumSq / n - meanL * meanL));
      const meanSpread = sumSpread / n;
      const fill = n / ((x1 - x0 + 1) * (y1 - y0 + 1));
      const lightEnough = meanL >= DARK - 15;
      const flatNeutral = meanSpread <= FLAT_SPREAD && sd <= FLAT_SD;
      const drop =
        n <= CRUMB ||
        (lightEnough && n <= SMALL_BLOB && meanSpread <= 45) ||
        (lightEnough && n <= FLAT_BLOB && flatNeutral) ||
        // Runs of same-tone cells merge into bigger strips. Past the cell-sized cap
        // they still have to be a solidly filled axis-aligned rectangle to qualify,
        // which no glyph shape is: the polaroid frame and the ferris wheel are
        // rings, the jug has a handle, and anything with detail on it fails
        // flatness first.
        (lightEnough && n <= LARGE_BLOB && flatNeutral && fill >= 0.9);
      if (!drop) continue;
      for (const i of members) alpha[i] = 0;
      blobs++;
    }
  }

  // ---- reclaim in-between cells that fused with the artwork ----
  // Cells the un-composited fringe glued onto the glyph are invisible to the pass
  // above: they are part of one huge, colourful component. Re-segment the opaque
  // area on "flat, neutral, no darker than the background" alone — which splits a
  // grey cell off the gold beside it, because the blend between them is neither
  // flat nor neutral — then judge each region on its own shape.
  const period = detectPeriod(buf, W, H);
  let reclaimed = 0;
  if (period > 0) {
    const TOL = Math.max(6, period * 0.08);
    const onGrid = (v: number) => {
      const m = ((v % period) + period) % period;
      return m <= TOL || m >= period - TOL;
    };
    const candidate = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (alpha[i] === 0 || guard[i]) continue;
      if (spread(i) <= 14 && level(i) >= DARK - 15) candidate[i] = 1;
    }
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (seen[s] || !candidate[s]) continue;
      const stack = [s];
      seen[s] = 1;
      const members: number[] = [];
      let sumL = 0;
      let sumSq = 0;
      while (stack.length) {
        const i = stack.pop()!;
        members.push(i);
        const v = level(i);
        sumL += v;
        sumSq += v * v;
        for (const q of neighbours(i)) {
          if (!seen[q] && candidate[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
      const n = members.length;
      if (n < 60 || n > N * 0.06) continue;
      const meanL = sumL / n;
      if (Math.sqrt(Math.max(0, sumSq / n - meanL * meanL)) > FLAT_SD) continue;
      // Wherever the region faces transparency, that edge used to abut another
      // cell, so it has to sit on a grid line. Where it faces the glyph instead it
      // can be any shape at all — that side was cut by the artwork. A cream card or
      // a foam cap fails this immediately: its exposed outline is its own.
      let onLine = 0;
      let offLine = 0;
      const tally = (coordinate: number) => {
        if (onGrid(coordinate)) {
          onLine++;
        } else {
          offLine++;
        }
      };
      for (const i of members) {
        const x = i % W;
        const y = (i / W) | 0;
        if (x > 0 && alpha[i - 1] === 0) {
          tally(x);
        }
        if (x < W - 1 && alpha[i + 1] === 0) {
          tally(x + 1);
        }
        if (y > 0 && alpha[i - W] === 0) {
          tally(y);
        }
        if (y < H - 1 && alpha[i + W] === 0) {
          tally(y + 1);
        }
      }
      const exposed = onLine + offLine;
      const boundaryOnGrid = exposed >= 80 && onLine / exposed >= 0.85;
      // Slivers of a single cell left where the glyph clipped it are too small to
      // have a meaningful boundary to test, but nothing in the artwork is a flat
      // neutral light patch smaller than one cell either — the foam caps, cream
      // cards and pale jugs all span several.
      const subCell = n < 0.6 * period * period;
      if (!boundaryOnGrid && !subCell) continue;
      for (const i of members) alpha[i] = 0;
      reclaimed++;
    }
  }

  // ---- explicit leftovers ----
  // A few in-between cells end up touching light artwork, which fuses them into a
  // region the tests above cannot judge. Those are listed per glyph in
  // overrides.ts rather than guessed at. Only flat neutral light pixels go, so
  // coloured artwork crossing the rectangle is untouched.
  let killed = 0;
  for (const [kx0, ky0, kx1, ky1] of kill) {
    for (let y = Math.max(0, ky0); y <= Math.min(H - 1, ky1); y++) {
      for (let x = Math.max(0, kx0); x <= Math.min(W - 1, kx1); x++) {
        const i = y * W + x;
        if (alpha[i] === 0 || guard[i]) continue;
        if (spread(i) > 16 || level(i) < DARK - 20) continue;
        alpha[i] = 0;
        killed++;
      }
    }
  }

  // ---- drop ghosts ----
  // Remnants that never reach real opacity: invisible on white, grubby specks on
  // dark, and they drag the trim bbox out. Genuine antialiasing is always attached
  // to something solid.
  let ghosts = 0;
  {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (seen[s] || alpha[s] === 0) continue;
      const stack = [s];
      seen[s] = 1;
      const members: number[] = [];
      let peak = 0;
      while (stack.length) {
        const i = stack.pop()!;
        members.push(i);
        if (alpha[i] > peak) peak = alpha[i];
        for (const q of neighbours(i)) {
          if (!seen[q] && alpha[q] !== 0) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
      if (peak >= GHOST_PEAK) continue;
      for (const i of members) alpha[i] = 0;
      ghosts += members.length;
    }
  }

  for (let i = 0; i < N; i++) buf[i * 4 + 3] = alpha[i];

  // ---- diagnostics ----
  // Opaque neutral pixels still sitting on a checker tone mean either missed
  // background or artwork that shares a tone. Either way, go and look at it.
  let residue = 0;
  for (let i = 0; i < N; i++) {
    if (alpha[i] < 250 || spread(i) > SPREAD) continue;
    const v = level(i);
    if (Math.abs(v - LIGHT) <= TONE || Math.abs(v - DARK) <= TONE) residue++;
  }
  // Transparent runs fully enclosed by opaque artwork: the cutouts we want (the
  // crown's pretzel, the shutter's blade seams), and where over-keying would show.
  const reached = new Uint8Array(N);
  const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && alpha[i] === 0 && !reached[i]) {
      reached[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    for (const q of neighbours(i)) {
      if (!reached[q] && alpha[q] === 0) {
        reached[q] = 1;
        stack.push(q);
      }
    }
  }
  let enclosed = 0;
  for (let i = 0; i < N; i++) {
    if (alpha[i] === 0 && !reached[i]) enclosed++;
  }

  return {
    light: LIGHT,
    dark: DARK,
    period: Number(period.toFixed(1)),
    keyedPct: Number(((keyed / N) * 100).toFixed(1)),
    nibbled,
    fringe,
    blobs,
    reclaimed,
    killed,
    ghosts,
    enclosedPct: Number(((enclosed / N) * 100).toFixed(3)),
    residuePct: Number(((residue / N) * 100).toFixed(3)),
  };
}

/**
 * The checker period, read off the transitions in whichever rows are pure
 * background. Cell widths jitter by a few px, so this is a median, then snapped to
 * an exact divisor of the width. Returns 0 when no clean row exists.
 */
function detectPeriod(buf: Buffer, W: number, H: number): number {
  const level = (i: number) => (buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2]) / 3;
  const spread = (i: number) => {
    const r = buf[i * 4];
    const g = buf[i * 4 + 1];
    const b = buf[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const gaps: number[] = [];
  for (let y = 2; y < H; y += 7) {
    let clean = true;
    for (let x = 0; x < W && clean; x += 3) {
      if (spread(y * W + x) > 8) clean = false;
    }
    if (!clean) continue;
    const cuts: number[] = [];
    for (let x = 1; x < W; x++) {
      if (Math.abs(level(y * W + x) - level(y * W + x - 1)) > 15) {
        if (!cuts.length || x - cuts[cuts.length - 1] > 4) cuts.push(x);
      }
    }
    for (let k = 1; k < cuts.length; k++) gaps.push(cuts[k] - cuts[k - 1]);
  }
  if (gaps.length < 8) return 0;
  gaps.sort((a, b) => a - b);
  const median = gaps[gaps.length >> 1];
  if (median < 16) return 0;
  return W / Math.round(W / median);
}
