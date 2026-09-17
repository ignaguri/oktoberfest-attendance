import type { Database } from "@prostcounter/db";
import type { FriendsWentRows } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IFriendsWentRepository } from "../interfaces";

/**
 * UTC bounds wide enough to hold every instant that can fall on `date` in a
 * festival's timezone. The grouping keeps only visits on the festival day.
 */
function festivalDayWindow(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

function emptyRows(): FriendsWentRows {
  return {
    attendances: [],
    profiles: [],
    consumptions: [],
    tentVisits: [],
    photos: [],
    viewerGroups: [],
    groupMemberships: [],
  };
}

export class SupabaseFriendsWentRepository implements IFriendsWentRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getFestivalTimezone(festivalId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("timezone")
      .eq("id", festivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch festival: ${error.message}`);
    }

    return data ? data.timezone : null;
  }

  async listDayRows(viewerId: string, festivalId: string, date: string): Promise<FriendsWentRows> {
    const [friendshipsResult, sharedGroupMembersResult] = await Promise.all([
      this.supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`),
      this.supabase
        .from("v_user_shared_group_members")
        .select("owner_id")
        .eq("viewer_id", viewerId)
        .eq("festival_id", festivalId),
    ]);

    if (friendshipsResult.error) {
      throw new DatabaseError(`Failed to list friendships: ${friendshipsResult.error.message}`);
    }
    if (sharedGroupMembersResult.error) {
      throw new DatabaseError(
        `Failed to list shared group members: ${sharedGroupMembersResult.error.message}`,
      );
    }

    const friendIds = (friendshipsResult.data ?? []).map((row) =>
      row.requester_id === viewerId ? row.addressee_id : row.requester_id,
    );
    const sharedGroupOwnerIds = (sharedGroupMembersResult.data ?? []).flatMap((row) =>
      row.owner_id ? [row.owner_id] : [],
    );

    const allowedUserIds = new Set([...friendIds, ...sharedGroupOwnerIds]);
    allowedUserIds.delete(viewerId);

    if (allowedUserIds.size === 0) {
      return emptyRows();
    }

    const { data: attendanceData, error: attendanceError } = await this.supabase
      .from("attendances")
      .select("id, user_id")
      .eq("festival_id", festivalId)
      .eq("date", date)
      .neq("user_id", viewerId)
      .in("user_id", [...allowedUserIds]);

    if (attendanceError) {
      throw new DatabaseError(`Failed to list friends' attendance: ${attendanceError.message}`);
    }

    const attendances = (attendanceData ?? []).flatMap((row) =>
      row.user_id ? [{ attendanceId: row.id, userId: row.user_id }] : [],
    );

    if (attendances.length === 0) {
      return emptyRows();
    }

    const attendanceIds = attendances.map((attendance) => attendance.attendanceId);
    const userIds = [...new Set(attendances.map((attendance) => attendance.userId))];
    const window = festivalDayWindow(date);

    const [profilesResult, consumptionsResult, visitsResult, photosResult, viewerGroupsResult] =
      await Promise.all([
        this.supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds),
        this.supabase
          .from("consumptions")
          .select("attendance_id, drink_type")
          .in("attendance_id", attendanceIds),
        this.supabase
          .from("tent_visits")
          .select("user_id, visit_date, tents(name)")
          .eq("festival_id", festivalId)
          .in("user_id", userIds)
          .gte("visit_date", window.start)
          .lt("visit_date", window.end)
          .order("visit_date", { ascending: true }),
        this.supabase
          .from("beer_pictures")
          .select("id, attendance_id, picture_url, created_at")
          .in("attendance_id", attendanceIds)
          .eq("visibility", "public"),
        this.supabase
          .from("group_members")
          .select("group_id, joined_at, groups!inner(festival_id)")
          .eq("user_id", viewerId)
          .eq("groups.festival_id", festivalId),
      ]);

    if (profilesResult.error) {
      throw new DatabaseError(`Failed to fetch friends' profiles: ${profilesResult.error.message}`);
    }
    if (consumptionsResult.error) {
      throw new DatabaseError(
        `Failed to fetch friends' consumptions: ${consumptionsResult.error.message}`,
      );
    }
    if (visitsResult.error) {
      throw new DatabaseError(`Failed to fetch friends' tent visits: ${visitsResult.error.message}`);
    }
    if (photosResult.error) {
      throw new DatabaseError(`Failed to fetch friends' photos: ${photosResult.error.message}`);
    }
    if (viewerGroupsResult.error) {
      throw new DatabaseError(`Failed to fetch viewer's groups: ${viewerGroupsResult.error.message}`);
    }

    const viewerGroups = (viewerGroupsResult.data ?? []).flatMap((row) =>
      row.group_id ? [{ groupId: row.group_id, joinedAt: row.joined_at }] : [],
    );

    let groupMemberships: FriendsWentRows["groupMemberships"] = [];

    if (viewerGroups.length > 0) {
      const { data: membershipData, error: membershipError } = await this.supabase
        .from("group_members")
        .select("group_id, user_id")
        .in(
          "group_id",
          viewerGroups.map((group) => group.groupId),
        )
        .in("user_id", userIds);

      if (membershipError) {
        throw new DatabaseError(`Failed to fetch shared groups: ${membershipError.message}`);
      }

      groupMemberships = (membershipData ?? []).flatMap((row) =>
        row.group_id && row.user_id ? [{ groupId: row.group_id, userId: row.user_id }] : [],
      );
    }

    return {
      attendances,
      profiles: (profilesResult.data ?? []).map((row) => ({
        userId: row.id,
        username: row.username,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
      })),
      consumptions: (consumptionsResult.data ?? []).map((row) => ({
        attendanceId: row.attendance_id,
        drinkType: row.drink_type,
      })),
      tentVisits: (visitsResult.data ?? []).flatMap((row) =>
        row.visit_date
          ? [{ userId: row.user_id, tentName: row.tents?.name ?? null, visitDate: row.visit_date }]
          : [],
      ),
      photos: (photosResult.data ?? []).map((row) => ({
        id: row.id,
        attendanceId: row.attendance_id,
        pictureUrl: row.picture_url,
        createdAt: row.created_at,
      })),
      viewerGroups,
      groupMemberships,
    };
  }
}
