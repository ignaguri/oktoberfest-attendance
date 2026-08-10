import { describe, expect, it } from "vitest";

import type { TentVisit } from "../schemas/consumption.schema";

import { getCurrentTentId } from "./tent-visits";

const HOFBRAU = "11111111-1111-4111-a111-111111111111";
const PAULANER = "22222222-2222-4222-a222-222222222222";

function visit(tentId: string, visitDate: string): TentVisit {
  return { tentId, visitDate, tentName: null };
}

describe("getCurrentTentId", () => {
  it("returns the tent of the latest visit", () => {
    const visits = [
      visit(HOFBRAU, "2026-08-10T14:00:00Z"),
      visit(PAULANER, "2026-08-10T17:00:00Z"),
    ];

    expect(getCurrentTentId(visits)).toBe(PAULANER);
  });

  it("returns the revisited tent when the day ends where it started", () => {
    // The case tentIds cannot express: as a set in first-visit order it reads
    // [Hofbrau, Paulaner], so its last entry names the tent already left.
    const visits = [
      visit(HOFBRAU, "2026-08-10T14:00:00Z"),
      visit(PAULANER, "2026-08-10T17:00:00Z"),
      visit(HOFBRAU, "2026-08-10T20:00:00Z"),
    ];

    expect(getCurrentTentId(visits)).toBe(HOFBRAU);
  });

  it("ignores the array's order and reads the times", () => {
    const visits = [
      visit(PAULANER, "2026-08-10T17:00:00Z"),
      visit(HOFBRAU, "2026-08-10T20:00:00Z"),
      visit(HOFBRAU, "2026-08-10T14:00:00Z"),
    ];

    expect(getCurrentTentId(visits)).toBe(HOFBRAU);
  });

  it("resolves visits sharing a timestamp to the last one given", () => {
    const visits = [
      visit(HOFBRAU, "2026-08-10T20:00:00Z"),
      visit(PAULANER, "2026-08-10T20:00:00Z"),
    ];

    expect(getCurrentTentId(visits)).toBe(PAULANER);
  });

  it("returns undefined for a day with no visits", () => {
    expect(getCurrentTentId([])).toBeUndefined();
  });

  it("does not reorder the caller's array", () => {
    const visits = [
      visit(PAULANER, "2026-08-10T17:00:00Z"),
      visit(HOFBRAU, "2026-08-10T20:00:00Z"),
      visit(HOFBRAU, "2026-08-10T14:00:00Z"),
    ];

    getCurrentTentId(visits);

    expect(visits.map((v) => v.visitDate)).toEqual([
      "2026-08-10T17:00:00Z",
      "2026-08-10T20:00:00Z",
      "2026-08-10T14:00:00Z",
    ]);
  });
});
