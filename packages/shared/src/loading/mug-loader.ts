/**
 * The filling-mug loader, shared by both apps' Spinner.
 *
 * Two layers, `mug-empty.png` under `mug-full.png` (exported by
 * scripts/glyphs/loader.sh), with the full layer revealed below a wavy
 * surface. Each loop fills, holds full, then drains.
 *
 * The web implementation is CSS keyframes and cannot import these, so its
 * `mug-loader` keyframes in apps/web/styles restate them; keep both in step.
 */
export const MUG_LOADER = {
  /** Rendered size of the `large` spinner. Below ~32px the fill is illegible. */
  sizePx: 48,
  /** One fill, hold, drain loop. */
  durationMs: 2400,
  /** Fraction of the loop at which the mug is full, and at which it starts draining. */
  fullAt: 0.5,
  drainAt: 0.7,
  /** cubic-bezier control points for the fill and for the drain. */
  easing: [0.45, 0, 0.35, 1] as const,
  /**
   * Surface height as a fraction of the frame from the top. Empty sits just
   * under the glass bottom; full clears the top of the foam cloud.
   */
  emptySurface: 0.84,
  fullSurface: 0.04,
  /** Wave period as a fraction of the frame width, and its half-height as a fraction of the frame height. */
  wavePeriod: 0.6,
  waveAmplitude: 0.0375,
  /** Whole wave periods the surface drifts sideways per loop, so the loop is seamless. */
  waveDriftPeriods: 2,
} as const;
