import { describe, expect, it } from "vitest";

import { analyticsRangeSections } from "../analytics-range-options";

const PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

const FESTIVALS = [
  { id: "a", name: "Oktoberfest 2025", startDate: "2025-09-20" },
  { id: "b", name: "Frühlingsfest 2026", startDate: "2026-04-17" },
  { id: "c", name: "Oktoberfest 2026", startDate: "2026-09-19" },
];

describe("analyticsRangeSections", () => {
  it("lists every preset, then every festival newest first", () => {
    expect(analyticsRangeSections(PRESETS, FESTIVALS, "")).toEqual([
      { id: "presets", options: PRESETS },
      {
        id: "festivals",
        options: [
          { key: "festival:c", label: "Oktoberfest 2026" },
          { key: "festival:b", label: "Frühlingsfest 2026" },
          { key: "festival:a", label: "Oktoberfest 2025" },
        ],
      },
    ]);
  });

  it("filters by a case-insensitive substring and drops empty sections", () => {
    expect(analyticsRangeSections(PRESETS, FESTIVALS, "  OKTO ")).toEqual([
      {
        id: "festivals",
        options: [
          { key: "festival:c", label: "Oktoberfest 2026" },
          { key: "festival:a", label: "Oktoberfest 2025" },
        ],
      },
    ]);
  });

  it("matches presets too", () => {
    expect(analyticsRangeSections(PRESETS, FESTIVALS, "30")).toEqual([
      { id: "presets", options: [{ key: "30d", label: "Last 30 days" }] },
    ]);
  });

  it("ignores accents, so fruh finds Frühlingsfest", () => {
    expect(analyticsRangeSections(PRESETS, FESTIVALS, "fruh")).toEqual([
      { id: "festivals", options: [{ key: "festival:b", label: "Frühlingsfest 2026" }] },
    ]);
  });

  it("returns nothing when no option matches", () => {
    expect(analyticsRangeSections(PRESETS, FESTIVALS, "cannstatter")).toEqual([]);
  });

  it("has only presets while festivals are loading", () => {
    expect(analyticsRangeSections(PRESETS, [], "")).toEqual([{ id: "presets", options: PRESETS }]);
  });
});
