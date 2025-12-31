/**
 * Business logic hooks for attendance data
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
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
    async () => {
      const response = await apiClient.attendance.list({ festivalId });
      // API returns { data, total, limit, offset }
      // Return the data array, or empty array if undefined
      return response.data || [];
    },
    {
      enabled: !!festivalId,
      staleTime: 60 * 1000, // 1 minute - attendance changes frequently
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to fetch user highlights (stats) for a festival
 * @deprecated Use useHighlights from useProfile.ts instead
 */
export function useUserHighlights(festivalId?: string) {
  return useQuery(
    QueryKeys.highlights(festivalId || ""),
    async () => {
      if (!festivalId) return null;
      const response = await apiClient.profile.getHighlights(festivalId);
      return response.highlights;
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to delete attendance with optimistic updates
 */
export function useDeleteAttendance() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (attendanceId: string) => {
      return await apiClient.attendance.delete(attendanceId);
    },
    {
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
    },
  );
}
