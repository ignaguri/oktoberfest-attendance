/**
 * Projects the TypeScript achievement definitions into the achievements table.
 *
 * Definitions are the source of truth. This script makes the database match
 * them. It is idempotent: re-running changes nothing if definitions are unchanged.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter=@prostcounter/api sync:achievements
 *   add --dry-run to print the plan without writing
 */
import { ALL_DEFINITIONS, isSeries, slugFor } from "@prostcounter/shared/achievements";
import type { AchievementCategory, AchievementScope } from "@prostcounter/shared/achievements";
import type { Database } from "@prostcounter/db";
import { createClient } from "@supabase/supabase-js";

/**
 * Deliberately carries no `rarity`. That column is gone as of the migration
 * this comment ships with. Rarity is derived from `tier` in both languages now:
 * tierToRarity in TypeScript, tier_to_rarity(int) in SQL. The between-pull-requests
 * warning that used to live here is discharged, so syncing new definitions is
 * safe again.
 */
interface RegistryRow {
  slug: string;
  series_id: string | null;
  tier: number;
  scope: AchievementScope;
  category: AchievementCategory;
  points: number;
  icon: string;
  name: string;
  description: string;
  is_active: boolean;
}

export function buildRegistryRows(): RegistryRow[] {
  const rows: RegistryRow[] = [];

  for (const definition of ALL_DEFINITIONS) {
    if (isSeries(definition)) {
      for (const tierDef of definition.tiers) {
        const slug = slugFor(definition, tierDef.tier);
        rows.push({
          slug,
          series_id: definition.id,
          tier: tierDef.tier,
          scope: definition.scope,
          category: definition.category,
          points: tierDef.points,
          icon: definition.glyph,
          name: `achievements.${slug}.name`,
          description: `achievements.${slug}.description`,
          is_active: true,
        });
      }
    } else {
      const slug = slugFor(definition);
      rows.push({
        slug,
        series_id: null,
        tier: definition.tier,
        scope: definition.scope,
        category: definition.category,
        points: definition.points,
        icon: definition.glyph,
        name: `achievements.${slug}.name`,
        description: `achievements.${slug}.description`,
        is_active: true,
      });
    }
  }

  return rows;
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes("--dry-run");
  const rows = buildRegistryRows();

  console.log(`Built ${rows.length} registry rows from definitions.`);

  if (isDryRun) {
    for (const row of rows) {
      console.log(
        `  ${row.slug.padEnd(28)} ${row.category.padEnd(12)} t${row.tier} ${row.points}pts`,
      );
    }
    console.log("Dry run: nothing written.");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from("achievements").upsert(rows, { onConflict: "slug" });

  if (error) {
    throw new Error(`Failed to sync achievement registry: ${error.message}`);
  }

  console.log(`Synced ${rows.length} achievements.`);
}

// Only run when executed directly, so the builder stays importable by tests.
if (process.argv[1]?.endsWith("sync-achievement-registry.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
