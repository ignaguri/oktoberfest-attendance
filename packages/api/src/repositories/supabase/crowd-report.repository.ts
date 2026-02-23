import type {
  CrowdLevel,
  CrowdReportWithUser,
  SubmitCrowdReportBody,
  TentCrowdStatus,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { ICrowdReportRepository } from "../interfaces";

export class SupabaseCrowdReportRepository implements ICrowdReportRepository {
  constructor(private supabase: SupabaseClient) {}

  async getCrowdStatus(festivalId: string): Promise<TentCrowdStatus[]> {
    const { data, error } = await this.supabase
      .from("tent_crowd_status")
      .select("*")
      .or(`festival_id.eq.${festivalId},festival_id.is.null`);

    if (error) {
      throw new DatabaseError(`Failed to fetch crowd status: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      tentId: row.tent_id,
      tentName: row.tent_name,
      festivalId: row.festival_id,
      reportCount: Number(row.report_count) || 0,
      crowdLevel: row.crowd_level,
      avgWaitMinutes: row.avg_wait_minutes
        ? Number(row.avg_wait_minutes)
        : null,
      lastReportedAt: row.last_reported_at,
    }));
  }

  async getTentReports(
    tentId: string,
    festivalId: string,
  ): Promise<CrowdReportWithUser[]> {
    // Get reports from last 30 minutes with user profile info
    const thirtyMinutesAgo = new Date(
      Date.now() - 30 * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabase
      .from("tent_crowd_reports")
      .select(
        `
        id,
        tent_id,
        festival_id,
        user_id,
        crowd_level,
        wait_time_minutes,
        created_at,
        profiles!tent_crowd_reports_user_id_fkey (
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq("tent_id", tentId)
      .eq("festival_id", festivalId)
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: false });

    if (error) {
      // If the foreign key name doesn't match, try without the hint
      if (error.message.includes("profiles")) {
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from("tent_crowd_reports")
          .select(
            `
            id,
            tent_id,
            festival_id,
            user_id,
            crowd_level,
            wait_time_minutes,
            created_at
          `,
          )
          .eq("tent_id", tentId)
          .eq("festival_id", festivalId)
          .gte("created_at", thirtyMinutesAgo)
          .order("created_at", { ascending: false });

        if (fallbackError) {
          throw new DatabaseError(
            `Failed to fetch tent reports: ${fallbackError.message}`,
          );
        }

        // Fetch profiles separately
        const userIds = (fallbackData ?? []).map((r) => r.user_id);
        const { data: profiles } = await this.supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);

        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

        return (fallbackData ?? []).map((row) => {
          const profile = profileMap.get(row.user_id);
          return {
            id: row.id,
            tentId: row.tent_id,
            festivalId: row.festival_id,
            userId: row.user_id,
            crowdLevel: row.crowd_level,
            waitTimeMinutes: row.wait_time_minutes,
            createdAt: row.created_at,
            username: profile?.username ?? "Unknown",
            fullName: profile?.full_name ?? null,
            avatarUrl: profile?.avatar_url ?? null,
          };
        });
      }

      throw new DatabaseError(`Failed to fetch tent reports: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const profile = row.profiles as any;
      return {
        id: row.id,
        tentId: row.tent_id,
        festivalId: row.festival_id,
        userId: row.user_id,
        crowdLevel: row.crowd_level,
        waitTimeMinutes: row.wait_time_minutes,
        createdAt: row.created_at,
        username: profile?.username ?? "Unknown",
        fullName: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      };
    });
  }

  async submitReport(
    tentId: string,
    userId: string,
    data: SubmitCrowdReportBody,
  ): Promise<{
    id: string;
    crowdLevel: CrowdLevel;
    waitTimeMinutes: number | null;
    createdAt: string;
  }> {
    const { data: report, error } = await this.supabase
      .from("tent_crowd_reports")
      .insert({
        tent_id: tentId,
        festival_id: data.festivalId,
        user_id: userId,
        crowd_level: data.crowdLevel,
        wait_time_minutes: data.waitTimeMinutes ?? null,
      })
      .select("id, crowd_level, wait_time_minutes, created_at")
      .single();

    if (error) {
      throw new DatabaseError(
        `Failed to submit crowd report: ${error.message}`,
      );
    }

    return {
      id: report.id,
      crowdLevel: report.crowd_level as CrowdLevel,
      waitTimeMinutes: report.wait_time_minutes,
      createdAt: report.created_at,
    };
  }

  async hasRecentReport(tentId: string, userId: string): Promise<boolean> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count, error } = await this.supabase
      .from("tent_crowd_reports")
      .select("id", { count: "exact", head: true })
      .eq("tent_id", tentId)
      .eq("user_id", userId)
      .gte("created_at", fiveMinutesAgo);

    if (error) {
      throw new DatabaseError(
        `Failed to check recent reports: ${error.message}`,
      );
    }

    return (count ?? 0) > 0;
  }
}
