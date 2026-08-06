import { describe, expect, it } from "vitest";

import { GLYPH_IMAGES, getGlyphImage } from "@/components/achievements/glyph-images";

describe("getGlyphImage", () => {
  it("returns undefined for a glyph id with no registered image (registry starts empty)", () => {
    expect(getGlyphImage("masskrug")).toBeUndefined();
  });

  it("returns the registered source for a glyph id present in GLYPH_IMAGES", () => {
    const fakeSource = { uri: "fake" };
    (GLYPH_IMAGES as Record<string, unknown>).masskrug = fakeSource;
    expect(getGlyphImage("masskrug")).toBe(fakeSource);
    delete (GLYPH_IMAGES as Record<string, unknown>).masskrug;
  });
});
