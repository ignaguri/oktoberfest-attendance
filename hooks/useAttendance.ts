/**
 * Business logic hooks for attendance data
 *
 * These hooks handle all attendance-related data operations
 */

import {
  fetchAttendances,
  deleteAttendance,
} from "@/app/(private)/attendance/actions";
import { fetchHighlights } from "@/app/(private)/home/actions";
import {
  useQuery,
  useMutation,
  useInvalidateQueries,
} from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch user's attendance data for a festival
 */
export function useAttendances(festivalId: string) {
  return useQuery(
    QueryKeys.attendances(festivalId),
    () => fetchAttendances(festivalId),
    {
      enabled: !!festivalId,
      staleTime: 60 * 1000, // 1 minute - attendance changes frequently
      cacheTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to fetch user highlights (stats) for a festival
 */
export function useUserHighlights(festivalId?: string) {
  return useQuery(
    QueryKeys.userStats("current", festivalId || ""),
    () => fetchHighlights(festivalId),
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to delete attendance with optimistic updates
 */
export function useDeleteAttendance() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation((attendanceId: string) => deleteAttendance(attendanceId), {
    onSuccess: () => {
      // Invalidate all attendances (will match any festival)
      invalidateQueries(["attendances"]);
      // Invalidate user stats
      invalidateQueries(["user"]);
      // Also invalidate leaderboards since attendance affects rankings
      invalidateQueries(["leaderboard"]);
      // Invalidate highlights as they depend on attendance
      invalidateQueries(["highlights"]);
    },
    onError: () => {
      // Error handling is done in the component via the mutation result
    },
  });
}
