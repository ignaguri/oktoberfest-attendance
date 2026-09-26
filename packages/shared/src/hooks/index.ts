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
export { useActiveFestival, useFestivalById, useFestivals } from "./useFestivals";
export { useFestivalCountdown } from "./useFestivalCountdown";

// Group hooks
export {
  useCarryOverCandidates,
  useCarryOverGroup,
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
  useAllUserGroups,
  useUserGroups,
} from "./useGroups";

export {
  useAcceptJoinRequest,
  useCancelJoinRequest,
  useDeclineJoinRequest,
  useIncomingJoinRequests,
  useRequestToJoinGroup,
} from "./useGroupJoinRequests";

export {
  useAcceptGroupInvitation,
  useCancelGroupInvitation,
  useDeclineGroupInvitation,
  useIncomingGroupInvitations,
  useInvitableUsers,
  useInviteToGroup,
  useSentGroupInvitations,
} from "./useGroupInvitations";

// Leaderboard hooks
export { useGlobalLeaderboard, useGroupLeaderboard, useWinningCriterias } from "./useLeaderboard";

// Achievement hooks
export {
  useAchievementLeaderboard,
  useAchievementsWithProgress,
  useAvailableAchievements,
  useUserAchievements,
} from "./useAchievements";
export { UnlockQueueProvider, useUnlockQueue } from "./useUnlockQueue";

// Attendance hooks
export {
  ATTENDANCE_SIDE_EFFECT_KEYS,
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

// Day plan hooks
export {
  useDayPlans,
  useDeleteDayPlan,
  useFriendsGoing,
  usePlanCompanionOptions,
  useUpsertDayPlan,
} from "./useDayPlans";
export { useFriendsWent } from "./useFriendsWent";

// Reservation hooks
export {
  useCancelReservation,
  useCheckInReservation,
  useCreateReservation,
  useReservation,
  useReservations,
  useUpdateReservation,
} from "./useReservations";

// Group message hooks
export {
  useDeleteMessage,
  useGroupMessages,
  useMessageFeed,
  usePostMessage,
  useUpdateMessage,
} from "./useGroupMessages";

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
  useProfileDetail,
  useProfileFestivalDays,
  usePublicProfile,
  useResetTutorial,
  useTutorialStatus,
  useUpdateProfile,
} from "./useProfile";

// Calendar hooks
export { type CalendarEvent, useGroupCalendar, usePersonalCalendar } from "./useCalendar";

// Pricing hooks
export { useDrinkPrice, type UseDrinkPriceReturn } from "./useDrinkPrice";
export { useTipCalculation } from "./useTipCalculation";

// Notification hooks
export {
  type NotificationPreferencesResponse,
  type UpdateNotificationPreferencesInput,
  useEnablePushNotifications,
  useNotificationPreferences,
  useRegisterFCMToken,
  useSubscribeToNotifications,
  useUpdateNotificationPreferences,
} from "./useNotificationPreferences";

// Language hooks
export { type LanguageStorage, setLanguageStorage, useLanguage } from "./useLanguage";

// Photo social hooks
export {
  useAddComment,
  useAddReaction,
  useDeleteComment,
  usePhotoComments,
  usePhotoReactions,
  useRemoveReaction,
} from "./usePhotoSocial";

// Photo tag hooks
export { usePhotoTags, useSetPhotoTags, useTaggedPhotos } from "./usePhotoTags";

// Unified feed hooks
export { type UnifiedFeedItem, useUnifiedFeed } from "./useUnifiedFeed";

// Friend hooks
export {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useFriendRequestCount,
  useFriendRequests,
  useFriends,
  useFriendshipStatus,
  useFriendSuggestions,
  useOutgoingFriendRequests,
  useSearchUsers,
  useSendFriendRequest,
  useUnfriend,
} from "./useFriends";

// Crowd report hooks
export { useSubmitCrowdReport, useTentCrowdReports, useTentCrowdStatus } from "./useCrowdReports";
export {
  useAdminFeedback,
  useDayFeedbackPrompt,
  useDismissDayFeedbackPrompt,
  useSubmitFeedback,
} from "./useFeedback";

// Wrapped hooks
export {
  useAvailableWrappedFestivals,
  useGenerateWrapped,
  useWrappedAccess,
  useWrappedDataApi,
} from "./useWrapped";

// Admin hooks
export {
  useAdminLocationSessions,
  useCleanupExpiredLocationSessions,
  useForceStopLocationSession,
} from "./useAdminLocation";
export {
  useAdminFestival,
  useAdminFestivals,
  useCreateAdminFestival,
  useDeleteAdminFestival,
  useUpdateAdminFestival,
} from "./useAdminFestivals";
export {
  useAdminGroup,
  useAdminGroupMembers,
  useAdminGroups,
  useAdminWinningCriteria,
  useDeleteAdminGroup,
  useUpdateAdminGroup,
} from "./useAdminGroups";
export {
  useAddAdminFestivalTent,
  useAddAllAdminFestivalTents,
  useAdminAvailableTents,
  useAdminFestivalTents,
  useAdminTents,
  useCopyAdminFestivalTents,
  useCreateAdminTent,
  useRemoveAdminFestivalTent,
  useSetAdminFestivalTentPrice,
  useUpdateAdminTent,
} from "./useAdminTents";
export {
  useAdminUser,
  useAdminUserAttendances,
  useAdminUserGroups,
  useAdminUsers,
  useDeleteAdminAttendance,
  useDeleteAdminUser,
  useUpdateAdminAttendance,
  useUpdateAdminUserAuth,
  useUpdateAdminUserProfile,
} from "./useAdminUsers";
export {
  useAdminAnalyticsActivationFunnel,
  useAdminAnalyticsFeatures,
  useAdminAnalyticsFestivalRetention,
  useAdminAnalyticsOverview,
} from "./useAdminAnalytics";
export { useAdminWrappedCache, useRegenerateWrappedCache } from "./useAdminWrappedCache";
