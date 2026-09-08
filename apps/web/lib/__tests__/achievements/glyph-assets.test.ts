import fs from "node:fs";
import path from "node:path";

import { GLYPH_IDS } from "@prostcounter/shared/achievements";
import { describe, expect, it } from "vitest";

/**
 * `GlyphIcon` builds its src from the glyph id, so a missing or misnamed file
 * is a silent 404 rather than a type error. The web copy of the art lives in
 * its own folder and can drift from the mobile one, so assert it here too.
 */
const GLYPHS_DIR = path.resolve(__dirname, "../../../public/achievements/glyphs");

describe("web glyph assets", () => {
  it("ships a png for every glyph id, and none that is orphaned", () => {
    const shipped = fs
      .readdirSync(GLYPHS_DIR)
      .filter((name) => name.endsWith(".png"))
      .map((name) => name.replace(/\.png$/, ""));

    expect(shipped.sort()).toEqual([...GLYPH_IDS].sort());
  });
});
