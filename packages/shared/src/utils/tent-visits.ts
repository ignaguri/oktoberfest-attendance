import type { TentVisit } from "../schemas/consumption.schema";

/**
 * The tent of the day's most recent visit, or undefined if there were none.
 *
 * "Which tent am I in" is the latest visit, and it cannot be read off tentIds:
 * that field is a set in first-visit order, so going A, then B, then back to A
 * leaves B at the end of it while A is where you are. Only the visits carry the
 * times that answer the question.
 *
 * Compares timestamps rather than trusting the array's order, because the
 * phone's local SQLite read returns rows in whatever order it likes. Visits
 * sharing a timestamp resolve to the last one given, which for a caller that
 * passes them in order is the later row.
 */
export function getCurrentTentId(visits: TentVisit[]): string | undefined {
  let latest: TentVisit | undefined;

  for (const visit of visits) {
    if (!latest || new Date(visit.visitDate).getTime() >= new Date(latest.visitDate).getTime()) {
      latest = visit;
    }
  }

  return latest?.tentId;
}
