import { describe, expect, it } from "vitest";

import { sheetTransition } from "./sheet-transition";

describe("sheetTransition", () => {
  it("reports an open", () => {
    expect(sheetTransition(false, true, false)).toBe("opened");
  });

  it("reports a close without submit as abandoned", () => {
    expect(sheetTransition(true, false, false)).toBe("abandoned");
  });

  it("stays quiet on a close after submit and on no change", () => {
    expect(sheetTransition(true, false, true)).toBeNull();
    expect(sheetTransition(true, true, false)).toBeNull();
    expect(sheetTransition(false, false, false)).toBeNull();
  });
});
