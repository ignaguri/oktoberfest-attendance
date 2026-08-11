import { describe, expect, it } from "vitest";

import type { AttendanceWithTotals, Reservation } from "@prostcounter/shared/schemas";

import {
  buildActiveReservationsByDate,
  buildDayListEntries,
  formatEuros,
} from "../day-list-entries";

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

function reservation(
  id: string,
  startAt: string,
  status: Reservation["status"] = "confirmed",
): Reservation {
  return { id, startAt, status } as Reservation;
}

describe("buildActiveReservationsByDate", () => {
  it("keys active reservations by their local day", () => {
    const map = buildActiveReservationsByDate([
      reservation("r1", "2026-09-21T19:00:00Z"),
      reservation("r2", "2026-09-23T12:00:00Z", "pending"),
    ]);

    expect([...map.keys()].sort()).toEqual(["2026-09-21", "2026-09-23"]);
  });

  it("drops reservations that are not active", () => {
    const map = buildActiveReservationsByDate([
      reservation("cancelled", "2026-09-21T19:00:00Z", "cancelled"),
      reservation("expired", "2026-09-22T19:00:00Z", "expired"),
      reservation("checked-in", "2026-09-23T19:00:00Z", "checked_in"),
    ]);

    expect(map.size).toBe(0);
  });

  it("collapses two reservations on one day to a single entry", () => {
    // Both views render one marker per day, so there is nothing to show for a
    // second reservation.
    const map = buildActiveReservationsByDate([
      reservation("early", "2026-09-21T12:00:00Z"),
      reservation("late", "2026-09-21T19:00:00Z"),
    ]);

    expect(map.size).toBe(1);
    expect(map.get("2026-09-21")?.id).toBe("late");
  });
});

describe("buildDayListEntries", () => {
  it("orders every row by date, newest first, across both kinds", () => {
    const entries = buildDayListEntries(
      [attendance("2026-09-20"), attendance("2026-09-24")],
      buildActiveReservationsByDate([
        reservation("r1", "2026-09-22T19:00:00Z"),
        reservation("r2", "2026-09-26T19:00:00Z"),
      ]),
    );

    expect(entries.map((entry) => entry.date)).toEqual([
      "2026-09-26",
      "2026-09-24",
      "2026-09-22",
      "2026-09-20",
    ]);
  });

  it("does not add a reservation row to a day that already has an attendance", () => {
    // Two rows for one date would read as two separate outings.
    const entries = buildDayListEntries(
      [attendance("2026-09-21")],
      buildActiveReservationsByDate([reservation("r1", "2026-09-21T19:00:00Z")]),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("attendance");
  });

  it("keeps a reservation-only day", () => {
    const entries = buildDayListEntries(
      [],
      buildActiveReservationsByDate([reservation("r1", "2026-09-21T19:00:00Z")]),
    );

    expect(entries).toEqual([
      { kind: "reservationOnly", date: "2026-09-21", reservation: expect.objectContaining({ id: "r1" }) },
    ]);
  });

  it("gives every row a distinct date, so date is a usable React key", () => {
    const entries = buildDayListEntries(
      [attendance("2026-09-21"), attendance("2026-09-22")],
      buildActiveReservationsByDate([reservation("r1", "2026-09-22T19:00:00Z")]),
    );

    expect(new Set(entries.map((entry) => entry.date)).size).toBe(entries.length);
  });

  it("returns nothing when there is nothing to show", () => {
    expect(buildDayListEntries([], new Map())).toEqual([]);
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
