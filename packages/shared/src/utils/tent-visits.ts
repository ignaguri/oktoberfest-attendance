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
 * phone's local SQLite read returns rows in whatever order it likes.
 *
 * Ties break on tentId, not on argument order. Two visits can genuinely share a
 * timestamp - the attendance form writes every tent of one save at the same
 * instant - and for a caller whose row order is arbitrary, "the last one given"
 * is not an answer, it is a coin toss that can land differently on web and
 * mobile, or on the same device after a re-sync. A stable key at least makes the
 * answer the same everywhere. The write paths stagger their timestamps so real
 * ties should not reach here.
 *
 * Visits whose visitDate does not parse are skipped rather than compared. NaN
 * loses every comparison, so one bad row taken as the running best would have
 * pinned the result to it and returned a tent that is not the current one.
 */
export function getCurrentTentId(visits: TentVisit[]): string | undefined {
  let latest: TentVisit | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const visit of visits) {
    const time = new Date(visit.visitDate).getTime();
    if (!Number.isFinite(time)) {
      continue;
    }

    const isLater = time > latestTime;
    const isTieOnALaterTent = time === latestTime && !!latest && visit.tentId > latest.tentId;

    if (!latest || isLater || isTieOnALaterTent) {
      latest = visit;
      latestTime = time;
    }
  }

  return latest?.tentId;
}
