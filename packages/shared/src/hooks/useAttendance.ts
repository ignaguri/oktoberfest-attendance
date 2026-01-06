/**
 * Shared hooks for attendance data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  QueryKeys,
} from "../data";

/**
 * Hook to fetch user's attendance data for a festival
 */
export function useAttendances(festivalId: string) {
  const apiClient = useApiClient();

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
    }
  );
}

/**
 * Hook to delete attendance with optimistic updates
 */
export function useDeleteAttendance() {
  const apiClient = useApiClient();
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
    }
  );
}
