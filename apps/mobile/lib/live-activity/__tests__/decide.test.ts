import { describe, expect, it } from "vitest";

import { type DecideInput, decideLiveActivity } from "../decide";

const base: DecideInput = {
  supported: true,
  enabled: true,
  signedIn: true,
  festival: { id: "f1", startDate: "2026-09-19", endDate: "2026-10-04" },
  today: "2026-10-03",
  hasState: true,
  stale: false,
  running: null,
};

describe("decideLiveActivity", () => {
  it("starts on a festival day with something logged", () => {
    expect(decideLiveActivity(base)).toBe("start");
  });

  it("does nothing when the device or user said no", () => {
    expect(decideLiveActivity({ ...base, supported: false })).toBe("none");
    expect(decideLiveActivity({ ...base, enabled: false })).toBe("none");
  });

  it("does not start before anything is logged, outside the festival, or once stale", () => {
    expect(decideLiveActivity({ ...base, hasState: false })).toBe("none");
    expect(decideLiveActivity({ ...base, today: "2026-10-05" })).toBe("none");
    expect(decideLiveActivity({ ...base, stale: true })).toBe("none");
  });

  it("updates a running surface for the same festival day", () => {
    expect(decideLiveActivity({ ...base, running: { festivalId: "f1", date: "2026-10-03" } })).toBe(
      "update",
    );
  });

  it("restarts on a new day or festival", () => {
    expect(decideLiveActivity({ ...base, running: { festivalId: "f1", date: "2026-10-02" } })).toBe(
      "restart",
    );
    expect(decideLiveActivity({ ...base, running: { festivalId: "f2", date: "2026-10-03" } })).toBe(
      "restart",
    );
  });

  it("ends a running surface on sign-out, setting off, staleness, or the festival ending", () => {
    const running = { festivalId: "f1", date: "2026-10-03" };
    expect(decideLiveActivity({ ...base, running, signedIn: false })).toBe("end");
    expect(decideLiveActivity({ ...base, running, enabled: false })).toBe("end");
    expect(decideLiveActivity({ ...base, running, stale: true })).toBe("end");
    expect(decideLiveActivity({ ...base, running, today: "2026-10-05" })).toBe("end");
    expect(decideLiveActivity({ ...base, running, festival: null })).toBe("end");
  });
});
