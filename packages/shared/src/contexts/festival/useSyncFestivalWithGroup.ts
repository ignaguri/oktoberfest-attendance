"use client";

import { useEffect, useRef } from "react";

import type { Festival } from "../../schemas/festival.schema";
import { useFestival } from "./FestivalContext";

interface GroupFestivalSyncDecision {
  /** Whether this group festival is settled and must not be acted on again */
  handled: boolean;
  /** The festival to switch to, if any */
  switchTo: Festival | null;
}

/**
 * Decide whether a loaded group should switch the current festival.
 *
 * Acts once per group festival. A group screen stays mounted under other
 * screens (or next to the web festival menu), so re-deciding on every
 * currentFestival change would undo a manual switch the moment the user picks
 * another festival. It only counts as handled once a decision was possible:
 * while festivals are still loading the group festival cannot be found yet.
 */
export function resolveGroupFestivalSync(
  groupFestivalId: string | undefined,
  currentFestival: Festival | null,
  festivals: Festival[],
  handledGroupFestivalId: string | undefined,
): GroupFestivalSyncDecision {
  if (!groupFestivalId || !currentFestival || handledGroupFestivalId === groupFestivalId) {
    return { handled: false, switchTo: null };
  }

  if (groupFestivalId === currentFestival.id) {
    return { handled: true, switchTo: null };
  }

  const groupFestival = festivals.find((f) => f.id === groupFestivalId);
  if (!groupFestival) {
    return { handled: false, switchTo: null };
  }

  return { handled: true, switchTo: groupFestival };
}

/**
 * Switch the current festival to a group's festival.
 *
 * A group opened from a notification or an invite link can belong to another
 * festival than the selected one, which would show its leaderboard and messages
 * against the wrong festival.
 *
 * @param groupFestivalId - The festival of the loaded group, undefined while loading
 * @param onSwitched - Called after a switch, so the platform can tell the user
 */
export function useSyncFestivalWithGroup(
  groupFestivalId: string | undefined,
  onSwitched: (festival: Festival) => void,
) {
  const { currentFestival, festivals, setCurrentFestival, clearSwitchSuggestion } = useFestival();

  // Kept in a ref so an inline callback does not re-run the effect every render.
  // Updated in an effect declared before the sync effect, so it is fresh there.
  const onSwitchedRef = useRef(onSwitched);
  useEffect(() => {
    onSwitchedRef.current = onSwitched;
  });

  const handledGroupFestivalIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const { handled, switchTo } = resolveGroupFestivalSync(
      groupFestivalId,
      currentFestival,
      festivals,
      handledGroupFestivalIdRef.current,
    );

    if (handled) {
      handledGroupFestivalIdRef.current = groupFestivalId;
      // The group already decided the festival. Offering the live one on top
      // of it would show this group against a festival it does not belong to.
      clearSwitchSuggestion();
    }
    if (switchTo) {
      setCurrentFestival(switchTo);
      onSwitchedRef.current(switchTo);
    }
  }, [groupFestivalId, currentFestival, festivals, setCurrentFestival, clearSwitchSuggestion]);
}
