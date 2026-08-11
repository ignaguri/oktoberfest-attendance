import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

import { buildSeedSql } from "../generate-achievements-seed";

const generatedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../supabase/seeds/achievements.generated.sql",
);

describe("the committed achievements seed", () => {
  // The whole point of generating this file is that it cannot drift from the
  // definitions. Nothing enforces that at reset time, so it is enforced here:
  // change a definition without regenerating and this fails.
  it("matches what the definitions currently produce", () => {
    const committed = readFileSync(generatedPath, "utf8");

    expect(committed).toBe(buildSeedSql());
  });

  it("inserts no rarity, which is derived from tier", () => {
    const columnList = buildSeedSql()
      .split("\n")
      .find((line) => line.trim().startsWith("(slug,"));

    expect(columnList).toBeDefined();
    expect(columnList).not.toContain("rarity");
  });

  it("emits every definition", () => {
    const rows = buildSeedSql()
      .split("\n")
      .filter((line) => line.startsWith("  ('"));

    expect(rows).toHaveLength(90);
  });
});
