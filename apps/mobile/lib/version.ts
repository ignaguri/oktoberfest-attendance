/** Dotted-version comparison for the store update prompt. */

/**
 * Splits a dotted version into numeric segments, or null if any segment isn't
 * a run of digits. Checked on the raw segment, not the coerced number --
 * Number("") is 0, so a naive isInteger check would accept "" and "1..2".
 */
function parseVersion(version: string): number[] | null {
  const segments = version.split(".");

  if (segments.some((segment) => !/^\d+$/.test(segment))) {
    return null;
  }

  return segments.map(Number);
}

/**
 * True when `other` is strictly newer than `current`. Missing trailing
 * segments count as zero ("1.6" == "1.6.0"). Unparseable input returns false
 * rather than nagging on a bad payload.
 */
export function isNewerVersion(current: string, other: string): boolean {
  const currentSegments = parseVersion(current);
  const otherSegments = parseVersion(other);

  if (!currentSegments || !otherSegments) {
    return false;
  }

  const length = Math.max(currentSegments.length, otherSegments.length);

  for (let index = 0; index < length; index++) {
    const currentSegment = currentSegments[index] ?? 0;
    const otherSegment = otherSegments[index] ?? 0;

    if (otherSegment > currentSegment) {
      return true;
    }
    if (otherSegment < currentSegment) {
      return false;
    }
  }

  return false;
}
