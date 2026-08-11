import type { TentVisit } from "@prostcounter/shared/schemas";
import { describe, expect, it } from "vitest";

import { buildTentVisitRows } from "../tent-visit-rows";

const TENT_A = "11111111-1111-1111-1111-111111111111";
const TENT_B = "22222222-2222-2222-2222-222222222222";
const TENT_C = "33333333-3333-3333-3333-333333333333";

const NAMES: Record<string, string> = {
  [TENT_A]: "Hofbräu",
  [TENT_B]: "Paulaner",
  [TENT_C]: "Augustiner",
};

function labelFor(tentId: string, fallback?: string | null): string {
  return NAMES[tentId] ?? fallback ?? "Unknown Tent";
}

/** Stand-in for date-fns "HH:mm" - the input timestamps are already UTC. */
function formatTime(visitDate: string): string {
  return visitDate.slice(11, 16);
}

function visit(tentId: string, visitDate: string, tentName: string | null = null): TentVisit {
  return { tentId, visitDate, tentName };
}

function build(selectedTents: string[], visits: TentVisit[]) {
  return buildTentVisitRows({ selectedTents, visits, labelFor, formatTime });
}

describe("buildTentVisitRows", () => {
  it("gives a tent visited twice a row per visit, in time order", () => {
    // The reason this module exists: A -> B -> A is three rows, not two.
    const rows = build(
      [TENT_A, TENT_B],
      [
        visit(TENT_A, "2026-09-23T20:00:00.000Z"),
        visit(TENT_A, "2026-09-23T14:00:00.000Z"),
        visit(TENT_B, "2026-09-23T17:00:00.000Z"),
      ],
    );

    expect(rows.map((row) => [row.label, row.checkInTime])).toEqual([
      ["Hofbräu", "14:00"],
      ["Paulaner", "17:00"],
      ["Hofbräu", "20:00"],
    ]);
  });

  it("keys the two rows of a repeated tent apart", () => {
    const rows = build(
      [TENT_A],
      [visit(TENT_A, "2026-09-23T14:00:00.000Z"), visit(TENT_A, "2026-09-23T20:00:00.000Z")],
    );

    // A key collision would make React drop the second badge.
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });

  it("puts selected tents with no visit yet after the visits, with no time", () => {
    const rows = build([TENT_A, TENT_C], [visit(TENT_A, "2026-09-23T14:00:00.000Z")]);

    expect(rows).toEqual([
      {
        key: `${TENT_A}-2026-09-23T14:00:00.000Z`,
        tentId: TENT_A,
        label: "Hofbräu",
        checkInTime: "14:00",
      },
      { key: `pending-${TENT_C}`, tentId: TENT_C, label: "Augustiner", checkInTime: null },
    ]);
  });

  it("hides every visit to a deselected tent", () => {
    // Saving would delete those visits, so the form should stop showing them
    // the moment the tent is unticked.
    const rows = build(
      [TENT_B],
      [
        visit(TENT_A, "2026-09-23T14:00:00.000Z"),
        visit(TENT_A, "2026-09-23T20:00:00.000Z"),
        visit(TENT_B, "2026-09-23T17:00:00.000Z"),
      ],
    );

    expect(rows.map((row) => row.tentId)).toEqual([TENT_B]);
  });

  it("does not reorder the caller's visits array", () => {
    const visits = [
      visit(TENT_A, "2026-09-23T20:00:00.000Z"),
      visit(TENT_A, "2026-09-23T14:00:00.000Z"),
    ];

    build([TENT_A], visits);

    expect(visits.map((v) => v.visitDate)).toEqual([
      "2026-09-23T20:00:00.000Z",
      "2026-09-23T14:00:00.000Z",
    ]);
  });

  it("falls back to the visit's own tent name when the tent list has no match", () => {
    // Tents load asynchronously, so a visit can render before its option exists.
    const unknownTent = "44444444-4444-4444-4444-444444444444";
    const rows = build(
      [unknownTent],
      [visit(unknownTent, "2026-09-23T14:00:00.000Z", "Schottenhamel")],
    );

    expect(rows[0].label).toBe("Schottenhamel");
  });

  it("returns nothing when no tent is selected", () => {
    expect(build([], [visit(TENT_A, "2026-09-23T14:00:00.000Z")])).toEqual([]);
  });
});
