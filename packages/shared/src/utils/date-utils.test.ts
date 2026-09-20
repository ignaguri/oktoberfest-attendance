import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  atZonedTime,
  formatRelativeTime,
  formatTimeInTimezone,
  zonedTimeOnDay,
} from "./date-utils";

// UTC+14 all year, so no test machine's own timezone can make these pass by accident.
const KIRITIMATI = "Pacific/Kiritimati";

describe("atZonedTime", () => {
  it("reads the day and time as a clock in the given timezone", () => {
    const day = new Date(2026, 8, 26);
    const time = new Date(2000, 0, 1, 16, 30);

    expect(atZonedTime(day, time, KIRITIMATI).toISOString()).toBe("2026-09-26T02:30:00.000Z");
  });
});

describe("zonedTimeOnDay", () => {
  it("puts the timezone's clock time on the given day", () => {
    const result = zonedTimeOnDay(
      new Date("2026-09-26T02:30:00Z"),
      new Date(2026, 8, 26),
      KIRITIMATI,
    );

    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 8, 26]);
    expect([result.getHours(), result.getMinutes()]).toEqual([16, 30]);
  });

  it("round-trips with atZonedTime", () => {
    const day = new Date(2026, 8, 26);
    const instant = new Date("2026-09-26T09:15:00Z");

    expect(atZonedTime(day, zonedTimeOnDay(instant, day, KIRITIMATI), KIRITIMATI)).toEqual(instant);
  });
});

describe("formatTimeInTimezone", () => {
  it("shows the time on the timezone's clock", () => {
    expect(formatTimeInTimezone(new Date("2026-09-26T02:30:00Z"), KIRITIMATI)).toBe("16:30");
  });
});

describe("formatRelativeTime", () => {
  // A second of slack either side of the boundary, so a slow test run cannot
  // drift the difference into the neighbouring unit.
  const secondsFromNow = (seconds: number) => new Date(Date.now() + seconds * 1000);

  it("picks the unit from the distance, not the signed difference", () => {
    expect(formatRelativeTime(secondsFromNow(7201), KIRITIMATI, "en")).toBe("in 2 hours");
  });

  it("still reads past dates as elapsed time", () => {
    expect(formatRelativeTime(secondsFromNow(-7201), KIRITIMATI, "en")).toBe("2 hours ago");
  });

  it("rounds a future distance towards zero, not away from it", () => {
    // Flooring the negative difference would call 91 seconds out "in 2 minutes".
    expect(formatRelativeTime(secondsFromNow(91), KIRITIMATI, "en")).toBe("in 1 minute");
  });

  describe("without Intl.RelativeTimeFormat (Hermes)", () => {
    beforeEach(() => {
      // Object.create rather than a spread: Intl's members are non-enumerable,
      // so spreading it yields {} and takes DateTimeFormat down with it.
      vi.stubGlobal("Intl", Object.create(Intl, { RelativeTimeFormat: { value: undefined } }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("phrases a future date as a wait rather than 'just now'", () => {
      expect(formatRelativeTime(secondsFromNow(7201), KIRITIMATI, "en")).toBe("in 2 hours");
    });

    it("keeps the past phrasing unchanged", () => {
      expect(formatRelativeTime(secondsFromNow(-7201), KIRITIMATI, "en")).toBe("2 hours ago");
    });

    // Server timestamps land a little ahead of the device clock all the time,
    // and this fallback dates freshly created rows on Android.
    it("reads a few seconds of clock skew as 'just now', not as a wait", () => {
      expect(formatRelativeTime(secondsFromNow(3), KIRITIMATI, "en")).toBe("just now");
    });

    it("still reports a genuine short wait", () => {
      expect(formatRelativeTime(secondsFromNow(31), KIRITIMATI, "en")).toBe("in 31s");
    });
  });
});
