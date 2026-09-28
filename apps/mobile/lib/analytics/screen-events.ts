import { NOOP_TRACKER, type Tracker } from "@prostcounter/shared/analytics";

/**
 * screen_viewed is due on a new screen, or on the same screen under a new
 * tracker: after an account switch the next user's first screen still counts.
 */
export function isScreenViewDue(
  last: { tracker: Tracker; screen: string } | null,
  tracker: Tracker,
  screen: string,
): boolean {
  return last === null || last.tracker !== tracker || last.screen !== screen;
}

/**
 * A TrackOnScreen event is due while on screen, once per tracker per visit.
 * The no-op tracker never counts, so a screen already showing when the tracker
 * arrives still gets its event.
 */
export function isScreenEventDue(
  isOnScreen: boolean,
  tracker: Tracker,
  firedFor: Tracker | null,
): boolean {
  return isOnScreen && tracker !== NOOP_TRACKER && firedFor !== tracker;
}
