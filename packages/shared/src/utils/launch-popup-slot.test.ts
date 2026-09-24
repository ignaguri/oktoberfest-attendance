import { afterEach, describe, expect, it } from "vitest";

import {
  claimLaunchPopupSlot,
  isLaunchPopupSlotClaimed,
  releaseLaunchPopupSlot,
  resetLaunchPopupSlotForTests,
} from "./launch-popup-slot";

describe("launch popup slot", () => {
  afterEach(() => {
    resetLaunchPopupSlotForTests();
  });

  it("gives the slot to the first claimant only", () => {
    expect(claimLaunchPopupSlot("feedback")).toBe(true);
    expect(claimLaunchPopupSlot("store-update")).toBe(false);
    expect(isLaunchPopupSlotClaimed()).toBe(true);
  });

  it("lets the holder claim again", () => {
    claimLaunchPopupSlot("feedback");
    expect(claimLaunchPopupSlot("feedback")).toBe(true);
  });

  it("frees the slot only when the holder releases it", () => {
    claimLaunchPopupSlot("feedback");
    releaseLaunchPopupSlot("store-update");
    expect(isLaunchPopupSlotClaimed()).toBe(true);
    releaseLaunchPopupSlot("feedback");
    expect(isLaunchPopupSlotClaimed()).toBe(false);
    expect(claimLaunchPopupSlot("store-update")).toBe(true);
  });
});
