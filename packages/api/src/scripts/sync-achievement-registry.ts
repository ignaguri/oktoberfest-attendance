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

type AchievementRarity = "common" | "rare" | "epic" | "legendary";

interface RegistryRow {
  slug: string;
  series_id: string | null;
  tier: number;
  scope: AchievementScope;
  category: AchievementCategory;
  points: number;
  icon: string;
  rarity: AchievementRarity;
  name: string;
  description: string;
  is_active: boolean;
}

/**
 * The achievements table still carries the legacy `rarity` enum, and the
 * notification cron filters on it. Until Plan 2 replaces rarity with tier,
 * derive one from the other so new achievements keep notifying.
 */
const RARITY_BY_TIER: Record<number, AchievementRarity> = {
  1: "common",
  2: "rare",
  3: "epic",
  4: "legendary",
};

function rarityForTier(tier: number): AchievementRarity {
  const rarity = RARITY_BY_TIER[tier];
  if (!rarity) {
    throw new Error(`No rarity mapping for tier ${tier}`);
  }
  return rarity;
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
          rarity: rarityForTier(tierDef.tier),
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
        rarity: rarityForTier(definition.tier),
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
      console.log(`  ${row.slug.padEnd(28)} ${row.category.padEnd(12)} t${row.tier} ${row.points}pts`);
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
