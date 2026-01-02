import type { ILeaderboardRepository } from "../interfaces";
import type { Database } from "@prostcounter/db";
import type {
  LeaderboardEntry,
  GlobalLeaderboardQuery,
  GroupLeaderboardQuery,
  WinningCriteriaOption,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";

// Mapping between winning criteria strings and database IDs
const WINNING_CRITERIA_MAP: Record<string, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

export class SupabaseLeaderboardRepository implements ILeaderboardRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getGlobal(
    query: GlobalLeaderboardQuery,
  ): Promise<{ data: LeaderboardEntry[]; total: number }> {
    const { festivalId, sortBy, limit, offset } = query;

    // Map winning criteria string to ID
    const winningCriteriaId = WINNING_CRITERIA_MAP[sortBy] || 2; // Default to total_beers

    // Call database function for global leaderboard
    // Note: Function doesn't support pagination, we'll handle it client-side
    const { data, error } = await this.supabase.rpc("get_global_leaderboard", {
      p_winning_criteria_id: winningCriteriaId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(
        `Failed to fetch global leaderboard: ${error.message}`,
      );
    }

    // Apply pagination client-side since DB function doesn't support it
    const total = data?.length || 0;
    const paginatedData = data?.slice(offset, offset + limit) || [];

    return {
      data: paginatedData.map((item: any, index: number) => ({
        ...this.mapToLeaderboardEntry(item),
        position: offset + index + 1,
      })),
      total,
    };
  }

  async getForGroup(
    groupId: string,
    query?: GroupLeaderboardQuery,
  ): Promise<LeaderboardEntry[]> {
    // Get group to determine winning criteria (default sort)
    const { data: group, error: groupError } = await this.supabase
      .from("groups")
      .select("winning_criteria_id, festival_id")
      .eq("id", groupId)
      .single();

    if (groupError) {
      throw new DatabaseError(`Failed to fetch group: ${groupError.message}`);
    }

    // Use query sortBy if provided, otherwise use group's winning criteria
    let winningCriteriaId = group.winning_criteria_id;
    if (query?.sortBy) {
      winningCriteriaId =
        WINNING_CRITERIA_MAP[query.sortBy] || group.winning_criteria_id;
    }

    // Call database function for group leaderboard
    const { data, error } = await this.supabase.rpc("get_group_leaderboard", {
      p_group_id: groupId,
      p_winning_criteria_id: winningCriteriaId,
    });

    if (error) {
      throw new DatabaseError(
        `Failed to fetch group leaderboard: ${error.message}`,
      );
    }

    return data.map((item: any, index: number) => ({
      ...this.mapToLeaderboardEntry(item),
      position: index + 1,
    }));
  }

  async getWinningCriteria(): Promise<WinningCriteriaOption[]> {
    const { data, error } = await this.supabase
      .from("winning_criteria")
      .select("id, name")
      .order("id");

    if (error) {
      throw new DatabaseError(
        `Failed to fetch winning criteria: ${error.message}`,
      );
    }

    return data || [];
  }

  private mapToLeaderboardEntry(data: any): LeaderboardEntry {
    return {
      userId: data.user_id,
      username: data.username,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      daysAttended: data.days_attended || 0,
      totalBeers: data.total_beers || 0,
      avgBeers: parseFloat(data.avg_beers || "0"),
      position: data.position || 0,
      groupCount: data.group_count || 0,
    };
  }
}
