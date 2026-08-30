import type { EvaluationResult, PersistedUnlock } from "@prostcounter/shared/achievements";
import { evaluate } from "@prostcounter/shared/achievements";

import type { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";

export class AchievementService {
  constructor(private metricsRepo: AchievementMetricsRepository) {}

  /**
   * Evaluate the user's metrics and persist anything newly earned.
   * Returns only the newly unlocked achievements, for the caller to surface.
   *
   * A real festivalId evaluates both festival- and lifetime-scoped
   * achievements. Null evaluates lifetime only, and is correct exclusively for
   * callers with no festival context.
   */
  async evaluateAndUnlock(userId: string, festivalId: string | null): Promise<PersistedUnlock[]> {
    const [metrics, heldSlugs] = await Promise.all([
      this.metricsRepo.getMetrics(userId, festivalId),
      this.metricsRepo.getHeldSlugs(userId, festivalId),
    ]);

    const { unlocked } = evaluate(metrics, heldSlugs);

    if (unlocked.length === 0) {
      return [];
    }

    return this.metricsRepo.insertUnlocks(userId, festivalId, unlocked);
  }

  /** Read-only. Computes progress without persisting anything. */
  async getProgress(userId: string, festivalId: string): Promise<EvaluationResult> {
    const [metrics, heldSlugs] = await Promise.all([
      this.metricsRepo.getMetrics(userId, festivalId),
      this.metricsRepo.getHeldSlugs(userId, festivalId),
    ]);

    return evaluate(metrics, heldSlugs);
  }
}
