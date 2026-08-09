import type { PersistedUnlock } from "@prostcounter/shared/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";
import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "./achievement.service";

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
    return await achievementService.evaluateAndUnlock(userId, festivalId);
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
