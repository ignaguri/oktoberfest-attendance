import type { WrappedFestival } from "../schemas/wrapped.schema";

/**
 * Which festival the Wrapped screen opens: the link's festival, else the newest
 * unlocked one, else the app's current festival (which then shows its locked
 * state and unlock time).
 */
export function resolveWrappedFestivalId(
  paramId: string | undefined,
  festivals: WrappedFestival[] | null | undefined,
  currentFestivalId: string | undefined,
): string | undefined {
  if (paramId) {
    return paramId;
  }
  return festivals?.[0]?.festivalId ?? currentFestivalId;
}
