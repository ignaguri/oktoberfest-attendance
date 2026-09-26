/** How close to the end of a scroll view the next feed page starts loading. */
export const LOAD_MORE_THRESHOLD_PX = 600;

interface ScrollMetrics {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
}

/**
 * Whether a scroll view is within `threshold` px of its end, from the
 * `nativeEvent` of an `onScroll` event. Early enough that the next page is
 * usually in before the user reaches the bottom.
 */
export function isNearBottom(
  { contentOffset, contentSize, layoutMeasurement }: ScrollMetrics,
  threshold = LOAD_MORE_THRESHOLD_PX,
): boolean {
  const distanceFromEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height);
  return distanceFromEnd <= threshold;
}
