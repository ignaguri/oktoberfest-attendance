import type { Database } from "@prostcounter/db";
import type {
  AnalyticsFeatureUsageResponse,
  AnalyticsFeatureUsageRow,
  AnalyticsFestivalRetentionResponse,
  AnalyticsFunnelResponse,
  AnalyticsFunnelStep,
  AnalyticsOverviewResponse,
  AnalyticsPlatform,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "../../utils/admin-client";

/**
 * Reads the admin analytics metric functions (dashboard v0).
 *
 * The analytics_* functions are executable by service_role only (see the
 * analytics_dashboard_v0 migration), so this deliberately uses the
 * service-role client rather than the caller's. The caller is already known to
 * be an admin: every /admin/* route sits behind requireAdmin.
 */
export class SupabaseAdminAnalyticsRepository {
  constructor(private readonly client: SupabaseClient<Database> = createAdminClient()) {}

  async getOverview(
    from: string,
    to: string,
    platform?: AnalyticsPlatform,
  ): Promise<AnalyticsOverviewResponse> {
    const { data, error } = await this.client.rpc("analytics_overview", {
      p_from: from,
      p_to: to,
      ...(platform ? { p_platform: platform } : {}),
    });
    if (error) {
      throw new Error(`analytics_overview failed: ${error.message}`);
    }
    return {
      series: (data ?? []).map((row) => ({
        day: row.day,
        dau: row.dau,
        wau: row.wau,
        mau: row.mau,
      })),
    };
  }

  async getFeatureUsage(from: string, to: string): Promise<AnalyticsFeatureUsageResponse> {
    const { data, error } = await this.client.rpc("analytics_feature_usage", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      throw new Error(`analytics_feature_usage failed: ${error.message}`);
    }
    const rows = data ?? [];
    return {
      activeUsers: rows[0]?.active_users ?? 0,
      features: rows.map((row) => ({
        // The SQL VALUES list mirrors ANALYTICS_FEATURES; the integration test
        // fails if they drift, so the cast cannot admit an unknown name.
        feature: row.feature as AnalyticsFeatureUsageRow["feature"],
        users: row.users,
        events: row.events,
      })),
    };
  }

  async getActivationFunnel(from: string, to: string): Promise<AnalyticsFunnelResponse> {
    const { data, error } = await this.client.rpc("analytics_activation_funnel", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      throw new Error(`analytics_activation_funnel failed: ${error.message}`);
    }
    return {
      steps: (data ?? []).map((row) => ({
        step: row.step as AnalyticsFunnelStep["step"],
        users: row.users,
      })),
    };
  }

  async getFestivalRetention(): Promise<AnalyticsFestivalRetentionResponse> {
    const { data, error } = await this.client.rpc("analytics_festival_retention");
    if (error) {
      throw new Error(`analytics_festival_retention failed: ${error.message}`);
    }
    return {
      festivals: (data ?? []).map((row) => ({
        festivalId: row.festival_id,
        festivalName: row.festival_name,
        startDate: row.start_date,
        attendees: row.attendees,
        returnedNext: row.returned_next,
        returnedAny: row.returned_any,
      })),
    };
  }
}
