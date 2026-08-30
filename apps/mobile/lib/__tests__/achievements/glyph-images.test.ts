import fs from "node:fs";
import path from "node:path";

import { GLYPH_IDS } from "@prostcounter/shared/achievements";
import { describe, expect, it } from "vitest";

/**
 * The registry is asserted by reading its source rather than importing it.
 * Every entry is a require() of a PNG, which only Metro can resolve — under
 * vitest the module fails to load, so the contract we can meaningfully check
 * here is that the registry and the asset folder agree with GLYPH_IDS.
 */
const MOBILE_ROOT = path.resolve(__dirname, "../../..");
const REGISTRY_PATH = path.join(MOBILE_ROOT, "components/achievements/glyph-images.ts");
const GLYPHS_DIR = path.join(MOBILE_ROOT, "assets/achievements/glyphs");

const ENTRY_PATTERN =
  /"?([a-z-]+)"?:\s*require\("@\/assets\/achievements\/glyphs\/([a-z-]+)\.png"\)/g;

function registryEntries(): { key: string; file: string }[] {
  const source = fs.readFileSync(REGISTRY_PATH, "utf8");
  return [...source.matchAll(ENTRY_PATTERN)].map(([, key, file]) => ({ key, file }));
}

describe("glyph image registry", () => {
  it("registers every glyph id, in GLYPH_IDS order", () => {
    expect(registryEntries().map((entry) => entry.key)).toEqual([...GLYPH_IDS]);
  });

  it("points each entry at its own png", () => {
    for (const { key, file } of registryEntries()) {
      expect(file).toBe(key);
    }
  });

  it("ships an asset file for every registered glyph", () => {
    for (const { file } of registryEntries()) {
      expect(fs.existsSync(path.join(GLYPHS_DIR, `${file}.png`))).toBe(true);
    }
  });

  it("has no asset file that the registry does not reference", () => {
    const shipped = fs
      .readdirSync(GLYPHS_DIR)
      .filter((name) => name.endsWith(".png"))
      .map((name) => name.replace(/\.png$/, ""));
    expect(shipped.sort()).toEqual([...GLYPH_IDS].sort());
  });
});
