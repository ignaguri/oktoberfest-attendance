/**
 * Shared hooks for the admin analytics dashboard
 *
 * Backed by the `/v1/admin/analytics/*` endpoints, which sit behind the
 * requireAdmin middleware. Used identically by the web admin tab and the mobile
 * admin screens; only the rendering differs.
 */

import { QueryKeys, useApiClient, useQuery } from "../data";
import type {
  AnalyticsFeatureUsageResponse,
  AnalyticsFestivalRetentionResponse,
  AnalyticsFunnelResponse,
  AnalyticsOverviewResponse,
  AnalyticsRangeQuery,
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
