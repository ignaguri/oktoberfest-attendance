import type { FestivalProgress } from "../schemas/profile.schema";

type ProgressLineKey =
  | "home.progress.streak"
  | "home.progress.bestStreak"
  | "home.progress.tents"
  | "home.progress.chase"
  | "home.progress.record"
  | "home.progress.photos"
  | "home.progress.photosNudge";

export interface ProgressLine {
  id: "streak" | "bestStreak" | "tents" | "chase" | "record" | "photos" | "photosNudge";
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

  // No "0 photos": with none yet, the line asks for the first one instead
  if (progress.photosUploaded > 0) {
    lines.push({
      id: "photos",
      key: "home.progress.photos",
      params: { count: progress.photosUploaded },
    });
  } else {
    lines.push({ id: "photosNudge", key: "home.progress.photosNudge", params: {} });
  }

  return lines;
}

const HEADLINE_PRIORITY: ProgressLine["id"][] = [
  "streak",
  "record",
  "chase",
  "photosNudge",
  "tents",
  "bestStreak",
  "photos",
];

/** The one line the collapsed card leads with: the most motivating one available. */
export function getHeadlineLine(lines: ProgressLine[]): ProgressLine | undefined {
  for (const id of HEADLINE_PRIORITY) {
    const line = lines.find((candidate) => candidate.id === id);
    if (line) {
      return line;
    }
  }
  return undefined;
}
