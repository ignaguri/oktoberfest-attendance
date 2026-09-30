/** Bar geometry for the admin analytics bar lists, kept pure so it can be tested. */

/** Share of the track a bar fills, clamped into 0..1. */
export function barFraction(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  return Math.min(value / max, 1);
}
