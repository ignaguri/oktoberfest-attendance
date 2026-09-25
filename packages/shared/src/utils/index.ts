// Captcha utilities
export { isCaptchaRejection } from "./captcha-errors";

// URL utilities
export { buildGroupInviteUrl, getAppUrl, replaceLocalhostInUrl, safeHost } from "./url";

// Date utilities
export {
  atZonedTime,
  formatDateForDatabase,
  formatLocalized,
  formatRelativeTime,
  formatTimeInTimezone,
  formatTimestampForDatabase,
  getDateLocale,
  zonedTimeOnDay,
} from "./date-utils";

// Launch popup coordination
export {
  claimLaunchPopupSlot,
  isLaunchPopupSlotClaimed,
  releaseLaunchPopupSlot,
  resetLaunchPopupSlotForTests,
} from "./launch-popup-slot";

// Pricing utilities
export type { TipMode } from "./pricing";
export {
  calculatePricePaidCents,
  getTipModeDescriptions,
  getTipModeLabels,
  TIP_MODES,
} from "./pricing";

// Image URL utilities
export {
  createGetAvatarUrl,
  createGetBeerPictureUrl,
  type ImageUrlConfig,
  type ImageUrlStrategy,
} from "./image-urls";

// Novu SDK helpers
export { isNovuResponseValidationError, runNovuWriteTolerantly } from "./novu";

// Name helpers
export { splitFullName } from "./split-full-name";

// Festival status
export { getFestivalStatus } from "./festival-status";

// Festival grouping
export { groupFestivalsByStatus, type GroupedFestivals } from "./festival-grouping";

// Festival day model
export { buildFestivalWeeks, type FestivalDayCell } from "./festival-days";
export { type FriendGoingRow, groupFriendsGoing } from "./friends-going";
export {
  FRIENDS_WENT_PHOTO_LIMIT,
  type FriendsWentInput,
  type FriendsWentRows,
  groupFriendsWent,
} from "./friends-went";

// Festival countdown
export {
  FESTIVAL_OPENING_HOUR,
  getFestivalCountdown,
  getFestivalSeriesKey,
  getPreviousFestivalInSeries,
  type CountdownRemaining,
  type FestivalCountdown,
  type FestivalCountdownPhase,
  type FestivalDates,
} from "./festival-countdown";

// Home audience (solo vs social)
export {
  classifyHomeAudience,
  SOLO_MAX_FRIENDS,
  SOLO_MAX_GROUPS,
  type HomeAudience,
  type HomeAudienceInput,
} from "./home-audience";

// Tent visit helpers
export { getCurrentTentId } from "./tent-visits";

// Admin analytics helpers
export {
  ANALYTICS_RANGE_PRESETS,
  DEAD_FEATURE_REACH,
  DEFAULT_ANALYTICS_RANGE_PRESET,
  FESTIVAL_RANGE_PREFIX,
  festivalRangeKey,
  formatPercent,
  funnelConversion,
  rangeForPreset,
  resolveAnalyticsRange,
  retentionRates,
  summarizeOverview,
  visibleFestivalRetentionRows,
  withFeatureReach,
} from "./analytics-metrics";
export type {
  AnalyticsRangePreset,
  FeatureReachRow,
  FunnelStepConversion,
  OverviewSummary,
} from "./analytics-metrics";
