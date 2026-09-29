import type { EventName, EventProps, Tracker } from "@prostcounter/shared/analytics";
import { useTracker } from "@prostcounter/shared/analytics/react";
import { useEffect, useRef } from "react";

import { isScreenEventDue } from "./screen-events";
import { useCurrentScreen } from "./TrackerProvider";

/**
 * Fires one event each time the app arrives on one of `screens` (route
 * templates, as in screen_viewed) while this component is mounted.
 *
 * Use it instead of TrackOnMount inside tab screens: the native tabs mount
 * every tab at launch and report them all as focused, so neither mount nor
 * focus means the user actually saw the tab. The current screen comes from
 * TrackerProvider, which reads the route at the root.
 */
export function TrackOnScreen<N extends EventName>({
  screens,
  name,
  props,
}: {
  screens: readonly string[];
  name: N;
  props: EventProps<N>;
}): null {
  const tracker = useTracker();
  const currentScreen = useCurrentScreen();
  const isOnScreen = currentScreen !== null && screens.includes(currentScreen);
  // The tracker that already got this visit's event; cleared on leaving.
  const firedForRef = useRef<Tracker | null>(null);

  useEffect(() => {
    if (!isOnScreen) {
      firedForRef.current = null;
      return;
    }
    if (isScreenEventDue(isOnScreen, tracker, firedForRef.current)) {
      firedForRef.current = tracker;
      tracker.track(name, props);
    }
    // props are static enums at every call site; an inline object would
    // otherwise re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnScreen, tracker, name]);

  return null;
}
