import fs from "node:fs";
import path from "node:path";

import { PERSONA_CREST_FILES } from "@prostcounter/shared/wrapped";
import { describe, expect, it } from "vitest";

// Crests are optional (the SVG shield covers missing ones), but no orphan file.
describe("web crest assets", () => {
  it("only contains crests of known personas", () => {
    const crestDir = path.resolve(__dirname, "../../../public/wrapped/crests");
    const files = fs.existsSync(crestDir)
      ? fs.readdirSync(crestDir).filter((name) => name.endsWith(".png")).map((name) => name.slice(0, -4))
      : [];
    const known = new Set(Object.values(PERSONA_CREST_FILES));
    for (const file of files) {
      expect(known.has(file), file).toBe(true);
    }
  });
});
