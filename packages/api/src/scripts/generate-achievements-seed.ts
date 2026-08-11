/**
 * Projects the TypeScript achievement definitions into a seed file.
 *
 * The registry sync (sync-achievement-registry.ts) does the same projection
 * against a live database. This one writes it to disk so `supabase db reset`
 * produces a working local database on its own, with no follow-up command.
 * Both read buildRegistryRows(), so the definitions stay the only source of
 * truth and the two cannot disagree.
 *
 * The output is generated. Do not hand-edit it; re-run this instead:
 *   pnpm --filter=@prostcounter/api seed:achievements
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { buildRegistryRows } from "./sync-achievement-registry";

const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../supabase/seeds/achievements.generated.sql",
);

/** Single-quoted SQL literal. Doubling the quote is the whole escape rule. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableString(value: string | null): string {
  return value === null ? "NULL" : sqlString(value);
}

export function buildSeedSql(): string {
  const rows = buildRegistryRows();

  const values = rows
    .map((row) =>
      [
        "  (",
        [
          sqlString(row.slug),
          sqlNullableString(row.series_id),
          String(row.tier),
          sqlString(row.scope),
          sqlString(row.category),
          String(row.points),
          sqlString(row.icon),
          sqlString(row.name),
          sqlString(row.description),
          row.is_active ? "true" : "false",
        ].join(", "),
        ")",
      ].join(""),
    )
    .join(",\n");

  return `-- GENERATED FILE. Do not edit.
-- Regenerate with: pnpm --filter=@prostcounter/api seed:achievements
--
-- The ${rows.length} achievement definitions, projected out of
-- packages/shared/src/achievements so that a fresh local database has the same
-- registry the app expects. This is the same projection the sync:achievements
-- script applies to a live database; both call buildRegistryRows().
--
-- Runs before seed.sql (see [db.seed] sql_paths in supabase/config.toml),
-- because seed.sql's QA block selects achievements by tier.
--
-- Rarity is deliberately absent: it is derived from tier, in TypeScript by
-- tierToRarity and in SQL by tier_to_rarity(int). Ids are left to the column
-- default, since nothing references an achievement by literal id.

INSERT INTO public.achievements
  (slug, series_id, tier, scope, category, points, icon, name, description, is_active)
VALUES
${values}
ON CONFLICT (slug) DO NOTHING;
`;
}

function main(): void {
  const sql = buildSeedSql();
  writeFileSync(OUTPUT_PATH, sql, "utf8");
  console.log(`Wrote ${buildRegistryRows().length} achievements to ${OUTPUT_PATH}`);
}

// Only run when executed directly, so the builder stays importable by tests.
if (process.argv[1]?.endsWith("generate-achievements-seed.ts")) {
  main();
}
