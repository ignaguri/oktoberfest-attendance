import { describe, expect, it } from "vitest";

import { deriveQuickSaveActions, type QuickSaveInput } from "../quick-save-actions";

const HOFBRAU = "tent-hofbrau";
const PAULANER = "tent-paulaner";

function actions(overrides: Partial<QuickSaveInput> = {}) {
  return deriveQuickSaveActions({
    selectedDrinkType: null,
    pendingPhotoCount: 0,
    selectedTentId: undefined,
    currentTentId: undefined,
    ...overrides,
  });
}

describe("deriveQuickSaveActions", () => {
  it("has nothing to save when nothing was picked", () => {
    expect(actions()).toEqual({
      hasChanges: false,
      shouldLogVisit: false,
      shouldLogConsumption: false,
      shouldTouchAttendance: false,
    });
  });

  it("treats a different tent as a move", () => {
    expect(actions({ selectedTentId: PAULANER, currentTentId: HOFBRAU })).toMatchObject({
      hasChanges: true,
      shouldLogVisit: true,
    });
  });

  /*
   * The bug this file exists for. A tent move must be appended as its own visit,
   * never sent as the attendance update's tent set: that field is the set the day
   * reconciles to, so it would have deleted every earlier visit for the day.
   */
  it("never asks the attendance update to carry the moved-to tent", () => {
    const result = actions({ selectedTentId: PAULANER, currentTentId: HOFBRAU });

    expect(result.shouldLogVisit).toBe(true);
    // The caller sends no `tents` at all when touching the row. The contract this
    // encodes is that a move is an append, and the touch is only about the row.
    expect(result.shouldTouchAttendance).toBe(true);
  });

  it("does not log a visit for the tent the user is already in", () => {
    // Re-selecting the current tent is a stray tap: two adjacent visits to one
    // tent would read as leaving and coming back.
    expect(actions({ selectedTentId: HOFBRAU, currentTentId: HOFBRAU })).toMatchObject({
      hasChanges: false,
      shouldLogVisit: false,
    });
  });

  it("still saves a drink logged in the tent the user is already in", () => {
    // The regression that started this: the day held several visits and logging
    // one beer without moving reconciled the day down to a single tent.
    const result = actions({
      selectedDrinkType: "beer",
      selectedTentId: HOFBRAU,
      currentTentId: HOFBRAU,
    });

    expect(result).toEqual({
      hasChanges: true,
      shouldLogVisit: false,
      shouldLogConsumption: true,
      shouldTouchAttendance: true,
    });
  });

  it("logs the first tent of the day as a visit", () => {
    expect(actions({ selectedTentId: HOFBRAU, currentTentId: undefined })).toMatchObject({
      shouldLogVisit: true,
    });
  });

  it("saves photos on their own, and needs a row to attach them to", () => {
    expect(actions({ pendingPhotoCount: 2 })).toEqual({
      hasChanges: true,
      shouldLogVisit: false,
      shouldLogConsumption: false,
      shouldTouchAttendance: true,
    });
  });

  it("does not touch the attendance row for a drink alone", () => {
    // Logging a consumption creates the day's row on its own path, so touching it
    // here would queue a redundant operation.
    expect(actions({ selectedDrinkType: "beer" })).toEqual({
      hasChanges: true,
      shouldLogVisit: false,
      shouldLogConsumption: true,
      shouldTouchAttendance: false,
    });
  });

  it("handles a drink plus a move plus photos together", () => {
    expect(
      actions({
        selectedDrinkType: "radler",
        pendingPhotoCount: 1,
        selectedTentId: PAULANER,
        currentTentId: HOFBRAU,
      }),
    ).toEqual({
      hasChanges: true,
      shouldLogVisit: true,
      shouldLogConsumption: true,
      shouldTouchAttendance: true,
    });
  });
});
