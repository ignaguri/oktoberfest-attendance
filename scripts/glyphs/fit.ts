/*
  Trims a de-keyed glyph to its artwork, scales it down to fit an inner box, and
  centres it on a square canvas.

  The downscale happens here rather than in ImageMagick because `-alpha associate
  ... -resize ... -alpha disassociate` collapses the alpha channel to 0/255,
  throwing away the antialiasing the downscale is supposed to create. Averaging
  premultiplied values is the whole point: a transparent pixel's colour must not
  bleed into its opaque neighbours, or edges pick up a fringe of whatever was
  behind them.
*/

const ALPHA_FLOOR = 2; // ignore un-composite dust when measuring the bbox
const GHOST_PEAK = 80;

export type FitResult = {
  data: Buffer;
  /** Source bounding box that was trimmed to. */
  bbox: [w: number, h: number];
  /** Size the glyph was scaled to inside the canvas. */
  scaled: [w: number, h: number];
  ghosts: number;
};

/**
 * Takes raw RGBA at `width` x `height` and returns raw RGBA at `size` x `size`.
 */
export function fit(
  src: Buffer,
  width: number,
  height: number,
  size: number,
  inner: number,
): FitResult {
  const W = width;
  const H = height;

  // ---- alpha bbox ----
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (src[(y * W + x) * 4 + 3] <= ALPHA_FLOOR) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("image is fully transparent");
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  // ---- target box, preserving aspect ----
  const scale = inner / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * scale));
  const th = Math.max(1, Math.round(bh * scale));
  const ox = Math.round((size - tw) / 2);
  const oy = Math.round((size - th) / 2);

  const out = Buffer.alloc(size * size * 4, 0);
  for (let j = 0; j < th; j++) {
    // exact source span for this output row
    const sy0 = y0 + (j * bh) / th;
    const sy1 = y0 + ((j + 1) * bh) / th;
    for (let i = 0; i < tw; i++) {
      const sx0 = x0 + (i * bw) / tw;
      const sx1 = x0 + ((i + 1) * bw) / tw;
      let weight = 0;
      let aSum = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
        const fy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        if (fy <= 0) continue;
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
          const fx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          if (fx <= 0) continue;
          const w = fx * fy;
          const k = (sy * W + sx) * 4;
          const a = src[k + 3] / 255;
          weight += w;
          aSum += w * a;
          rSum += w * a * src[k]; // premultiplied
          gSum += w * a * src[k + 1];
          bSum += w * a * src[k + 2];
        }
      }
      if (weight === 0) continue;
      const a = aSum / weight;
      const k = ((oy + j) * size + (ox + i)) * 4;
      out[k + 3] = Math.round(Math.min(1, a) * 255);
      if (a > 0) {
        // un-premultiply back to straight alpha
        out[k] = Math.round(Math.min(255, rSum / weight / a));
        out[k + 1] = Math.round(Math.min(255, gSum / weight / a));
        out[k + 2] = Math.round(Math.min(255, bSum / weight / a));
      }
    }
  }

  // Averaging a mostly-transparent neighbourhood can leave a pixel at alpha 20-40
  // out in empty background. Invisible on white, grubby specks on dark. Every
  // genuine edge is attached to something solid, so drop what never gets there.
  let ghosts = 0;
  const seen = new Uint8Array(size * size);
  for (let s = 0; s < size * size; s++) {
    if (seen[s] || out[s * 4 + 3] === 0) continue;
    const stack = [s];
    seen[s] = 1;
    const members: number[] = [];
    let peak = 0;
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      if (out[i * 4 + 3] > peak) peak = out[i * 4 + 3];
      const x = i % size;
      const y = (i / size) | 0;
      const nb: number[] = [];
      if (x > 0) nb.push(i - 1);
      if (x < size - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - size);
      if (y < size - 1) nb.push(i + size);
      for (const q of nb) {
        if (!seen[q] && out[q * 4 + 3] !== 0) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (peak >= GHOST_PEAK) continue;
    for (const i of members) out[i * 4 + 3] = 0;
    ghosts += members.length;
  }

  return { data: out, bbox: [bw, bh], scaled: [tw, th], ghosts };
}
