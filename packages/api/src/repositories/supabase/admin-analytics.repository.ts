import type { Database } from "@prostcounter/db";
import type {
  AnalyticsCohortsResponse,
  AnalyticsFeatureUsageResponse,
  AnalyticsFeatureUsageRow,
  AnalyticsFestivalRetentionResponse,
  AnalyticsFunnelResponse,
  AnalyticsFunnelStep,
  AnalyticsOverviewResponse,
  AnalyticsPlatform,
  AnalyticsScorecardResponse,
  AnalyticsScorecardRow,
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

  async getFeatureUsage(
    from: string,
    to: string,
    platform?: AnalyticsPlatform,
  ): Promise<AnalyticsFeatureUsageResponse> {
    const { data, error } = await this.client.rpc("analytics_feature_usage", {
      p_from: from,
      p_to: to,
      ...(platform ? { p_platform: platform } : {}),
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

  async getActivationFunnel(
    from: string,
    to: string,
    platform?: AnalyticsPlatform,
  ): Promise<AnalyticsFunnelResponse> {
    const { data, error } = await this.client.rpc("analytics_activation_funnel", {
      p_from: from,
      p_to: to,
      ...(platform ? { p_platform: platform } : {}),
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

  async getFeatureScorecard(festivalId?: string): Promise<AnalyticsScorecardResponse> {
    const { data, error } = await this.client.rpc(
      "analytics_feature_scorecard",
      festivalId ? { p_festival_id: festivalId } : {},
    );
    if (error) {
      throw new Error(`analytics_feature_scorecard failed: ${error.message}`);
    }
    return {
      features: (data ?? []).map((row) => ({
        // The SQL VALUES list mirrors ANALYTICS_SCORECARD_FEATURES; the
        // integration test fails if they drift.
        feature: row.feature as AnalyticsScorecardRow["feature"],
        attendees: row.attendees,
        adopters: row.adopters,
        cameBackUsers: row.came_back_users,
        cameBackUsersBase: row.came_back_users_base,
        cameBackNonUsers: row.came_back_non_users,
        cameBackNonUsersBase: row.came_back_non_users_base,
        returnedUsers: row.returned_users,
        returnedUsersBase: row.returned_users_base,
        returnedNonUsers: row.returned_non_users,
        returnedNonUsersBase: row.returned_non_users_base,
      })),
    };
  }

  async getSignupCohorts(): Promise<AnalyticsCohortsResponse> {
    const { data, error } = await this.client.rpc("analytics_signup_cohorts");
    if (error) {
      throw new Error(`analytics_signup_cohorts failed: ${error.message}`);
    }
    return {
      cohorts: (data ?? []).map((row) => ({
        month: row.month,
        signups: row.signups,
        activated: row.activated,
        activated7d: row.activated_7d,
        engaged: row.engaged,
        returned: row.returned,
      })),
    };
  }
}
