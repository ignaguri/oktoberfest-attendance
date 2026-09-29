/**
 * Shared hooks for the admin analytics dashboard
 *
 * Backed by the `/v1/admin/analytics/*` endpoints, which sit behind the
 * requireAdmin middleware. Used identically by the web admin tab and the mobile
 * admin screens; only the rendering differs.
 */

import { useInfiniteQuery } from "@tanstack/react-query";

import { QueryKeys, useApiClient, useQuery } from "../data";
import type {
  AnalyticsCohortMembersQuery,
  AnalyticsCohortsResponse,
  AnalyticsFeatureUsageResponse,
  AnalyticsFestivalRetentionResponse,
  AnalyticsFunnelMembersQuery,
  AnalyticsFunnelResponse,
  AnalyticsMembersResponse,
  AnalyticsOverviewResponse,
  AnalyticsRangeQuery,
  AnalyticsScorecardMembersQuery,
  AnalyticsScorecardResponse,
  AnalyticsTimelineCursor,
  AnalyticsTimelineKind,
} from "../schemas/admin-analytics.schema";

// The numbers move slowly and every query scans whole tables, so do not refetch
// on every focus.
const ANALYTICS_STALE_TIME_MS = 5 * 60 * 1000;
const ANALYTICS_GC_TIME_MS = 30 * 60 * 1000;

const ANALYTICS_QUERY_OPTIONS = {
  staleTime: ANALYTICS_STALE_TIME_MS,
  gcTime: ANALYTICS_GC_TIME_MS,
};

export function useAdminAnalyticsOverview(filters: AnalyticsRangeQuery) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsOverviewResponse>(
    QueryKeys.adminAnalyticsOverview(filters.from, filters.to, filters.platform),
    () => apiClient.admin.analytics.overview(filters),
    ANALYTICS_QUERY_OPTIONS,
  );
}

export function useAdminAnalyticsFeatures(filters: AnalyticsRangeQuery) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsFeatureUsageResponse>(
    QueryKeys.adminAnalyticsFeatures(filters.from, filters.to, filters.platform),
    () => apiClient.admin.analytics.features(filters),
    ANALYTICS_QUERY_OPTIONS,
  );
}

export function useAdminAnalyticsActivationFunnel(filters: AnalyticsRangeQuery) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsFunnelResponse>(
    QueryKeys.adminAnalyticsActivationFunnel(filters.from, filters.to, filters.platform),
    () => apiClient.admin.analytics.activationFunnel(filters),
    ANALYTICS_QUERY_OPTIONS,
  );
}

export function useAdminAnalyticsFestivalRetention() {
  const apiClient = useApiClient();
  return useQuery<AnalyticsFestivalRetentionResponse>(
    QueryKeys.adminAnalyticsFestivalRetention(),
    () => apiClient.admin.analytics.festivalRetention(),
    ANALYTICS_QUERY_OPTIONS,
  );
}

/** No festivalId means every festival, pooled. */
export function useAdminAnalyticsScorecard(festivalId?: string) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsScorecardResponse>(
    QueryKeys.adminAnalyticsScorecard(festivalId),
    () => apiClient.admin.analytics.scorecard({ festivalId }),
    ANALYTICS_QUERY_OPTIONS,
  );
}

export function useAdminAnalyticsCohorts() {
  const apiClient = useApiClient();
  return useQuery<AnalyticsCohortsResponse>(
    QueryKeys.adminAnalyticsCohorts(),
    () => apiClient.admin.analytics.cohorts(),
    ANALYTICS_QUERY_OPTIONS,
  );
}

export function useAdminAnalyticsFunnelMembers(query: AnalyticsFunnelMembersQuery, enabled = true) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsMembersResponse>(
    QueryKeys.adminAnalyticsFunnelMembers(query.from, query.to, query.platform, query.step),
    () => apiClient.admin.analytics.funnelMembers(query),
    { ...ANALYTICS_QUERY_OPTIONS, enabled },
  );
}

/** No festivalId means every festival, pooled. */
export function useAdminAnalyticsScorecardMembers(
  query: AnalyticsScorecardMembersQuery,
  enabled = true,
) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsMembersResponse>(
    QueryKeys.adminAnalyticsScorecardMembers(query.festivalId, query.feature, query.segment),
    () => apiClient.admin.analytics.scorecardMembers(query),
    { ...ANALYTICS_QUERY_OPTIONS, enabled },
  );
}

export function useAdminAnalyticsCohortMembers(query: AnalyticsCohortMembersQuery, enabled = true) {
  const apiClient = useApiClient();
  return useQuery<AnalyticsMembersResponse>(
    QueryKeys.adminAnalyticsCohortMembers(query.month, query.step),
    () => apiClient.admin.analytics.cohortMembers(query),
    { ...ANALYTICS_QUERY_OPTIONS, enabled },
  );
}

/**
 * One user's timeline, a page at a time. The shared data layer has no
 * infinite query, so this one uses TanStack's directly.
 */
export function useAdminUserTimeline(userId: string | undefined, kind: AnalyticsTimelineKind) {
  const apiClient = useApiClient();
  const query = useInfiniteQuery({
    queryKey: QueryKeys.adminUserTimeline(userId ?? "", kind),
    queryFn: ({ pageParam }: { pageParam: AnalyticsTimelineCursor | null }) =>
      apiClient.admin.users.timeline(userId ?? "", { kind, ...pageParam }),
    initialPageParam: null as AnalyticsTimelineCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  return {
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
    hasMore: query.hasNextPage,
    loadMore: () => {
      void query.fetchNextPage();
    },
    loadingMore: query.isFetchingNextPage,
  };
}
