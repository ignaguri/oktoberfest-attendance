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
    },
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
    },
  );
}

/**
 * Hook to fetch attendance for a specific date
 */
export function useAttendanceByDate(festivalId: string, date: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.attendanceByDate(festivalId, date),
    async () => {
      const response = await apiClient.attendance.getByDate({
        festivalId,
        date,
      });
      return response.attendance;
    },
    {
      enabled: !!festivalId && !!date,
      staleTime: 15 * 1000, // 15 seconds - frequently edited during festival
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to create or update personal attendance
 */
export function useUpdatePersonalAttendance() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (input: {
      festivalId: string;
      date: string;
      tents?: string[];
      amount?: number;
    }) => {
      return await apiClient.attendance.updatePersonal(input);
    },
    {
      onSuccess: () => {
        // Invalidate all attendances
        invalidateQueries(["attendances"]);
        // Invalidate attendance by date queries
        invalidateQueries(["attendanceByDate"]);
        // Invalidate user stats
        invalidateQueries(["user"]);
        // Invalidate leaderboards
        invalidateQueries(["leaderboard"]);
        // Invalidate highlights
        invalidateQueries(["highlights"]);
      },
    },
  );
}
