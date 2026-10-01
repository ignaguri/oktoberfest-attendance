// @vitest-environment happy-dom
import { NOOP_TRACKER, type Tracker } from "@prostcounter/shared/analytics";
import { TrackerContextProvider, TrackOnMount } from "@prostcounter/shared/analytics/react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("TrackerContextProvider before the tracker exists", () => {
  it("delivers a first-render event once the tracker is created", () => {
    // The apps create their tracker in an effect, after children's effects ran
    const { rerender } = render(
      <TrackerContextProvider tracker={null}>
        <TrackOnMount name="app_opened" props={{ source: "cold" }} />
      </TrackerContextProvider>,
    );
    const tracker: Tracker = { ...NOOP_TRACKER, track: vi.fn() };

    rerender(
      <TrackerContextProvider tracker={tracker}>
        <TrackOnMount name="app_opened" props={{ source: "cold" }} />
      </TrackerContextProvider>,
    );

    expect(tracker.track).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith("app_opened", { source: "cold" });
  });
});
