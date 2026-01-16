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
  useFestivals,
  useActiveFestival,
  useFestivalById,
} from "./useFestivals";

// Group hooks
export {
  useUserGroups,
  useGroupSettings,
  useCreateGroup,
  useGroupSearch,
  useJoinGroup,
  useJoinGroupByToken,
  useUpdateGroup,
  useLeaveGroup,
  useGroupName,
  useGroupMembers,
  useRemoveMember,
  useRenewInviteToken,
  useGroupGallery,
} from "./useGroups";

// Leaderboard hooks
export {
  useGlobalLeaderboard,
  useGroupLeaderboard,
  useWinningCriterias,
} from "./useLeaderboard";

// Achievement hooks
export {
  useUserAchievements,
  useAchievementsWithProgress,
  useAchievementLeaderboard,
  useAvailableAchievements,
} from "./useAchievements";

// Attendance hooks
export {
  useAttendances,
  useAttendanceByDate,
  useDeleteAttendance,
  useUpdatePersonalAttendance,
} from "./useAttendance";

// Consumption hooks
export {
  useLogConsumption,
  useConsumptions,
  useDeleteConsumption,
  useConsumptionCounts,
} from "./useConsumption";

// Tent hooks
export {
  useTents,
  useTentById,
  useTentsByCategory,
  type TentOption,
  type TentGroup,
} from "./useTents";

// Reservation hooks
export {
  useReservation,
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useCancelReservation,
  useCheckInReservation,
} from "./useReservations";

// Activity feed hooks
export {
  useActivityFeed,
  useActivityFeedItems,
  type ActivityFeedItem,
  type ActivityFeedResponse,
} from "./useActivityFeed";

// Profile hooks (shared portion - some hooks remain platform-specific)
export {
  useCurrentProfile,
  useUpdateProfile,
  useDeleteProfile,
  useTutorialStatus,
  useCompleteTutorial,
  useResetTutorial,
  useMissingProfileFields,
  useHighlights,
  usePublicProfile,
} from "./useProfile";

// Calendar hooks
export {
  usePersonalCalendar,
  useGroupCalendar,
  type CalendarEvent,
} from "./useCalendar";

// Pricing hooks
export { useDrinkPrice, type UseDrinkPriceReturn } from "./useDrinkPrice";

// Notification hooks
export {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useRegisterFCMToken,
  useSubscribeToNotifications,
  type NotificationPreferencesResponse,
  type UpdateNotificationPreferencesInput,
} from "./useNotificationPreferences";
