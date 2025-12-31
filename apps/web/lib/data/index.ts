/**
 * Main exports for the data layer abstraction
 *
 * This file provides a clean API for components to import data-related functionality
 * Components should import from this file rather than directly from provider-specific files
 */

// Core abstraction types and utilities
export type {
  DataMutationOptions,
  DataMutationResult,
  DataProvider,
  DataQueryOptions,
  DataQueryResult,
} from "./types";
export { QueryKeys } from "./types";

// Provider implementation (only the hooks, not the internals)
export {
  useGetQueryData,
  useInvalidateQueries,
  useMutation,
  useQuery,
  useSetQueryData,
} from "./react-query-provider";

// Query client setup
export { DataProvider as QueryProvider } from "./query-client";

// Business logic hooks - these are the main API for components

// Attendance hooks
export {
  useAttendances,
  useDeleteAttendance,
  useUserHighlights,
} from "../../hooks/useAttendance";

// Festival hooks
export {
  useActiveFestival,
  useFestivalById,
  useFestivals,
} from "../../hooks/useFestival";

// Leaderboard hooks
export {
  useGlobalLeaderboard,
  useGroupLeaderboard,
  useWinningCriterias,
} from "../../hooks/useLeaderboard";

// Group management hooks
export {
  useCreateGroup,
  useGroupSettings,
  useJoinGroup,
  useLeaveGroup,
  useUpdateGroup,
  useUserGroups,
} from "../../hooks/useGroups";

// Profile hooks
export {
  useCompleteTutorial,
  useCurrentProfile,
  useCurrentUser,
  useDeleteProfile,
  useHighlights,
  useMissingProfileFields,
  useResetTutorial,
  useTutorialStatus,
  useUpdateProfile,
  useUploadAvatar,
} from "../../hooks/useProfile";

// Calendar hooks
export { useGroupCalendar, usePersonalCalendar } from "../../hooks/useCalendar";

// Achievement hooks
export {
  useAvailableAchievements,
  useUserAchievements,
} from "../../hooks/useAchievements";

// Admin hooks
export {
  useAllGroups,
  useAllUsers,
  useCreateFestival,
  useDeleteFestival,
  useUpdateFestival,
} from "../../hooks/useAdmin";
