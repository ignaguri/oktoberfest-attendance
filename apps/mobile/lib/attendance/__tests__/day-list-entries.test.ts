import { describe, expect, it } from "vitest";

import type { AttendanceWithTotals, DayPlan } from "@prostcounter/shared/schemas";

import { buildDayListEntries, formatEuros } from "../day-list-entries";
import { buildDayPlansByDate } from "../day-plans";

const TODAY = "2026-09-23";

function attendance(date: string, overrides: Partial<AttendanceWithTotals> = {}) {
  return {
    id: `a-${date}`,
    userId: "u1",
    festivalId: "f1",
    date,
    createdAt: `${date}T10:00:00Z`,
    updatedAt: `${date}T10:00:00Z`,
    drinkCount: 1,
    beerCount: 1,
    totalSpentCents: 1620,
    totalBaseCents: 1620,
    totalTipCents: 0,
    avgPriceCents: 1620,
    ...overrides,
  } as AttendanceWithTotals;
}

function plan(id: string, date: string): DayPlan {
  return { id, date, kind: "plan", status: null } as DayPlan;
}

function reservation(id: string, date: string, status: DayPlan["status"] = "confirmed"): DayPlan {
  return { id, date, kind: "reservation", status } as DayPlan;
}

describe("buildDayListEntries", () => {
  it("orders every row by date, newest first, across all kinds", () => {
    const entries = buildDayListEntries(
      [attendance("2026-09-20"), attendance("2026-09-24")],
      buildDayPlansByDate([reservation("r1", "2026-09-22"), plan("p1", "2026-09-26")]),
      TODAY,
    );

    expect(entries.map((entry) => entry.date)).toEqual([
      "2026-09-26",
      "2026-09-24",
      "2026-09-22",
      "2026-09-20",
    ]);
  });

  it("does not add a plan or reservation row to a day that already has an attendance", () => {
    // Two rows for one date would read as two separate outings.
    const entries = buildDayListEntries(
      [attendance("2026-09-21"), attendance("2026-09-25")],
      buildDayPlansByDate([reservation("r1", "2026-09-21"), plan("p1", "2026-09-25")]),
      TODAY,
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["attendance", "attendance"]);
  });

  it("keeps a reservation-only day, including one that has passed", () => {
    const entries = buildDayListEntries(
      [],
      buildDayPlansByDate([reservation("r1", "2026-09-21")]),
      TODAY,
    );

    expect(entries).toEqual([
      {
        kind: "reservationOnly",
        date: "2026-09-21",
        reservation: expect.objectContaining({ id: "r1" }),
      },
    ]);
  });

  it("keeps a plan-only day from today on", () => {
    const entries = buildDayListEntries(
      [],
      buildDayPlansByDate([plan("today", TODAY), plan("later", "2026-09-25")]),
      TODAY,
    );

    expect(entries).toEqual([
      { kind: "planOnly", date: "2026-09-25", plan: expect.objectContaining({ id: "later" }) },
      { kind: "planOnly", date: TODAY, plan: expect.objectContaining({ id: "today" }) },
    ]);
  });

  it("drops a plan on a day that has passed", () => {
    expect(buildDayListEntries([], buildDayPlansByDate([plan("p1", "2026-09-22")]), TODAY)).toEqual(
      [],
    );
  });

  it("gives every row a distinct date, so date is a usable React key", () => {
    const entries = buildDayListEntries(
      [attendance("2026-09-21"), attendance("2026-09-22")],
      buildDayPlansByDate([reservation("r1", "2026-09-22"), plan("p1", "2026-09-24")]),
      TODAY,
    );

    expect(new Set(entries.map((entry) => entry.date)).size).toBe(entries.length);
  });

  it("returns nothing when there is nothing to show", () => {
    expect(buildDayListEntries([], new Map(), TODAY)).toEqual([]);
  });
});

describe("formatEuros", () => {
  it("drops the decimals on a whole-euro amount", () => {
    expect(formatEuros(8100)).toBe("€81");
    expect(formatEuros(0)).toBe("€0");
  });

  it("keeps two decimals when the amount has cents", () => {
    // Rounding these would state an amount the user never paid, which matters
    // most on a row that only renders because the tip is non-zero.
    expect(formatEuros(1810)).toBe("€18.10");
    expect(formatEuros(20)).toBe("€0.20");
  });
});
