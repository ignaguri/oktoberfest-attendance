/**
 * What a quick-attendance save should actually do.
 *
 * Extracted from the sheet because this is where both of the branch's data-loss
 * bugs lived, and because the mobile vitest config only collects
 * `lib/**​/__tests__` - logic left in a .tsx file cannot be tested at all. The
 * combinations here are small enough to enumerate and each one has a way of going
 * quietly wrong, so they are worth a table test rather than a device pass.
 */

export interface QuickSaveInput {
  /** The drink the user picked, or null if they picked none. */
  selectedDrinkType: string | null;
  pendingPhotoCount: number;
  /** The tent shown in the picker. */
  selectedTentId: string | undefined;
  /** The tent the day's latest visit is in, if any. */
  currentTentId: string | undefined;
}

export interface QuickSaveActions {
  /** Whether the sheet has anything worth enabling Save for. */
  hasChanges: boolean;
  /** Append a visit, because the user moved tents. */
  shouldLogVisit: boolean;
  shouldLogConsumption: boolean;
  /**
   * Touch the day's attendance row so photos have something to hang off and the
   * calendar shows the day.
   *
   * Never carries a tent set. `tents` on the attendance update is the set the day
   * reconciles to, so sending the moved-to tent there would reconcile the day
   * down to that one tent and delete every earlier visit, on the phone and on the
   * server. And an empty array is not a safe stand-in for "unchanged" either: the
   * update RPC reads [] as "this day holds no tents" and clears it.
   */
  shouldTouchAttendance: boolean;
}

/**
 * A tent counts as a move only if it differs from where the user already is.
 *
 * Re-selecting the tent you are in is a stray tap, not a revisit: two adjacent
 * visits to one tent would read as leaving and coming back.
 */
export function deriveQuickSaveActions(input: QuickSaveInput): QuickSaveActions {
  const { selectedDrinkType, pendingPhotoCount, selectedTentId, currentTentId } = input;

  const shouldLogVisit = !!selectedTentId && selectedTentId !== currentTentId;
  const shouldLogConsumption = selectedDrinkType !== null;
  const hasPhotos = pendingPhotoCount > 0;
  const hasChanges = shouldLogConsumption || hasPhotos || shouldLogVisit;

  return {
    hasChanges,
    shouldLogVisit,
    shouldLogConsumption,
    // Not simply `hasChanges`: logging a drink already creates the day's
    // attendance row on its own path (useOfflineLogConsumption), so a drink-only
    // save needs no touch and queueing one would be a redundant operation.
    // Photos need a row to attach to, and a selected tent means the day should
    // appear on the calendar even if the tent has not changed.
    shouldTouchAttendance: !!selectedTentId || hasPhotos,
  };
}
