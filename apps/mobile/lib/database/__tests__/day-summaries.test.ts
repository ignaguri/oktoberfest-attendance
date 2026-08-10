import { describe, expect, it, vi } from "vitest";

import {
  groupDrinkCounts,
  groupPhotoCounts,
  groupTentNames,
  queryDrinkCountsByDate,
  queryPhotoCountsByDate,
  queryTentNamesByDate,
} from "../day-summaries";

function createMockDb(rows: unknown[]) {
  return {
    getAllAsync: vi.fn().mockResolvedValue(rows),
  };
}

describe("groupTentNames", () => {
  it("groups multiple tents under one date", () => {
    const result = groupTentNames([
      { date: "2026-09-23", tent_name: "Hofbräu" },
      { date: "2026-09-23", tent_name: "Schottenhamel" },
      { date: "2026-09-26", tent_name: "Käfer Wiesn-Schänke" },
    ]);

    expect(result.get("2026-09-23")).toEqual(["Hofbräu", "Schottenhamel"]);
    expect(result.get("2026-09-26")).toEqual(["Käfer Wiesn-Schänke"]);
  });

  it("skips rows whose tent name is null", () => {
    const result = groupTentNames([
      { date: "2026-09-23", tent_name: null },
      { date: "2026-09-23", tent_name: "Hofbräu" },
    ]);

    expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
  });

  it("omits a date entirely when every tent name is null", () => {
    const result = groupTentNames([{ date: "2026-09-23", tent_name: null }]);

    expect(result.has("2026-09-23")).toBe(false);
  });

  it("deduplicates a tent name repeated for the same date", () => {
    const result = groupTentNames([
      { date: "2026-09-23", tent_name: "Hofbräu" },
      { date: "2026-09-23", tent_name: "Hofbräu" },
    ]);

    expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
  });
});

describe("groupDrinkCounts", () => {
  it("builds a per-type record for each date", () => {
    const result = groupDrinkCounts([
      { date: "2026-09-23", drink_type: "beer", count: 4 },
      { date: "2026-09-23", drink_type: "radler", count: 1 },
      { date: "2026-09-26", drink_type: "beer", count: 2 },
    ]);

    expect(result.get("2026-09-23")).toEqual({ beer: 4, radler: 1 });
    expect(result.get("2026-09-26")).toEqual({ beer: 2 });
  });

  it("treats an unrecognised drink type as beer", () => {
    const result = groupDrinkCounts([
      { date: "2026-09-23", drink_type: "not_a_drink", count: 3 },
    ]);

    expect(result.get("2026-09-23")).toEqual({ beer: 3 });
  });
});

describe("groupPhotoCounts", () => {
  it("maps each date to its count", () => {
    const result = groupPhotoCounts([
      { date: "2026-09-23", count: 2 },
      { date: "2026-09-26", count: 1 },
    ]);

    expect(result.get("2026-09-23")).toBe(2);
    expect(result.get("2026-09-26")).toBe(1);
  });
});

describe("query functions", () => {
  it("queryTentNamesByDate passes the festival id twice (once per UNION branch)", async () => {
    const db = createMockDb([{ date: "2026-09-23", tent_name: "Hofbräu" }]);

    const result = await queryTentNamesByDate(db, "festival-1");

    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    expect(db.getAllAsync.mock.calls[0][1]).toEqual(["festival-1", "festival-1"]);
    expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
  });

  it("queryDrinkCountsByDate passes the festival id once", async () => {
    const db = createMockDb([{ date: "2026-09-23", drink_type: "beer", count: 4 }]);

    const result = await queryDrinkCountsByDate(db, "festival-1");

    expect(db.getAllAsync.mock.calls[0][1]).toEqual(["festival-1"]);
    expect(result.get("2026-09-23")).toEqual({ beer: 4 });
  });

  it("queryPhotoCountsByDate passes the festival id once", async () => {
    const db = createMockDb([{ date: "2026-09-23", count: 2 }]);

    const result = await queryPhotoCountsByDate(db, "festival-1");

    expect(db.getAllAsync.mock.calls[0][1]).toEqual(["festival-1"]);
    expect(result.get("2026-09-23")).toBe(2);
  });
});
