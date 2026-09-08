import { describe, expect, it } from "vitest";

import { ALL_DEFINITIONS } from "./definitions";
import { getGlyphFallbackIcon, GLYPH_FALLBACK_ICONS, GLYPH_IDS } from "./glyphs";

describe("glyph registry", () => {
  it("GLYPH_IDS matches every distinct glyph used in definitions.ts", () => {
    const usedGlyphs = new Set(ALL_DEFINITIONS.map((def) => def.glyph));
    expect(new Set(GLYPH_IDS)).toEqual(usedGlyphs);
  });

  it("every glyph id has a fallback icon name", () => {
    for (const id of GLYPH_IDS) {
      expect(typeof GLYPH_FALLBACK_ICONS[id]).toBe("string");
      expect(GLYPH_FALLBACK_ICONS[id]).not.toBe("");
    }
  });

  it("GLYPH_FALLBACK_ICONS has no entries for unknown glyph ids", () => {
    expect(Object.keys(GLYPH_FALLBACK_ICONS).sort()).toEqual([...GLYPH_IDS].sort());
  });

  it("getGlyphFallbackIcon resolves a known id and returns undefined otherwise", () => {
    expect(getGlyphFallbackIcon("wiesn-crown")).toBe(GLYPH_FALLBACK_ICONS["wiesn-crown"]);
    // Ids arrive as plain strings off the wire, so a legacy or newer-build id
    // has to be answerable rather than a type error at the call site.
    expect(getGlyphFallbackIcon("retired-glyph")).toBeUndefined();
    expect(getGlyphFallbackIcon("")).toBeUndefined();
  });
});
