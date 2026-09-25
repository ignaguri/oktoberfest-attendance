import type { FestivalProgress } from "@prostcounter/shared/schemas";
import type { FestivalCountdownPhase } from "@prostcounter/shared/utils";

export interface SummaryProgressStats {
  streak: {
    value: number;
    labelKey: "attendance.summary.streak" | "attendance.summary.bestStreak";
  };
  tents: string;
  photos: number;
}

/**
 * Progress row of the Attendance summary. Solo users already get the
 * expanded card on Home while the festival is live, so they are skipped then.
 */
export function getSummaryProgressStats({
  progress,
  phase,
}: {
  progress: FestivalProgress;
  phase: FestivalCountdownPhase | undefined;
}): SummaryProgressStats | null {
  if (progress.isSolo && phase === "live") {
    return null;
  }

  return {
    streak:
      progress.currentStreak > 0
        ? { value: progress.currentStreak, labelKey: "attendance.summary.streak" }
        : { value: progress.bestStreak, labelKey: "attendance.summary.bestStreak" },
    tents:
      progress.tentsTotal > 0
        ? `${progress.tentsVisited}/${progress.tentsTotal}`
        : String(progress.tentsVisited),
    photos: progress.photosUploaded,
  };
}
