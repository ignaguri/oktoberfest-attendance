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

  it("resolves a tie on a stable key, not on argument order", () => {
    // Two visits can genuinely share a timestamp, and for a caller reading rows
    // out of SQLite in arbitrary order "the last one given" is a coin toss that
    // can land differently on two devices. Same answer either way round.
    const visits = [
      visit(HOFBRAU, "2026-08-10T20:00:00Z"),
      visit(PAULANER, "2026-08-10T20:00:00Z"),
    ];

    expect(getCurrentTentId(visits)).toBe(PAULANER);
    expect(getCurrentTentId([...visits].reverse())).toBe(PAULANER);
  });

  it("ignores a visit whose date cannot be parsed", () => {
    const visits = [visit(HOFBRAU, "not a date"), visit(PAULANER, "2026-08-10T17:00:00Z")];

    expect(getCurrentTentId(visits)).toBe(PAULANER);
  });

  it("still answers when the unparseable visit comes first", () => {
    // NaN loses every comparison, so taking the bad row as the running best
    // pinned the result to it and returned a tent that is not the current one.
    const visits = [
      visit(HOFBRAU, ""),
      visit(PAULANER, "2026-08-10T17:00:00Z"),
      visit(HOFBRAU, "2026-08-10T20:00:00Z"),
    ];

    expect(getCurrentTentId(visits)).toBe(HOFBRAU);
  });

  it("returns undefined when no visit has a usable date", () => {
    expect(getCurrentTentId([visit(HOFBRAU, "nonsense")])).toBeUndefined();
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
