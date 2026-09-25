import type { FestivalProgress } from "../schemas/profile.schema";

type ProgressLineKey =
  | "home.progress.streak"
  | "home.progress.bestStreak"
  | "home.progress.tents"
  | "home.progress.chase"
  | "home.progress.record";

export interface ProgressLine {
  id: "streak" | "bestStreak" | "tents" | "chase" | "record";
  key: ProgressLineKey;
  params: Record<string, string | number>;
}

/**
 * Lines of the personal progress card, shared by mobile and web so the
 * streak-vs-best and chase-vs-record rules agree. Never returns a 0 streak.
 */
export function getProgressLines(progress: FestivalProgress, totalBeers: number): ProgressLine[] {
  const lines: ProgressLine[] = [];

  if (progress.currentStreak > 0) {
    lines.push({
      id: "streak",
      key: "home.progress.streak",
      params: { count: progress.currentStreak },
    });
  } else if (progress.bestStreak > 0) {
    lines.push({
      id: "bestStreak",
      key: "home.progress.bestStreak",
      params: { count: progress.bestStreak },
    });
  }

  if (progress.tentsTotal > 0) {
    lines.push({
      id: "tents",
      key: "home.progress.tents",
      params: { visited: progress.tentsVisited, total: progress.tentsTotal },
    });
  }

  const previous = progress.previousFestival;
  if (previous && previous.beers > 0) {
    const params = { beers: totalBeers, target: previous.beers, festivalName: previous.name };
    if (totalBeers >= previous.beers) {
      lines.push({
        id: "record",
        key: "home.progress.record",
        params,
      });
    } else {
      lines.push({
        id: "chase",
        key: "home.progress.chase",
        params,
      });
    }
  }

  return lines;
}
