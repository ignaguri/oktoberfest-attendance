/**
 * Grants achievements users have already earned under the new engine but
 * never received, because evaluation only started running on new writes
 * (Plan 1). Walks every (user, festival) pair the user has attended, plus one
 * lifetime pass per user — including users who have never attended anything,
 * since lifetime achievements like profile_complete are earnable without it.
 * See docs/plans/2026-08-06-achievements-plan-2-migration.md.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter=@prostcounter/api backfill:achievements
 *   add --dry-run to print the per-user delta without writing
 */
import type { Database } from "@prostcounter/db";
import { evaluate } from "@prostcounter/shared/achievements";
import { createClient } from "@supabase/supabase-js";

import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";

export interface BackfillPair {
  userId: string;
  festivalId: string | null;
}

/**
 * One pair per distinct (user, festival) the user attended, plus one
 * (user, null) lifetime pass for every known user — including users with no
 * attendance rows at all.
 */
export function enumerateBackfillPairs(
  attendanceRows: { user_id: string; festival_id: string }[],
  allUserIds: string[],
): BackfillPair[] {
  const seen = new Set<string>();
  const pairs: BackfillPair[] = [];

  for (const row of attendanceRows) {
    const key = `${row.user_id}:${row.festival_id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    pairs.push({ userId: row.user_id, festivalId: row.festival_id });
  }

  for (const userId of allUserIds) {
    pairs.push({ userId, festivalId: null });
  }

  return pairs;
}

export interface DeltaEntry {
  userId: string;
  festivalId: string | null;
  slugs: string[];
}

export interface DeltaSummary {
  totalUnlocks: number;
  perUser: Map<string, number>;
}

export function summariseDelta(entries: DeltaEntry[]): DeltaSummary {
  const perUser = new Map<string, number>();
  let totalUnlocks = 0;

  for (const entry of entries) {
    if (entry.slugs.length === 0) {
      continue;
    }
    totalUnlocks += entry.slugs.length;
    perUser.set(entry.userId, (perUser.get(entry.userId) ?? 0) + entry.slugs.length);
  }

  return { totalUnlocks, perUser };
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes("--dry-run");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);
  const metricsRepo = new AchievementMetricsRepository(supabase);

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendances")
    .select("user_id, festival_id");

  if (attendanceError) {
    throw new Error(`Failed to load attendances: ${attendanceError.message}`);
  }

  const { data: profileRows, error: profileError } = await supabase.from("profiles").select("id");

  if (profileError) {
    throw new Error(`Failed to load profiles: ${profileError.message}`);
  }

  const allUserIds = (profileRows ?? []).map((row) => row.id);
  // The generated Row type marks user_id nullable even though every real
  // attendance row has one; an orphaned row has nothing to backfill anyway.
  const validAttendanceRows = (attendanceRows ?? []).filter(
    (row): row is { user_id: string; festival_id: string } => row.user_id !== null,
  );
  const pairs = enumerateBackfillPairs(validAttendanceRows, allUserIds);

  console.log(`Evaluating ${pairs.length} (user, festival) pairs...`);

  // Sequential, not batched: a one-off admin script over a few hundred pairs
  // does not need concurrency, and sequential calls avoid exhausting the
  // Supabase connection pool.
  const deltaEntries: DeltaEntry[] = [];

  for (const pair of pairs) {
    const [metrics, heldSlugs] = await Promise.all([
      metricsRepo.getMetrics(pair.userId, pair.festivalId),
      metricsRepo.getHeldSlugs(pair.userId, pair.festivalId),
    ]);

    const { unlocked } = evaluate(metrics, heldSlugs);

    if (unlocked.length === 0) {
      continue;
    }

    deltaEntries.push({
      userId: pair.userId,
      festivalId: pair.festivalId,
      slugs: unlocked.map((unlock) => unlock.slug),
    });

    if (!isDryRun) {
      await metricsRepo.insertUnlocks(pair.userId, pair.festivalId, unlocked);
    }
  }

  for (const entry of deltaEntries) {
    console.log(
      `  ${entry.userId} ${entry.festivalId ?? "(lifetime)"}: +${entry.slugs.length} (${entry.slugs.join(", ")})`,
    );
  }

  const summary = summariseDelta(deltaEntries);
  console.log(`Total: ${summary.totalUnlocks} new unlocks across ${summary.perUser.size} users.`);

  if (isDryRun) {
    console.log("Dry run: nothing written.");
    return;
  }

  // Every unlock just inserted above created an unnotified outbox row via
  // trg_user_achievements_insert_event. Left alone, Plan 3 removing the
  // slug-based notification mute would fire a push storm at every user this
  // script touched. Stamp them all as notified now so that mute removal is
  // safe later.
  const stampedAt = new Date().toISOString();
  const { error: stampError, count: stampedCount } = await supabase
    .from("achievement_events")
    .update({ user_notified_at: stampedAt, group_notified_at: stampedAt }, { count: "exact" })
    .is("user_notified_at", null);

  if (stampError) {
    throw new Error(`Failed to stamp achievement events: ${stampError.message}`);
  }

  console.log(`Stamped ${stampedCount ?? 0} achievement events as notified.`);
}

// Only run when executed directly, so the builder stays importable by tests.
if (process.argv[1]?.endsWith("backfill-achievements.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
