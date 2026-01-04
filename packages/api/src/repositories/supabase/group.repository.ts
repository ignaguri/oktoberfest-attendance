import type { IGroupRepository } from "../interfaces";
import type { Database } from "@prostcounter/db";
import type {
  Group,
  GroupWithMembers,
  CreateGroupInput,
  UpdateGroupInput,
  ListGroupsQuery,
  SearchGroupsQuery,
  SearchGroupResult,
  GroupMember,
  GroupGalleryPhoto,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DatabaseError,
  NotFoundError,
  ConflictError,
} from "../../middleware/error";

// Mapping between winning criteria strings and database IDs
const WINNING_CRITERIA_MAP: Record<string, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

const WINNING_CRITERIA_REVERSE_MAP: Record<
  number,
  "days_attended" | "total_beers" | "avg_beers"
> = {
  1: "days_attended",
  2: "total_beers",
  3: "avg_beers",
};

export class SupabaseGroupRepository implements IGroupRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(userId: string, data: CreateGroupInput): Promise<Group> {
    // Map winning criteria string to ID
    const winningCriteriaId = WINNING_CRITERIA_MAP[data.winningCriteria];
    if (!winningCriteriaId) {
      throw new DatabaseError(
        `Invalid winning criteria: ${data.winningCriteria}`,
      );
    }

    // Use SECURITY DEFINER function to bypass RLS
    // This function creates the group AND adds the creator as a member atomically
    const { data: result, error } = await this.supabase.rpc(
      "create_group_with_member",
      {
        p_group_name: data.name,
        p_user_id: userId,
        p_festival_id: data.festivalId,
        p_winning_criteria_id: winningCriteriaId,
      },
    );

    if (error) {
      throw new DatabaseError(`Failed to create group: ${error.message}`);
    }

    if (!result || result.length === 0) {
      throw new DatabaseError("Failed to create group: no data returned");
    }

    const group = result[0];

    return {
      id: group.group_id,
      name: group.group_name,
      festivalId: group.festival_id,
      winningCriteria:
        WINNING_CRITERIA_REVERSE_MAP[group.winning_criteria_id] ||
        "total_beers",
      inviteToken: group.invite_token,
      createdBy: group.created_by,
      createdAt: group.created_at,
      updatedAt: group.created_at, // Same as createdAt for new groups
    };
  }

  async listUserGroups(
    userId: string,
    query?: ListGroupsQuery,
  ): Promise<GroupWithMembers[]> {
    let supabaseQuery = this.supabase
      .from("groups")
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name),
        group_members!inner(user_id)
      `,
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
      }),
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
      `,
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
      `,
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

  async update(groupId: string, data: UpdateGroupInput): Promise<Group> {
    // Build update object
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.winningCriteriaId !== undefined) {
      updateData.winning_criteria_id = data.winningCriteriaId;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    const { data: group, error } = await this.supabase
      .from("groups")
      .update(updateData)
      .eq("id", groupId)
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name)
      `,
      )
      .single();

    if (error) {
      throw new DatabaseError(`Failed to update group: ${error.message}`);
    }

    return this.mapToGroup(group);
  }

  async isCreator(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    if (error) {
      throw new DatabaseError(`Failed to check creator: ${error.message}`);
    }

    return data?.created_by === userId;
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

  async search(query: SearchGroupsQuery): Promise<SearchGroupResult[]> {
    let supabaseQuery = this.supabase
      .from("groups")
      .select(
        `
        id,
        name,
        festival_id,
        group_members(count)
      `,
      )
      .ilike("name", `%${query.name}%`)
      .limit(query.limit);

    if (query.festivalId) {
      supabaseQuery = supabaseQuery.eq("festival_id", query.festivalId);
    }

    supabaseQuery = supabaseQuery.order("name", { ascending: true });

    const { data, error } = await supabaseQuery;

    if (error) {
      throw new DatabaseError(`Failed to search groups: ${error.message}`);
    }

    return (data || []).map((group: any) => ({
      id: group.id,
      name: group.name,
      festivalId: group.festival_id,
      memberCount: group.group_members?.[0]?.count || 0,
    }));
  }

  async getMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await this.supabase
      .from("group_members")
      .select(
        `
        user_id,
        joined_at,
        profiles!inner (
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to get group members: ${error.message}`);
    }

    return (data || []).map((member: any) => ({
      userId: member.user_id,
      username: member.profiles?.username || "Unknown",
      fullName: member.profiles?.full_name || null,
      avatarUrl: member.profiles?.avatar_url || null,
      joinedAt: member.joined_at,
    }));
  }

  async renewInviteToken(groupId: string): Promise<string> {
    // Generate new token using crypto - must be a valid UUID for the database column
    const newToken = crypto.randomUUID();

    const { data, error } = await this.supabase
      .from("groups")
      .update({ invite_token: newToken })
      .eq("id", groupId)
      .select("invite_token")
      .single();

    if (error) {
      throw new DatabaseError(`Failed to renew invite token: ${error.message}`);
    }

    if (!data.invite_token) {
      throw new DatabaseError(
        "Failed to renew invite token: no token returned",
      );
    }

    return data.invite_token;
  }

  async getGallery(groupId: string): Promise<GroupGalleryPhoto[]> {
    // Get group to verify it exists and get festival_id
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundError("Group not found");
    }

    // Get all group member user IDs
    const { data: members, error: membersError } = await this.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (membersError) {
      throw new DatabaseError(
        `Failed to get group members: ${membersError.message}`,
      );
    }

    const memberIds = (members || [])
      .map((m) => m.user_id)
      .filter((id): id is string => id !== null);

    if (memberIds.length === 0) {
      return [];
    }

    // Get photos from beer_pictures for all members in this festival
    const { data: photos, error: photosError } = await this.supabase
      .from("beer_pictures")
      .select(
        `
        id,
        user_id,
        picture_url,
        created_at,
        attendances!inner (
          date,
          festival_id
        ),
        profiles!inner (
          username,
          full_name,
          avatar_url
        )
      `,
      )
      .in("user_id", memberIds)
      .eq("attendances.festival_id", group.festivalId)
      .eq("visibility", "public")
      .order("created_at", { ascending: false });

    if (photosError) {
      throw new DatabaseError(
        `Failed to get group gallery: ${photosError.message}`,
      );
    }

    return (photos || []).map((photo: any) => ({
      id: photo.id,
      userId: photo.user_id,
      username: photo.profiles?.username || "Unknown",
      fullName: photo.profiles?.full_name || null,
      avatarUrl: photo.profiles?.avatar_url || null,
      pictureUrl: photo.picture_url,
      date: photo.attendances?.date || "",
      createdAt: photo.created_at,
    }));
  }

  private mapToGroup(data: any): Group {
    // Extract winning criteria name from joined table or use reverse map
    let winningCriteria: "days_attended" | "total_beers" | "avg_beers";
    if (data.winning_criteria && typeof data.winning_criteria === "object") {
      winningCriteria = data.winning_criteria.name as
        | "days_attended"
        | "total_beers"
        | "avg_beers";
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
