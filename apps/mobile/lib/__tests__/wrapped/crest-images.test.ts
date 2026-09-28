import fs from "node:fs";
import path from "node:path";

import { PERSONA_CREST_FILES, PERSONA_IDS } from "@prostcounter/shared/wrapped";
import { describe, expect, it } from "vitest";

/**
 * Read from source like glyph-images.test.ts: the registry is require() calls
 * only Metro can resolve. Entries may be missing (crests fall back to an SVG
 * shield), but every entry must point at its own file, in PERSONA_IDS order,
 * and every PNG in the folder must be registered.
 */
const mobileRoot = path.resolve(__dirname, "../../..");
const registrySource = fs.readFileSync(
  path.join(mobileRoot, "components/wrapped/story/crest-images.ts"),
  "utf8",
);
const crestDir = path.join(mobileRoot, "assets/wrapped/crests");

const entries = [
  ...registrySource.matchAll(/"?([A-Za-z]+)"?:\s*require\("@\/assets\/wrapped\/crests\/([a-z-]+)\.png"\)/g),
].map((match) => ({ id: match[1], file: match[2] }));

describe("crest image registry", () => {
  it("only registers known personas, in PERSONA_IDS order", () => {
    const ids = entries.map((entry) => entry.id);
    expect(ids).toEqual(PERSONA_IDS.filter((id) => ids.includes(id)));
  });

  it("points every entry at its own existing file", () => {
    for (const entry of entries) {
      expect(entry.file).toBe(PERSONA_CREST_FILES[entry.id as keyof typeof PERSONA_CREST_FILES]);
      expect(fs.existsSync(path.join(crestDir, `${entry.file}.png`))).toBe(true);
    }
  });

  it("registers every crest PNG in the folder", () => {
    const files = fs.existsSync(crestDir)
      ? fs.readdirSync(crestDir).filter((name) => name.endsWith(".png")).map((name) => name.slice(0, -4))
      : [];
    expect(files.sort()).toEqual(entries.map((entry) => entry.file).sort());
  });
});
