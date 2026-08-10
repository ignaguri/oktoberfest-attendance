import { startOfDay } from "date-fns";
import { describe, expect, it } from "vitest";

import { buildFestivalWeeks, type FestivalDayCell } from "./festival-days";

/** Count cells that are not null across all weeks. */
function countDays(weeks: (FestivalDayCell | null)[][]): number {
  return weeks.flat().filter((cell): cell is FestivalDayCell => cell !== null).length;
}

describe("buildFestivalWeeks", () => {
  it("lays out Oktoberfest 2026 (Sat Sep 19 - Sun Oct 4) as 3 rows with 5 leading blanks", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 8, 19),
      endDate: new Date(2026, 9, 4),
      weekStartsOn: 1,
    });

    expect(weeks).toHaveLength(3);
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0][5]?.date.getDate()).toBe(19);
    expect(weeks[2][6]?.date.getDate()).toBe(4);
    expect(countDays(weeks)).toBe(16);
  });

  it("flags only the 1st of a month with isFirstOfMonth", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 8, 19),
      endDate: new Date(2026, 9, 4),
      weekStartsOn: 1,
    });

    const flagged = weeks
      .flat()
      .filter((cell): cell is FestivalDayCell => cell !== null && cell.isFirstOfMonth);

    expect(flagged).toHaveLength(1);
    expect(flagged[0].date.getMonth()).toBe(9); // October
    expect(flagged[0].date.getDate()).toBe(1);
  });

  it("lays out Fruehlingsfest 2026 (Fri Apr 17 - Sun May 10) as 4 rows with 4 leading blanks", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 3, 17),
      endDate: new Date(2026, 4, 10),
      weekStartsOn: 1,
    });

    expect(weeks).toHaveLength(4);
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[3][6]).not.toBeNull();
    expect(countDays(weeks)).toBe(24);

    // Spec §9 asks for this and the plan dropped it: a festival crossing into a
    // new month must flag the 1st, which is what puts the month label on the cell.
    const flagged = weeks.flat().filter((cell) => cell !== null && cell.isFirstOfMonth);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.date.getMonth()).toBe(4); // May
    expect(flagged[0]!.date.getDate()).toBe(1);
  });

  it("returns cells already normalized to the start of their day", () => {
    // eachDayOfInterval steps by adding a day, so in a timezone whose DST shift
    // lands at midnight the day after the shift comes back at 01:00 and a consumer
    // comparing against a startOfDay value would miss it.
    //
    // Asserted as idempotence rather than as literally 00:00:00, because on a
    // spring-forward-at-midnight day that hour does not exist - the start of that
    // day genuinely is 01:00. Run this file under TZ=America/Santiago to exercise
    // it; 2026-09-06 is such a day there.
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 8, 1),
      endDate: new Date(2026, 8, 30),
      weekStartsOn: 1,
    });

    for (const cell of weeks.flat()) {
      if (cell === null) {
        continue;
      }
      expect(cell.date.getTime()).toBe(startOfDay(cell.date).getTime());
    }
  });

  it("flags no cell for a single-month festival (Starkbierfest 2026)", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 2, 6),
      endDate: new Date(2026, 2, 29),
      weekStartsOn: 1,
    });

    const flagged = weeks.flat().filter((cell) => cell !== null && cell.isFirstOfMonth);
    expect(flagged).toHaveLength(0);
  });

  it("produces no leading blanks when the festival starts on the week start", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 8, 21), // Monday
      endDate: new Date(2026, 8, 27), // Sunday
      weekStartsOn: 1,
    });

    expect(weeks).toHaveLength(1);
    expect(weeks[0].every((cell) => cell !== null)).toBe(true);
  });

  it("pads a single-day festival to a full row", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 8, 19),
      endDate: new Date(2026, 8, 19),
      weekStartsOn: 1,
    });

    expect(weeks).toHaveLength(1);
    expect(countDays(weeks)).toBe(1);
    expect(weeks[0].filter((cell) => cell === null)).toHaveLength(6);
  });

  it("aligns differently for a Sunday week start", () => {
    const monday = buildFestivalWeeks({
      startDate: new Date(2026, 8, 19),
      endDate: new Date(2026, 9, 4),
      weekStartsOn: 1,
    });
    const sunday = buildFestivalWeeks({
      startDate: new Date(2026, 8, 19),
      endDate: new Date(2026, 9, 4),
      weekStartsOn: 0,
    });

    expect(monday[0].filter((cell) => cell === null)).toHaveLength(5);
    expect(sunday[0].filter((cell) => cell === null)).toHaveLength(6);
  });

  it("returns an empty array when the end date precedes the start date", () => {
    const weeks = buildFestivalWeeks({
      startDate: new Date(2026, 9, 4),
      endDate: new Date(2026, 8, 19),
      weekStartsOn: 1,
    });

    expect(weeks).toEqual([]);
  });
});
