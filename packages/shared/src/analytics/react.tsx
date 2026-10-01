/**
 * React glue for the usage tracker. Each app builds its own Tracker (it knows
 * its auth state, API client and lifecycle events) and hands it to
 * TrackerContextProvider; components only ever call useTrack().
 *
 * Signed out, or outside a provider, the tracker is a no-op, so call sites
 * never check auth. Until the first tracker exists, events wait in a short
 * pre-tracker buffer instead (see ./pre-tracker-buffer).
 */
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import type { EventName, EventProps, TrackedSheet } from "./events";
import { createPreTrackerBuffer } from "./pre-tracker-buffer";
import { sheetTransition } from "./sheet-transition";
import { NOOP_TRACKER, type Tracker } from "./tracker";

const TrackerContext = createContext<Tracker>(NOOP_TRACKER);

export function TrackerContextProvider({
  tracker,
  children,
}: {
  tracker: Tracker | null;
  children: ReactNode;
}) {
  const [preTrackerBuffer] = useState(() => createPreTrackerBuffer());

  useEffect(() => {
    if (tracker) {
      preTrackerBuffer.drainInto(tracker);
    }
  }, [tracker, preTrackerBuffer]);

  return (
    <TrackerContext.Provider value={tracker ?? preTrackerBuffer}>{children}</TrackerContext.Provider>
  );
}

export function useTracker(): Tracker {
  return useContext(TrackerContext);
}

export function useTrack(): Tracker["track"] {
  return useContext(TrackerContext).track;
}

/** Fires one event when mounted. For JSX branches where a hook cannot go. */
export function TrackOnMount<N extends EventName>({
  name,
  props,
}: {
  name: N;
  props: EventProps<N>;
}): null {
  const track = useTrack();
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    track(name, props);
    // Once per mount on purpose: props are static enums at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * sheet_opened when isOpen turns true; sheet_abandoned when it turns false (or
 * the component unmounts while open) without markSubmitted() being called in
 * between. Call markSubmitted() right after the sheet's submit succeeds.
 */
export function useSheetTracking(sheet: TrackedSheet, isOpen: boolean) {
  const track = useTrack();
  const wasOpenRef = useRef(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    const transition = sheetTransition(wasOpenRef.current, isOpen, submittedRef.current);
    if (transition === "opened") {
      submittedRef.current = false;
      track("sheet_opened", { sheet });
    } else if (transition === "abandoned") {
      track("sheet_abandoned", { sheet });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, sheet, track]);

  useEffect(() => {
    return () => {
      if (wasOpenRef.current && !submittedRef.current) {
        track("sheet_abandoned", { sheet });
      }
    };
  }, [sheet, track]);

  return {
    markSubmitted: () => {
      submittedRef.current = true;
    },
  };
}
