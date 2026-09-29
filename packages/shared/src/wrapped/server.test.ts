import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function resolveModule(path: string): string | null {
  const candidate = [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`].find(
    existsSync,
  );
  return candidate ?? null;
}

/** Every module reachable from `entry` through relative, non-type imports. */
function moduleGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) {
    return seen;
  }
  seen.add(entry);
  const source = readFileSync(entry, "utf8");
  const imports = source.matchAll(
    /^(?:import|export)(?! type)[^;]*?from "([^"]+)"/gms,
  );
  for (const [, specifier] of imports) {
    if (specifier.startsWith(".")) {
      const file = resolveModule(resolve(dirname(entry), specifier));
      if (file) {
        moduleGraph(file, seen);
      }
    } else {
      seen.add(specifier);
    }
  }
  return seen;
}

describe("wrapped/server", () => {
  // The API runs inside a Next App Route, where a React hook import fails the build
  it("never pulls in React", () => {
    const graph = moduleGraph(resolve(here, "server.ts"));
    expect(graph.size).toBeGreaterThan(3);
    expect([...graph].filter((module) => module === "react")).toEqual([]);
  });
});
