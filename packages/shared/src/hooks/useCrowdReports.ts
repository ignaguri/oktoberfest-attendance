/**
 * Shared hooks for tent crowd report data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import type { CrowdLevel } from "../schemas/crowd-report.schema";
import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  QueryKeys,
} from "../data";

/**
 * Hook to fetch aggregated crowd status for all tents in a festival.
 * Uses a 30-second stale time for near-real-time updates.
 *
 * @param festivalId - Festival ID to fetch crowd status for
 */
export function useTentCrowdStatus(festivalId?: string) {
  const apiClient = useApiClient();

  const query = useQuery(
    QueryKeys.crowdStatus(festivalId ?? ""),
    async () => {
      if (!festivalId) return [];
      const response = await apiClient.tents.getCrowdStatus({ festivalId });
      return response.data || [];
    },
    {
      staleTime: 30 * 1000, // 30 seconds - near-real-time for crowd data
      gcTime: 5 * 60 * 1000, // 5 minutes cache
      enabled: !!festivalId,
    },
  );

  return {
    crowdStatuses: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isInitialLoading: query.isInitialLoading,
    isRefetching: query.isRefetching,
  };
}

/**
 * Hook to fetch recent crowd reports for a specific tent.
 * Returns individual reports from the last 30 minutes.
 *
 * @param tentId - Tent ID to fetch reports for
 * @param festivalId - Festival ID
 */
export function useTentCrowdReports(tentId?: string, festivalId?: string) {
  const apiClient = useApiClient();

  const query = useQuery(
    QueryKeys.tentCrowdReports(tentId ?? "", festivalId ?? ""),
    async () => {
      if (!tentId || !festivalId) return [];
      const response = await apiClient.tents.getCrowdReports(tentId, {
        festivalId,
      });
      return response.data || [];
    },
    {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes cache
      enabled: !!tentId && !!festivalId,
    },
  );

  return {
    reports: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isInitialLoading: query.isInitialLoading,
  };
}

/**
 * Hook to submit a crowd report for a tent.
 * Invalidates related queries on success.
 */
export function useSubmitCrowdReport() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  const mutation = useMutation(
    async (variables: {
      tentId: string;
      festivalId: string;
      crowdLevel: CrowdLevel;
      waitTimeMinutes?: number;
    }) => {
      const response = await apiClient.tents.submitCrowdReport(
        variables.tentId,
        {
          festivalId: variables.festivalId,
          crowdLevel: variables.crowdLevel,
          waitTimeMinutes: variables.waitTimeMinutes,
        },
      );
      return response.report;
    },
    {
      onSuccess: (_data, variables) => {
        // Invalidate crowd status and tent reports
        invalidateQueries(QueryKeys.crowdStatus(variables.festivalId));
        invalidateQueries(
          QueryKeys.tentCrowdReports(variables.tentId, variables.festivalId),
        );
      },
    },
  );

  return {
    submitReport: mutation.mutateAsync,
    isSubmitting: mutation.loading,
    error: mutation.error?.message || null,
    reset: mutation.reset,
  };
}
