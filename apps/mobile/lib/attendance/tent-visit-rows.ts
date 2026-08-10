/**
 * Turning a day's tent visits into the rows the attendance form shows.
 *
 * A day is a sequence of visits, not a set of tents: the same tent can appear
 * twice with different times. The form's selector, on the other hand, holds a
 * set - so the display has to reconcile the two, and the rules for that are
 * easy to get subtly wrong (dropping a repeat, ordering by tent instead of by
 * time, keeping a deselected tent's visits on screen). They live here so they
 * can be tested without a renderer.
 */

import type { TentVisit } from "@prostcounter/shared/schemas";

export interface TentVisitRow {
  /** Unique per row: the same tent can appear more than once in a day. */
  key: string;
  tentId: string;
  label: string;
  /** null until the visit exists - a selected tent has no time yet. */
  checkInTime: string | null;
}

interface BuildTentVisitRowsInput {
  /** Tent ids currently ticked in the selector, in selection order. */
  selectedTents: readonly string[];
  /** Every visit recorded for the day. */
  visits: readonly TentVisit[];
  /** Resolves a tent id to its display name; the visit's own name is the fallback. */
  labelFor: (tentId: string, fallback?: string | null) => string;
  /** Formats a visit's ISO timestamp for display, e.g. "18:40". */
  formatTime: (visitDate: string) => string;
}

/**
 * Build one row per visit, then one per selected-but-unvisited tent.
 *
 * Visits come first in chronological order, so a tent visited twice earns two
 * rows with their own times. Only visits to currently-selected tents survive:
 * deselecting a tent hides its visits at once, which is what saving will do to
 * them.
 */
export function buildTentVisitRows({
  selectedTents,
  visits,
  labelFor,
  formatTime,
}: BuildTentVisitRowsInput): TentVisitRow[] {
  const selected = new Set(selectedTents);

  const visitRows: TentVisitRow[] = visits
    .filter((visit) => selected.has(visit.tentId))
    .slice()
    .sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime())
    .map((visit) => ({
      key: `${visit.tentId}-${visit.visitDate}`,
      tentId: visit.tentId,
      label: labelFor(visit.tentId, visit.tentName),
      checkInTime: formatTime(visit.visitDate),
    }));

  const visited = new Set(visitRows.map((row) => row.tentId));
  const pendingRows: TentVisitRow[] = selectedTents
    .filter((tentId) => !visited.has(tentId))
    .map((tentId) => ({
      key: `pending-${tentId}`,
      tentId,
      label: labelFor(tentId),
      checkInTime: null,
    }));

  return [...visitRows, ...pendingRows];
}
