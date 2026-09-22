import type { PersistedUnlock } from "@prostcounter/shared/achievements";
import { descriptionKeyFor, nameKeyFor } from "@prostcounter/shared/achievements";
import { translateEn } from "@prostcounter/shared/i18n/en";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";
import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "./achievement.service";
import { NotificationService } from "./notification.service";

/**
 * Push every unlock this write produced.
 *
 * Lives here because evaluateAfterWrite is the single chokepoint all unlocks
 * pass through — eleven call sites, all of which previously discarded the
 * result, which is why achievement-unlocked had not fired since a manual test.
 *
 * Never throws: an unlock that fails to notify is still an unlock.
 */
async function notifyUnlocks(
  supabase: SupabaseClient,
  userId: string,
  unlocked: PersistedUnlock[],
): Promise<void> {
  const novuApiKey = process.env.NOVU_API_KEY;
  if (!novuApiKey || unlocked.length === 0) {
    return;
  }

  try {
    const notificationService = new NotificationService(supabase, novuApiKey);

    for (const unlock of unlocked) {
      const achievementName = translateEn(nameKeyFor(unlock.slug)) ?? unlock.slug;
      const description = translateEn(descriptionKeyFor(unlock.slug));

      await notificationService.notifyAchievementUnlocked(userId, {
        achievementName,
        description,
        tier: unlock.tier,
        slug: unlock.slug,
      });
    }
  } catch (error) {
    logger.error({ error, userId }, "Failed to send achievement notifications");
  }
}

/**
 * Evaluates achievements after a write and returns anything newly unlocked.
 *
 * Never throws. A broken achievement engine must not stop someone logging a
 * drink, joining a group, or editing their profile — so a failure is logged and
 * swallowed, and the unlock is picked up by the next evaluation instead.
 *
 * `festivalId` must be the festival the write belongs to. A real id evaluates
 * both festival- and lifetime-scoped achievements; null evaluates lifetime only
 * and is correct exclusively for writes with no festival context (friend
 * accepts, profile edits, the activity middleware).
 *
 * `context` names the call site and appears in the failure log.
 */
export async function evaluateAfterWrite(
  supabase: SupabaseClient,
  userId: string,
  festivalId: string | null,
  context: string,
): Promise<PersistedUnlock[]> {
  try {
    const metricsRepo = new AchievementMetricsRepository(supabase);
    const achievementService = new AchievementService(metricsRepo);
    const unlocked = await achievementService.evaluateAndUnlock(userId, festivalId);

    await notifyUnlocks(supabase, userId, unlocked);

    return unlocked;
  } catch (error) {
    logger.error(
      {
        userId,
        festivalId,
        context,
        error: error instanceof Error ? error.message : String(error),
      },
      "Achievement evaluation failed after write",
    );
    return [];
  }
}
