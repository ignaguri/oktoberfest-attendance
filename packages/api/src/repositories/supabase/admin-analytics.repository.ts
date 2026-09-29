import type { Database } from "@prostcounter/db";
import type {
  AnalyticsCohortMembersQuery,
  AnalyticsCohortsResponse,
  AnalyticsFeatureUsageResponse,
  AnalyticsFeatureUsageRow,
  AnalyticsFestivalRetentionResponse,
  AnalyticsFunnelMembersQuery,
  AnalyticsFunnelResponse,
  AnalyticsFunnelStep,
  AnalyticsMember,
  AnalyticsMembersResponse,
  AnalyticsOverviewResponse,
  AnalyticsPlatform,
  AnalyticsScorecardMembersQuery,
  AnalyticsScorecardResponse,
  AnalyticsScorecardRow,
  AnalyticsTimelineQuery,
  AnalyticsTimelineResponse,
  AnalyticsTimelineRow,
} from "@prostcounter/shared";
import {
  ANALYTICS_MEMBERS_MAX_ROWS,
  ANALYTICS_TIMELINE_DEFAULT_LIMIT,
  COHORT_STEP_FILTERS,
  FUNNEL_STEP_MIN_DAYS,
  SCORECARD_SEGMENT_FILTERS,
  sortMembers,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "../../utils/admin-client";

/** One row picked out of a *_members function, before display fields. */
interface MemberRef {
  user_id: string;
  festival_id?: string;
  festival_name?: string | null;
}

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

  async getFunnelMembers(query: AnalyticsFunnelMembersQuery): Promise<AnalyticsMembersResponse> {
    const request = this.client
      .rpc("analytics_funnel_members", {
        p_from: query.from,
        p_to: query.to,
        ...(query.platform ? { p_platform: query.platform } : {}),
      })
      .gte("attendance_days", FUNNEL_STEP_MIN_DAYS[query.step]);
    const { data, error } = await request
      // sortMembers' order, so a capped list keeps the most recently active;
      // user_id keeps the cut stable between fetches
      .order("last_active_day", { ascending: false, nullsFirst: false })
      .order("user_id")
      .range(0, ANALYTICS_MEMBERS_MAX_ROWS - 1);
    if (error) {
      throw new Error(`analytics_funnel_members failed: ${error.message}`);
    }
    return this.withProfiles(data ?? []);
  }

  async getScorecardMembers(
    query: AnalyticsScorecardMembersQuery,
  ): Promise<AnalyticsMembersResponse> {
    let request = this.client
      .rpc(
        "analytics_scorecard_members",
        query.festivalId ? { p_festival_id: query.festivalId } : {},
      )
      .eq("feature", query.feature);
    for (const [column, value] of Object.entries(SCORECARD_SEGMENT_FILTERS[query.segment])) {
      request = request.eq(column, value);
    }
    const { data, error } = await request
      // sortMembers' order, so a capped list keeps the most recently active;
      // user_id keeps the cut stable between fetches
      .order("last_active_day", { ascending: false, nullsFirst: false })
      .order("user_id")
      .range(0, ANALYTICS_MEMBERS_MAX_ROWS - 1);
    if (error) {
      throw new Error(`analytics_scorecard_members failed: ${error.message}`);
    }
    return this.withProfiles(data ?? []);
  }

  async getCohortMembers(query: AnalyticsCohortMembersQuery): Promise<AnalyticsMembersResponse> {
    let request = this.client.rpc("analytics_cohort_members").eq("month", query.month);
    for (const [column, value] of Object.entries(COHORT_STEP_FILTERS[query.step])) {
      request = request.eq(column, value);
    }
    const { data, error } = await request
      // sortMembers' order, so a capped list keeps the most recently active;
      // user_id keeps the cut stable between fetches
      .order("last_active_day", { ascending: false, nullsFirst: false })
      .order("user_id")
      .range(0, ANALYTICS_MEMBERS_MAX_ROWS - 1);
    if (error) {
      throw new Error(`analytics_cohort_members failed: ${error.message}`);
    }
    return this.withProfiles(data ?? []);
  }

  async getUserTimeline(
    userId: string,
    query: AnalyticsTimelineQuery,
  ): Promise<AnalyticsTimelineResponse> {
    const limit = query.limit ?? ANALYTICS_TIMELINE_DEFAULT_LIMIT;
    const { data, error } = await this.client.rpc("analytics_user_timeline", {
      p_user_id: userId,
      p_limit: limit,
      ...(query.kind && query.kind !== "all" ? { p_kind: query.kind } : {}),
      ...(query.cursorAt && query.cursorKey
        ? { p_cursor_at: query.cursorAt, p_cursor_key: query.cursorKey }
        : {}),
    });
    if (error) {
      throw new Error(`analytics_user_timeline failed: ${error.message}`);
    }
    const rows: AnalyticsTimelineRow[] = (data ?? []).map((row) => ({
      occurredAt: row.occurred_at,
      kind: row.kind as AnalyticsTimelineRow["kind"],
      name: row.name,
      props: (row.props ?? {}) as Record<string, unknown>,
      festivalId: row.festival_id,
      festivalName: row.festival_name,
      platform: row.platform,
      appVersion: row.app_version,
      sessionId: row.session_id,
      cursorKey: row.cursor_key,
    }));
    const last = rows[rows.length - 1];
    return {
      rows,
      // The cursor strings go back verbatim; parsing occurredAt would drop microseconds
      nextCursor:
        rows.length === limit && last
          ? { cursorAt: last.occurredAt, cursorKey: last.cursorKey }
          : null,
    };
  }

  /** Adds display fields to member rows, sorted, and flags a capped list. */
  private async withProfiles(refs: readonly MemberRef[]): Promise<AnalyticsMembersResponse> {
    const truncated = refs.length >= ANALYTICS_MEMBERS_MAX_ROWS;
    if (refs.length === 0) {
      return { members: [], truncated };
    }
    const userIds = [...new Set(refs.map((ref) => ref.user_id))];
    const { data, error } = await this.client.rpc("analytics_member_profiles", {
      p_user_ids: userIds,
    });
    if (error) {
      throw new Error(`analytics_member_profiles failed: ${error.message}`);
    }
    const profiles = new Map((data ?? []).map((profile) => [profile.user_id, profile]));
    const members: AnalyticsMember[] = refs.map((ref) => {
      const profile = profiles.get(ref.user_id);
      return {
        userId: ref.user_id,
        username: profile?.username ?? null,
        fullName: profile?.full_name ?? null,
        signedUpAt: profile?.signed_up_at ?? null,
        lastActiveDay: profile?.last_active_day ?? null,
        ...(ref.festival_id ? { festivalId: ref.festival_id } : {}),
        ...(ref.festival_name ? { festivalName: ref.festival_name } : {}),
      };
    });
    return { members: sortMembers(members), truncated };
  }
}
