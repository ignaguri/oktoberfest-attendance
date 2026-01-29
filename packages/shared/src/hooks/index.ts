"use client";

/**
 * Shared hooks for web and mobile apps
 *
 * These hooks use the ApiClientContext to access the platform-specific API client.
 * Apps must wrap their component tree with ApiClientProvider before using these hooks.
 *
 * @example
 * // In your app's root layout
 * import { ApiClientProvider } from "@prostcounter/shared/data";
 * import { apiClient } from "@/lib/api-client";
 *
 * <ApiClientProvider client={apiClient}>
 *   <YourApp />
 * </ApiClientProvider>
 *
 * // In your components
 * import { useFestivals, useUserGroups } from "@prostcounter/shared/hooks";
 *
 * function MyComponent() {
 *   const { data: festivals } = useFestivals();
 *   const { data: groups } = useUserGroups(festivalId);
 * }
 */

// Festival hooks
export {
  useActiveFestival,
  useFestivalById,
  useFestivals,
} from "./useFestivals";

// Group hooks
export {
  useCreateGroup,
  useGroupGallery,
  useGroupMembers,
  useGroupName,
  useGroupSearch,
  useGroupSettings,
  useJoinGroup,
  useJoinGroupByToken,
  useLeaveGroup,
  useRemoveMember,
  useRenewInviteToken,
  useUpdateGroup,
  useUserGroups,
} from "./useGroups";

// Leaderboard hooks
export {
  useGlobalLeaderboard,
  useGroupLeaderboard,
  useWinningCriterias,
} from "./useLeaderboard";

// Achievement hooks
export {
  useAchievementLeaderboard,
  useAchievementsWithProgress,
  useAvailableAchievements,
  useUserAchievements,
} from "./useAchievements";

// Attendance hooks
export {
  useAttendanceByDate,
  useAttendances,
  useDeleteAttendance,
  useUpdatePersonalAttendance,
} from "./useAttendance";

// Consumption hooks
export {
  useConsumptionCounts,
  useConsumptions,
  useDeleteConsumption,
  useLogConsumption,
} from "./useConsumption";

// Tent hooks
export {
  type TentGroup,
  type TentOption,
  useTentById,
  useTents,
  useTentsByCategory,
} from "./useTents";

// Reservation hooks
export {
  useCancelReservation,
  useCheckInReservation,
  useCreateReservation,
  useReservation,
  useReservations,
  useUpdateReservation,
} from "./useReservations";

// Activity feed hooks
export {
  type ActivityFeedItem,
  type ActivityFeedResponse,
  useActivityFeed,
  useActivityFeedItems,
} from "./useActivityFeed";

// Profile hooks (shared portion - some hooks remain platform-specific)
export {
  useCompleteTutorial,
  useCurrentProfile,
  useDeleteProfile,
  useHighlights,
  useMissingProfileFields,
  usePublicProfile,
  useResetTutorial,
  useTutorialStatus,
  useUpdateProfile,
} from "./useProfile";

// Calendar hooks
export {
  type CalendarEvent,
  useGroupCalendar,
  usePersonalCalendar,
} from "./useCalendar";

// Pricing hooks
export { useDrinkPrice, type UseDrinkPriceReturn } from "./useDrinkPrice";

// Notification hooks
export {
  type NotificationPreferencesResponse,
  type UpdateNotificationPreferencesInput,
  useNotificationPreferences,
  useRegisterFCMToken,
  useSubscribeToNotifications,
  useUpdateNotificationPreferences,
} from "./useNotificationPreferences";

// Language hooks
export {
  type LanguageStorage,
  setLanguageStorage,
  useLanguage,
} from "./useLanguage";
