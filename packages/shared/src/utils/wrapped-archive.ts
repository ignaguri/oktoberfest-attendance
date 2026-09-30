import type { WrappedFestival } from "../schemas/wrapped.schema";

export type WrappedArchiveTarget = { kind: "festival"; festivalId: string } | { kind: "archive" };

export interface WrappedArchiveSummary {
  count: number;
  newCount: number;
  target: WrappedArchiveTarget;
}

/**
 * The Profile "Your Wrapped" row: how many there are, how many are unviewed,
 * and where a tap goes (the only one directly, otherwise the archive list).
 */
export function getWrappedArchiveSummary(
  festivals: Pick<WrappedFestival, "festivalId" | "viewed">[] | null | undefined,
): WrappedArchiveSummary | null {
  if (!festivals || festivals.length === 0) {
    return null;
  }

  return {
    count: festivals.length,
    newCount: festivals.filter((festival) => !festival.viewed).length,
    target:
      festivals.length === 1
        ? { kind: "festival", festivalId: festivals[0].festivalId }
        : { kind: "archive" },
  };
}
