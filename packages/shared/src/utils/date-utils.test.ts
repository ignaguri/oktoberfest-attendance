import { describe, expect, it } from "vitest";

import { atZonedTime, formatTimeInTimezone, zonedTimeOnDay } from "./date-utils";

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
