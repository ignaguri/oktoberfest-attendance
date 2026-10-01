// @vitest-environment happy-dom
import { NOOP_TRACKER, type Tracker } from "@prostcounter/shared/analytics";
import {
  TrackerContextProvider,
  TrackOnMount,
  useTracker,
} from "@prostcounter/shared/analytics/react";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

function fakeTracker(): Tracker {
  return { ...NOOP_TRACKER, track: vi.fn() };
}

/** Fires on every tracker identity change, like TrackOnScreen does. */
function FiresPerTracker() {
  const tracker = useTracker();
  useEffect(() => {
    tracker.track("screen_viewed", { screen: "/" });
  }, [tracker]);
  return null;
}

describe("TrackerContextProvider before the tracker exists", () => {
  it("delivers a first-render event once the tracker is created", () => {
    // The apps create their tracker in an effect, after children's effects ran
    const { rerender } = render(
      <TrackerContextProvider tracker={null} awaitingTracker>
        <TrackOnMount name="app_opened" props={{ source: "cold" }} />
      </TrackerContextProvider>,
    );
    const tracker = fakeTracker();

    rerender(
      <TrackerContextProvider tracker={tracker} awaitingTracker>
        <TrackOnMount name="app_opened" props={{ source: "cold" }} />
      </TrackerContextProvider>,
    );

    expect(tracker.track).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith("app_opened", { source: "cold" });
  });

  it("does not hand consumers a new tracker identity, so nothing fires twice", () => {
    const { rerender } = render(
      <TrackerContextProvider tracker={null} awaitingTracker>
        <FiresPerTracker />
      </TrackerContextProvider>,
    );
    const tracker = fakeTracker();

    rerender(
      <TrackerContextProvider tracker={tracker} awaitingTracker>
        <FiresPerTracker />
      </TrackerContextProvider>,
    );

    expect(tracker.track).toHaveBeenCalledTimes(1);
  });

  it("drops what it buffered once signed out, even if sign-in is fast", () => {
    const { rerender } = render(
      <TrackerContextProvider tracker={null} awaitingTracker>
        <TrackOnMount name="screen_viewed" props={{ screen: "/sign-in" }} />
      </TrackerContextProvider>,
    );
    // Auth resolved: nobody is signed in
    rerender(
      <TrackerContextProvider tracker={null} awaitingTracker={false}>
        <TrackOnMount name="screen_viewed" props={{ screen: "/sign-in" }} />
      </TrackerContextProvider>,
    );
    const tracker = fakeTracker();

    rerender(
      <TrackerContextProvider tracker={tracker} awaitingTracker>
        <TrackOnMount name="screen_viewed" props={{ screen: "/sign-in" }} />
      </TrackerContextProvider>,
    );

    expect(tracker.track).not.toHaveBeenCalled();
  });
});
