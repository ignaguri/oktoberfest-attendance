import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";
import type {
  Group,
  GroupWithMembers,
  CreateGroupInput,
  ListGroupsQuery,
} from "@prostcounter/shared";
import type { IGroupRepository } from "../interfaces";
import { DatabaseError, NotFoundError, ConflictError } from "../../middleware/error";
import { randomUUID, randomBytes } from "crypto";

// Mapping between winning criteria strings and database IDs
const WINNING_CRITERIA_MAP: Record<string, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

const WINNING_CRITERIA_REVERSE_MAP: Record<number, "days_attended" | "total_beers" | "avg_beers"> = {
  1: "days_attended",
  2: "total_beers",
  3: "avg_beers",
};

export class SupabaseGroupRepository implements IGroupRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(userId: string, data: CreateGroupInput): Promise<Group> {
    // Generate unique invite token as UUID
    const inviteToken = randomUUID();

    // Generate a secure random password (required by database schema)
    // Note: We use invite tokens for sharing, but DB requires password
    const password = randomBytes(32).toString("hex");

    // Map winning criteria string to ID
    const winningCriteriaId = WINNING_CRITERIA_MAP[data.winningCriteria];
    if (!winningCriteriaId) {
      throw new DatabaseError(
        `Invalid winning criteria: ${data.winningCriteria}`
      );
    }

    const { data: group, error } = await this.supabase
      .from("groups")
      .insert({
        name: data.name,
        password: password,
        festival_id: data.festivalId,
        winning_criteria_id: winningCriteriaId,
        invite_token: inviteToken,
        created_by: userId,
      })
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name)
      `
      )
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create group: ${error.message}`);
    }

    // Automatically add creator as member
    await this.addMember(group.id, userId);

    return this.mapToGroup(group);
  }

  async listUserGroups(
    userId: string,
    query?: ListGroupsQuery
  ): Promise<GroupWithMembers[]> {
    let supabaseQuery = this.supabase
      .from("groups")
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name),
        group_members!inner(user_id)
      `
      )
      .eq("group_members.user_id", userId);

    if (query?.festivalId) {
      supabaseQuery = supabaseQuery.eq("festival_id", query.festivalId);
    }

    supabaseQuery = supabaseQuery.order("created_at", { ascending: false });

    const { data, error } = await supabaseQuery;

    if (error) {
      throw new DatabaseError(`Failed to list groups: ${error.message}`);
    }

    // Get member counts for each group
    const groupsWithCounts = await Promise.all(
      data.map(async (group) => {
        const { count } = await this.supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        return {
          ...this.mapToGroup(group),
          memberCount: count || 0,
        };
      })
    );

    return groupsWithCounts;
  }

  async findById(id: string): Promise<GroupWithMembers | null> {
    const { data, error } = await this.supabase
      .from("groups")
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new DatabaseError(`Failed to fetch group: ${error.message}`);
    }

    // Get member count
    const { count } = await this.supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", id);

    return {
      ...this.mapToGroup(data),
      memberCount: count || 0,
    };
  }

  async findByInviteToken(inviteToken: string): Promise<Group | null> {
    const { data, error } = await this.supabase
      .from("groups")
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name)
      `
      )
      .eq("invite_token", inviteToken)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new DatabaseError(`Failed to fetch group: ${error.message}`);
    }

    return this.mapToGroup(data);
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    // Check if already a member
    const isMember = await this.isMember(groupId, userId);
    if (isMember) {
      throw new ConflictError("User is already a member of this group");
    }

    // Get group to verify festival
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundError("Group not found");
    }

    const { error } = await this.supabase.from("group_members").insert({
      group_id: groupId,
      user_id: userId,
    });

    if (error) {
      throw new DatabaseError(`Failed to add member: ${error.message}`);
    }
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) {
      throw new DatabaseError(`Failed to remove member: ${error.message}`);
    }
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to check membership: ${error.message}`);
    }

    return data !== null;
  }

  private mapToGroup(data: any): Group {
    // Extract winning criteria name from joined table or use reverse map
    let winningCriteria: "days_attended" | "total_beers" | "avg_beers";
    if (data.winning_criteria && typeof data.winning_criteria === "object") {
      winningCriteria = data.winning_criteria.name as "days_attended" | "total_beers" | "avg_beers";
    } else if (data.winning_criteria_id) {
      winningCriteria =
        WINNING_CRITERIA_REVERSE_MAP[data.winning_criteria_id] || "total_beers";
    } else {
      winningCriteria = "total_beers"; // Fallback
    }

    return {
      id: data.id,
      name: data.name,
      festivalId: data.festival_id,
      winningCriteria,
      inviteToken: data.invite_token,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
