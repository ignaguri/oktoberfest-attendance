import { describe, expect, it } from "vitest";

import { fabBottomOffset, tabScreenBottomPadding } from "../tab-bar-layout";

describe("tab bar layout", () => {
  it("floats the FABs above the tab bar and the home indicator", () => {
    expect(fabBottomOffset({ tabBarHeight: 50, insetBottom: 34 })).toBe(50 + 24 + 34);
    expect(fabBottomOffset({ tabBarHeight: 100, insetBottom: 0 })).toBe(100 + 40);
  });

  it("pads a tab screen so its last row clears the FABs", () => {
    const layout = { tabBarHeight: 100, insetBottom: 0 };
    expect(tabScreenBottomPadding(layout)).toBeGreaterThan(fabBottomOffset(layout) + 56);
  });
});
