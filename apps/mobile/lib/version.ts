/**
 * Dotted-version comparison for the store update prompt.
 *
 * Lives here rather than beside the hook because the mobile vitest config only
 * collects tests under `lib/`, and this is the part worth testing directly.
 */

/**
 * Splits a dotted version into numeric segments, or returns null when any
 * segment is not a plain non-negative integer.
 *
 * Both inputs are remote data (the version endpoint, or a stored build string),
 * so an unparseable value must be rejected outright. Coercing with Number()
 * alone yields NaN, and every comparison against NaN is false, which lets the
 * loop fall through to the next segment and report a bogus "newer" result.
 */
function parseVersion(version: string): number[] | null {
  const segments = version.split(".").map((segment) => Number(segment));

  if (segments.some((segment) => !Number.isInteger(segment) || segment < 0)) {
    return null;
  }

  return segments;
}

/**
 * True when `other` is strictly newer than `current`.
 *
 * Missing trailing segments count as zero, so "1.6" and "1.6.0" are equal.
 * Unparseable input returns false: the caller uses this to decide whether to
 * interrupt someone, and a bad payload must not nag every user at once.
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
