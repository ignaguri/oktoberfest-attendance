import type { Database, TablesUpdate } from "@prostcounter/db";
import type {
  CarryOverCandidate,
  CreateGroupInput,
  Group,
  GroupGalleryPhoto,
  GroupMember,
  GroupWithMembers,
  ListGroupsQuery,
  SearchGroupResult,
  SearchGroupsQuery,
  UpdateGroupInput,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import { ConflictError, DatabaseError, ForbiddenError, NotFoundError } from "../../middleware/error";
import type { IGroupRepository } from "../interfaces";

// Mapping between winning criteria strings and database IDs
const WINNING_CRITERIA_MAP: Record<string, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

const WINNING_CRITERIA_REVERSE_MAP: Record<number, "days_attended" | "total_beers" | "avg_beers"> =
  {
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
      throw new DatabaseError(`Invalid winning criteria: ${data.winningCriteria}`);
    }

    // Use SECURITY DEFINER function to bypass RLS
    // This function creates the group AND adds the creator as a member atomically
    const { data: result, error } = await this.supabase.rpc("create_group_with_member", {
      p_group_name: data.name,
      p_user_id: userId,
      p_festival_id: data.festivalId,
      p_winning_criteria_id: winningCriteriaId,
    });

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
      winningCriteria: WINNING_CRITERIA_REVERSE_MAP[group.winning_criteria_id] || "total_beers",
      inviteToken: group.invite_token,
      createdBy: group.created_by,
      createdAt: group.created_at,
      updatedAt: group.created_at, // Same as createdAt for new groups
    };
  }

  async listUserGroups(userId: string, query?: ListGroupsQuery): Promise<GroupWithMembers[]> {
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

    if (error && error.code === PgErrorCode.NO_ROWS) {
      return null;
    }

    if (error || !data) {
      throw new DatabaseError(`Failed to fetch group: ${error?.message || "No data returned"}`);
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

    if (error && error.code === PgErrorCode.NO_ROWS) {
      return null;
    }

    if (error || !data) {
      throw new DatabaseError(`Failed to fetch group: ${error?.message || "No data returned"}`);
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
    const { data: deleted, error } = await this.supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .select("user_id");

    if (error) {
      throw new DatabaseError(`Failed to remove member: ${error.message}`);
    }

    if (!deleted || deleted.length === 0) {
      throw new DatabaseError(
        `Group member removal affected 0 rows for group=${groupId}, user=${userId}; not a member or RLS policy blocked`,
      );
    }
  }

  async update(groupId: string, data: UpdateGroupInput): Promise<Group> {
    const updateData: TablesUpdate<"groups"> = {};

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

    if (error || !group) {
      throw new DatabaseError(`Failed to update group: ${error?.message || "No data returned"}`);
    }

    return this.mapToGroup(group);
  }

  async isCreator(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    if (error || !data) {
      throw new DatabaseError(`Failed to check creator: ${error?.message || "No data returned"}`);
    }

    return data.created_by === userId;
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

    if (error || !data) {
      throw new DatabaseError(
        `Failed to renew invite token: ${error?.message || "No data returned"}`,
      );
    }

    if (!data.invite_token) {
      throw new DatabaseError("Failed to renew invite token: no token returned");
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
      throw new DatabaseError(`Failed to get group members: ${membersError.message}`);
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
      throw new DatabaseError(`Failed to get group gallery: ${photosError.message}`);
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

  async listCarryOverCandidates(
    userId: string,
    targetFestivalId: string,
  ): Promise<CarryOverCandidate[]> {
    // "Past" has to mean earlier than the target, not merely different: .neq
    // alone also offers groups from festivals that have not started yet.
    const { data: target, error: targetError } = await this.supabase
      .from("festivals")
      .select("start_date")
      .eq("id", targetFestivalId)
      .maybeSingle();

    if (targetError) {
      throw new DatabaseError(`Failed to list carry-over candidates: ${targetError.message}`);
    }

    if (!target) {
      return [];
    }

    // Groups the caller created in an earlier festival.
    const { data: pastGroups, error: pastError } = await this.supabase
      .from("groups")
      .select(
        `
        id,
        name,
        winning_criteria_id,
        festival_id,
        festivals!groups_festival_id_fkey!inner (id, name, start_date)
      `,
      )
      .eq("created_by", userId)
      .neq("festival_id", targetFestivalId)
      .lt("festivals.start_date", target.start_date);

    if (pastError) {
      throw new DatabaseError(`Failed to list carry-over candidates: ${pastError.message}`);
    }

    if (!pastGroups || pastGroups.length === 0) {
      return [];
    }

    // Groups already in the target festival that continue one of those.
    // RLS limits this to groups the caller belongs to, which is exactly right:
    // create_group_with_member always makes the creator a member.
    const { data: existingGroups, error: existingError } = await this.supabase
      .from("groups")
      .select("carried_over_from")
      .eq("festival_id", targetFestivalId)
      .not("carried_over_from", "is", null);

    if (existingError) {
      throw new DatabaseError(`Failed to list carry-over candidates: ${existingError.message}`);
    }

    const alreadyCarriedOver = new Set(
      (existingGroups || [])
        .map((group) => group.carried_over_from)
        .filter((id): id is string => id !== null),
    );

    const remaining = (pastGroups as any[]).filter((group) => !alreadyCarriedOver.has(group.id));

    if (remaining.length === 0) {
      return [];
    }

    // Newest source festival first. Sorted before mapping so the start date does
    // not have to travel on the returned CarryOverCandidate shape.
    remaining.sort((a, b) =>
      (b.festivals?.start_date || "").localeCompare(a.festivals?.start_date || ""),
    );

    // A crew that has run for several festivals leaves one candidate per year,
    // all with the same name. Only the newest can be carried over: UNIQUE
    // (name, festival_id) makes every later one a guaranteed GROUP_NAME_TAKEN.
    // Relies on the sort above having put the newest first.
    const seenNames = new Set<string>();
    const newestPerName = remaining.filter((group) => {
      if (seenNames.has(group.name)) {
        return false;
      }
      seenNames.add(group.name);
      return true;
    });

    // One query for every candidate's members rather than a head-count per
    // candidate: this runs on the groups tab, and a per-row count also swallowed
    // its own error, quietly rendering "0 members" for a query that failed.
    const { data: memberRows, error: memberError } = await this.supabase
      .from("group_members")
      .select("group_id")
      .in(
        "group_id",
        newestPerName.map((group) => group.id),
      );

    if (memberError) {
      throw new DatabaseError(`Failed to count carry-over members: ${memberError.message}`);
    }

    const memberCounts = new Map<string, number>();
    for (const row of memberRows ?? []) {
      if (row.group_id) {
        memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
      }
    }

    return newestPerName.map((group) => ({
      groupId: group.id,
      name: group.name,
      winningCriteria: WINNING_CRITERIA_REVERSE_MAP[group.winning_criteria_id] || "total_beers",
      memberCount: memberCounts.get(group.id) ?? 0,
      sourceFestivalId: group.festival_id,
      sourceFestivalName: group.festivals?.name || "",
    }));
  }

  async findCarryOverTarget(
    sourceGroupId: string,
    targetFestivalId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("groups")
      .select("id")
      .eq("carried_over_from", sourceGroupId)
      .eq("festival_id", targetFestivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to check existing carry-over: ${error.message}`);
    }

    return data?.id ?? null;
  }

  async carryOver(userId: string, sourceGroupId: string, targetFestivalId: string): Promise<Group> {
    const source = await this.findById(sourceGroupId);
    if (!source) {
      throw new NotFoundError(ErrorCodes.GROUP_NOT_FOUND);
    }

    const winningCriteriaId = WINNING_CRITERIA_MAP[source.winningCriteria];
    if (!winningCriteriaId) {
      throw new DatabaseError(`Invalid winning criteria: ${source.winningCriteria}`);
    }

    const { data: result, error } = await this.supabase.rpc("create_group_with_member", {
      p_group_name: source.name,
      p_user_id: userId,
      p_festival_id: targetFestivalId,
      p_winning_criteria_id: winningCriteriaId,
      p_carried_over_from: sourceGroupId,
    });

    if (error) {
      if (error.code === PgErrorCode.UNIQUE_VIOLATION) {
        // Two unique constraints can fire here. The partial index means another
        // request won the race to carry this group into this festival, which is
        // the same answer the service-level check gives; anything else is
        // UNIQUE (name, festival_id), i.e. the creator already made a group with
        // this name in the target festival by hand.
        const violated = `${error.message} ${error.details ?? ""}`;
        throw new ConflictError(
          violated.includes("idx_groups_carried_over_from_festival")
            ? ErrorCodes.GROUP_ALREADY_CARRIED_OVER
            : ErrorCodes.GROUP_NAME_TAKEN,
        );
      }
      // The function re-checks source ownership itself, so this is reachable
      // even though the service already ran isCreator.
      if (error.code === PgErrorCode.INSUFFICIENT_PRIVILEGE) {
        throw new ForbiddenError(ErrorCodes.NOT_GROUP_CREATOR);
      }
      throw new DatabaseError(`Failed to carry over group: ${error.message}`);
    }

    if (!result || result.length === 0) {
      throw new DatabaseError("Failed to carry over group: no data returned");
    }

    const group = result[0];

    return {
      id: group.group_id,
      name: group.group_name,
      festivalId: group.festival_id,
      winningCriteria: WINNING_CRITERIA_REVERSE_MAP[group.winning_criteria_id] || "total_beers",
      inviteToken: group.invite_token,
      createdBy: group.created_by,
      carriedOverFrom: group.carried_over_from,
      createdAt: group.created_at,
      updatedAt: group.created_at, // groups has no updated_at column
    };
  }

  async getFestivalSchedule(
    festivalId: string,
  ): Promise<{ endDate: string; timezone: string | null } | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("end_date, timezone")
      .eq("id", festivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch festival: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return { endDate: data.end_date, timezone: data.timezone };
  }

  private mapToGroup(data: any): Group {
    // Extract winning criteria name from joined table or use reverse map
    let winningCriteria: "days_attended" | "total_beers" | "avg_beers";
    if (data.winning_criteria && typeof data.winning_criteria === "object") {
      winningCriteria = data.winning_criteria.name as "days_attended" | "total_beers" | "avg_beers";
    } else if (data.winning_criteria_id) {
      winningCriteria = WINNING_CRITERIA_REVERSE_MAP[data.winning_criteria_id] || "total_beers";
    } else {
      winningCriteria = "total_beers"; // Fallback
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || null,
      festivalId: data.festival_id,
      winningCriteria,
      inviteToken: data.invite_token,
      createdBy: data.created_by,
      carriedOverFrom: data.carried_over_from ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
