/**
 * Geometry for the admin analytics charts, kept pure so it can be tested
 * without rendering SVG.
 */

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * SVG path data for a sparkline through `values`, scaled into width × height.
 * The lowest value sits on the bottom edge and the highest on the top edge; a
 * flat or single-value series is drawn along the vertical middle so it stays
 * visible.
 */
export function sparklinePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }
  const middle = roundCoordinate(height / 2);
  if (values.length === 1) {
    return `M0 ${middle} L${roundCoordinate(width)} ${middle}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = roundCoordinate(index * step);
      const y =
        max === min ? middle : roundCoordinate(height - ((value - min) / (max - min)) * height);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

/** Share of the track a bar fills, clamped into 0..1. */
export function barFraction(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  return Math.min(value / max, 1);
}
