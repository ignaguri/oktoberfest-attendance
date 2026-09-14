/**
 * Festival context exports
 */

export {
  FestivalProvider,
  useCanShowLaunchPopups,
  useFestival,
  useFestivalSafe,
} from "./FestivalContext";
export {
  getSwitchSuggestion,
  isFestivalLive,
  isFestivalLiveOrUpcoming,
  selectFestival,
} from "./selection-logic";
export { getOtherFestivalGroups, type OtherFestivalGroups } from "./other-festival-groups";
export { useSyncFestivalWithGroup } from "./useSyncFestivalWithGroup";
export type { FestivalContextType, FestivalStorage } from "./types";
