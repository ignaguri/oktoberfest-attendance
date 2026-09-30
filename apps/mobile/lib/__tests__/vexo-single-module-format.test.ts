import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// vexo-analytics ships separate `import` (lib/module) and `require` (lib/commonjs)
// builds. Loading it both ways bundles and evaluates both, and each copy registers
// the VexoMask native view, so the second throws "Tried to register two views with
// the same name VexoMask" and release builds crash on launch (1.10.0 build 96/44).
// Only ever `import` it.

const mobileRoot = join(__dirname, "..", "..");
const sourceDirs = ["app", "components", "hooks", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (entry === "node_modules" || entry === "__tests__") {
      return [];
    }
    if (statSync(fullPath).isDirectory()) {
      return sourceFiles(fullPath);
    }
    return /\.(ts|tsx|js|jsx)$/.test(entry) ? [fullPath] : [];
  });
}

describe("vexo-analytics module format", () => {
  it("is never loaded with require()", () => {
    const offenders = sourceDirs
      .flatMap((dir) => sourceFiles(join(mobileRoot, dir)))
      .filter((file) => /require\(\s*["']vexo-analytics/.test(readFileSync(file, "utf8")))
      .map((file) => relative(mobileRoot, file));

    expect(offenders).toEqual([]);
  });
});
