/**
 * Dotted-version comparison for the store update prompt.
 *
 * Lives here rather than beside the hook because the mobile vitest config only
 * collects tests under `lib/`, and this is the part worth testing directly.
 */

/**
 * Splits a dotted version into numeric segments, or returns null when any
 * segment is not a run of digits.
 *
 * Both inputs are remote data (the version endpoint, or a stored build string),
 * so an unparseable value must be rejected outright. Coercing with Number()
 * alone yields NaN, and every comparison against NaN is false, which lets the
 * loop fall through to the next segment and report a bogus "newer" result.
 *
 * Tested against the raw segment rather than the coerced number, because
 * Number() is too permissive to express this: Number("") is 0 and Number(" ")
 * is 0, so "" and "1..2" would both pass an isInteger check and parse to
 * something that looks like a valid version.
 */
function parseVersion(version: string): number[] | null {
  const segments = version.split(".");

  if (segments.some((segment) => !/^\d+$/.test(segment))) {
    return null;
  }

  return segments.map(Number);
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
