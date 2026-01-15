/**
 * Shared hooks for consumption data
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
import type { LogConsumptionInput, Consumption } from "../schemas";

/**
 * Hook to log a new consumption (drink)
 * POST /v1/consumption
 */
export function useLogConsumption() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (input: LogConsumptionInput) => {
      return await apiClient.consumption.log(input);
    },
    {
      onSuccess: (_data, variables) => {
        // Invalidate attendance-related queries
        invalidateQueries(["attendances"]);
        invalidateQueries(["attendanceByDate"]);
        // Invalidate consumptions for this date
        invalidateQueries([
          "consumptions",
          variables.festivalId,
          variables.date,
        ]);
        // Invalidate user stats and leaderboards
        invalidateQueries(["user"]);
        invalidateQueries(["leaderboard"]);
        invalidateQueries(["highlights"]);
        // Invalidate activity feed
        invalidateQueries(["activity-feed"]);
      },
    },
  );
}

/**
 * Hook to fetch consumptions for a specific date
 * GET /v1/consumption?festivalId=xxx&date=YYYY-MM-DD
 */
export function useConsumptions(festivalId: string, date: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.consumptions(festivalId, date),
    async () => {
      const response = await apiClient.consumption.list({ festivalId, date });
      return (response.consumptions || []) as Consumption[];
    },
    {
      enabled: !!festivalId && !!date,
      staleTime: 30 * 1000, // 30 seconds - may change while editing
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to delete a consumption
 * DELETE /v1/consumption/:id
 */
export function useDeleteConsumption() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (consumptionId: string) => {
      return await apiClient.consumption.delete(consumptionId);
    },
    {
      onSuccess: () => {
        // Invalidate all consumption and attendance related queries
        invalidateQueries(["consumptions"]);
        invalidateQueries(["attendances"]);
        invalidateQueries(["attendanceByDate"]);
        // Invalidate user stats and leaderboards
        invalidateQueries(["user"]);
        invalidateQueries(["leaderboard"]);
        invalidateQueries(["highlights"]);
        // Invalidate activity feed
        invalidateQueries(["activity-feed"]);
      },
    },
  );
}

/**
 * Helper hook to calculate consumption counts by drink type
 */
export function useConsumptionCounts(consumptions: Consumption[] | undefined) {
  if (!consumptions) {
    return {
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
      total: 0,
    };
  }

  const counts = {
    beer: 0,
    radler: 0,
    wine: 0,
    soft_drink: 0,
    alcohol_free: 0,
    other: 0,
    total: consumptions.length,
  };

  for (const c of consumptions) {
    if (c.drinkType in counts) {
      counts[c.drinkType as keyof typeof counts]++;
    }
  }

  return counts;
}
