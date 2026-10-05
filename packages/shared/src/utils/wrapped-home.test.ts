import { describe, expect, it } from "vitest";

import { getWrappedHomeState } from "./wrapped-home";

const oktoberfest = {
  id: "fest-okt-2026",
  startDate: "2026-09-19",
  endDate: "2026-10-04",
  timezone: "Europe/Berlin",
};

describe("getWrappedHomeState", () => {
  it("shows nothing before the last three days", () => {
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-01T10:00:00Z"), [])).toBeNull();
  });

  it("counts down 3, 2, 1 over the last three days", () => {
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-02T10:00:00Z"), [])).toEqual({
      kind: "countdown",
      daysUntilUnlock: 3,
    });
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-03T10:00:00Z"), [])).toEqual({
      kind: "countdown",
      daysUntilUnlock: 2,
    });
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-04T10:00:00Z"), [])).toEqual({
      kind: "countdown",
      daysUntilUnlock: 1,
    });
  });

  it("uses the festival's local day right after midnight", () => {
    // 00:30 on 4 Oct in Munich, still 3 Oct in UTC
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-03T22:30:00Z"), [])).toEqual({
      kind: "countdown",
      daysUntilUnlock: 1,
    });
  });

  it("is ready once unlocked and not yet viewed", () => {
    const list = [{ festivalId: "fest-okt-2026", viewed: false }];
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-05T10:00:00Z"), list)).toEqual({
      kind: "ready",
    });
  });

  it("offers a way back in once viewed", () => {
    const list = [{ festivalId: "fest-okt-2026", viewed: true }];
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-05T10:00:00Z"), list)).toEqual({
      kind: "viewed",
    });
  });

  it("shows nothing after the festival for someone without a Wrapped", () => {
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-05T10:00:00Z"), [])).toBeNull();
  });

  it("prefers ready over the countdown when unlocked early", () => {
    const list = [{ festivalId: "fest-okt-2026", viewed: false }];
    expect(getWrappedHomeState(oktoberfest, new Date("2026-10-03T10:00:00Z"), list)).toEqual({
      kind: "ready",
    });
  });
});
