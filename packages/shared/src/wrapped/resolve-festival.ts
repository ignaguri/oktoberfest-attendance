import type { WrappedFestival } from "../schemas/wrapped.schema";

/**
 * Which festival the Wrapped screen opens: the link's festival, else the newest
 * unlocked one, else the app's current festival (which then shows its locked
 * state and unlock time).
 *
 * Without a link it waits for the list (undefined while loading): falling back
 * to the current festival early would fetch it, and record a view of it, before
 * the newest unlocked festival replaces it.
 */
export function resolveWrappedFestivalId(
  paramId: string | undefined,
  festivals: WrappedFestival[] | null | undefined,
  currentFestivalId: string | undefined,
): string | undefined {
  if (paramId) {
    return paramId;
  }
  if (!festivals) {
    return undefined;
  }
  return festivals[0]?.festivalId ?? currentFestivalId;
}
