import type { Database } from "@prostcounter/db";
import type {
  GetAvatarUploadUrlQuery,
  GetAvatarUploadUrlResponse,
  Highlights,
  MissingProfileFields,
  Profile,
  ProfileDayRow,
  ProfileDetail,
  ProfileHistoryRow,
  ProfileShort,
  ProfileSharedGroup,
  PublicProfile,
  TutorialStatus,
  UpdateProfileInput,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase, replaceLocalhostInUrl } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import { ConflictError, DatabaseError, NotFoundError } from "../../middleware/error";

/**
 * PostgREST caps a response at `max_rows`, which is 1000 in
 * supabase/config.toml. Reads that must be complete page at that size.
 */
const PAGE_SIZE = 1000;

export class SupabaseProfileRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    return data as Profile;
  }

  async getProfileShort(userId: string, email?: string): Promise<ProfileShort> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select(
        "full_name, username, avatar_url, preferred_language, tip_mode, tip_fixed_amount, is_super_admin",
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    return {
      ...data,
      tip_mode: data.tip_mode as ProfileShort["tip_mode"],
      email: email ?? null,
    };
  }

  async getPublicProfile(
    userId: string,
    festivalId?: string,
    currentUserId?: string,
  ): Promise<PublicProfile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    let stats: PublicProfile["stats"] = null;
    let friendshipStatus: PublicProfile["friendshipStatus"] = null;
    let sharedGroups: PublicProfile["sharedGroups"] = null;

    // Fetch festival stats from user_festival_stats view if festivalId is provided
    if (festivalId) {
      const { data: statsData } = await this.supabase
        .from("user_festival_stats")
        .select("days_attended, total_beers, avg_beers")
        .eq("user_id", userId)
        .eq("festival_id", festivalId)
        .maybeSingle();

      if (statsData) {
        stats = {
          daysAttended: Number(statsData.days_attended) || 0,
          totalBeers: Number(statsData.total_beers) || 0,
          avgBeers: Number(statsData.avg_beers) || 0,
        };
      }
    }

    // Friendship status and shared groups (skip if viewing own profile)
    if (currentUserId && currentUserId !== userId) {
      // Friendship status
      const { data: friendship } = await this.supabase
        .from("friendships")
        .select("id, requester_id, status")
        .or(
          `and(requester_id.eq.${currentUserId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${currentUserId})`,
        )
        .limit(1)
        .maybeSingle();

      if (!friendship) {
        friendshipStatus = "none";
      } else if (friendship.status === "accepted") {
        friendshipStatus = "friends";
      } else if (friendship.status === "pending") {
        friendshipStatus =
          friendship.requester_id === currentUserId ? "pending_sent" : "pending_received";
      } else {
        friendshipStatus = "none";
      }

      // Shared groups count: get current user's groups, then count how many the target user is also in
      const { data: myGroups } = await this.supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUserId);

      if (myGroups && myGroups.length > 0) {
        const myGroupIds = myGroups.map((g) => g.group_id);
        const { count } = await this.supabase
          .from("group_members")
          .select("group_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("group_id", myGroupIds);
        sharedGroups = count ?? 0;
      } else {
        sharedGroups = 0;
      }
    } else if (currentUserId && currentUserId === userId) {
      friendshipStatus = "self";
    }

    return {
      id: data.id,
      username: data.username,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      stats,
      friendshipStatus,
      sharedGroups,
    };
  }

  /**
   * The profile page in one payload.
   *
   * Every gated read here runs on the viewer's JWT-scoped client, so the
   * `own OR shared-group OR is_friend()` policy on attendances and tent_visits
   * is what empties `history` and `favouriteTent` for a stranger. There is
   * deliberately no permission check in this method.
   */
  async getProfileDetail(
    userId: string,
    festivalId?: string,
    currentUserId?: string,
  ): Promise<ProfileDetail> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", userId)
      .single();

    // Typed on purpose: the route used to wrap this call in a catch-all that
    // turned every failure, including a transient database error, into a 404.
    if (error || !data) {
      throw new NotFoundError("User not found");
    }

    const [stats, relationship, sharedGroups, history, favouriteTent] = await Promise.all([
      this.fetchFestivalStats(userId, festivalId),
      this.fetchRelationship(userId, currentUserId),
      this.fetchSharedGroups(userId, currentUserId, festivalId),
      this.fetchAttendanceHistory(userId),
      this.fetchFavouriteTent(userId, festivalId),
    ]);

    return {
      id: data.id,
      username: data.username,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      stats,
      friendshipStatus: relationship.friendshipStatus,
      friendsSince: relationship.friendsSince,
      sharedGroups,
      favouriteTent,
      history,
    };
  }

  private async fetchFestivalStats(
    userId: string,
    festivalId?: string,
  ): Promise<ProfileDetail["stats"]> {
    if (!festivalId) {
      return null;
    }

    const { data } = await this.supabase
      .from("user_festival_stats")
      .select("days_attended, total_beers, avg_beers")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .maybeSingle();

    if (!data) {
      return null;
    }

    return {
      daysAttended: Number(data.days_attended) || 0,
      totalBeers: Number(data.total_beers) || 0,
      avgBeers: Number(data.avg_beers) || 0,
    };
  }

  private async fetchRelationship(
    userId: string,
    currentUserId?: string,
  ): Promise<{
    friendshipStatus: ProfileDetail["friendshipStatus"];
    friendsSince: string | null;
  }> {
    if (!currentUserId) {
      return { friendshipStatus: null, friendsSince: null };
    }
    if (currentUserId === userId) {
      return { friendshipStatus: "self", friendsSince: null };
    }

    const { data: friendship } = await this.supabase
      .from("friendships")
      .select("requester_id, status, updated_at")
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${currentUserId})`,
      )
      .limit(1)
      .maybeSingle();

    if (!friendship) {
      return { friendshipStatus: "none", friendsSince: null };
    }
    if (friendship.status === "accepted") {
      return { friendshipStatus: "friends", friendsSince: friendship.updated_at };
    }
    if (friendship.status === "pending") {
      return {
        friendshipStatus:
          friendship.requester_id === currentUserId ? "pending_sent" : "pending_received",
        friendsSince: null,
      };
    }

    return { friendshipStatus: "none", friendsSince: null };
  }

  /**
   * Groups both people belong to, in one festival.
   *
   * Scoped to the festival for the same reason the stats are: carrying a group
   * over to a new festival keeps its name, so an unscoped list shows the same
   * name several times with nothing to tell the entries apart.
   */
  private async fetchSharedGroups(
    userId: string,
    currentUserId?: string,
    festivalId?: string,
  ): Promise<ProfileSharedGroup[]> {
    if (!currentUserId || currentUserId === userId || !festivalId) {
      return [];
    }

    const { data: myGroups } = await this.supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", currentUserId);

    const myGroupIds = (myGroups ?? []).map((row) => row.group_id);
    if (myGroupIds.length === 0) {
      return [];
    }

    const { data: shared } = await this.supabase
      .from("group_members")
      .select("group_id, groups!inner(id, name, festival_id)")
      .eq("user_id", userId)
      .in("group_id", myGroupIds)
      .eq("groups.festival_id", festivalId);

    return (shared ?? []).flatMap((row) =>
      row.groups ? [{ id: row.groups.id, name: row.groups.name }] : [],
    );
  }

  /**
   * The festival list comes from `attendances`, never from `user_festival_stats`.
   * That view is not security_invoker, so reading the list from it would hand a
   * stranger every festival the user ever attended.
   */
  private async fetchAttendanceHistory(userId: string): Promise<ProfileHistoryRow[]> {
    // Read in pages: PostgREST truncates at `max_rows` (1000, see
    // supabase/config.toml), which would silently drop festivals from a history
    // this endpoint promises in full.
    const festivalIdSet = new Set<string>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await this.supabase
        .from("attendances")
        .select("festival_id")
        .eq("user_id", userId)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new DatabaseError(`Failed to list attendance history: ${error.message}`);
      }

      const rows = data ?? [];
      for (const row of rows) {
        if (row.festival_id) {
          festivalIdSet.add(row.festival_id);
        }
      }

      if (rows.length < PAGE_SIZE) {
        break;
      }
    }

    const festivalIds = [...festivalIdSet];
    if (festivalIds.length === 0) {
      return [];
    }

    const [statsResult, festivalsResult] = await Promise.all([
      this.supabase
        .from("user_festival_stats")
        .select("festival_id, days_attended, total_beers, avg_beers")
        .eq("user_id", userId)
        .in("festival_id", festivalIds),
      this.supabase.from("festivals").select("id, name, start_date").in("id", festivalIds),
    ]);

    const festivals = new Map(
      (festivalsResult.data ?? []).map((row) => [
        row.id,
        { name: row.name, startDate: row.start_date },
      ]),
    );

    return (statsResult.data ?? [])
      .flatMap((row) => {
        const festival = row.festival_id ? festivals.get(row.festival_id) : undefined;
        if (!row.festival_id || !festival) {
          return [];
        }
        return [
          {
            festivalId: row.festival_id,
            festivalName: festival.name,
            daysAttended: Number(row.days_attended) || 0,
            totalBeers: Number(row.total_beers) || 0,
            avgBeers: Number(row.avg_beers) || 0,
            startDate: festival.startDate,
          },
        ];
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(({ startDate: _startDate, ...row }) => row);
  }

  private async fetchFavouriteTent(
    userId: string,
    festivalId?: string,
  ): Promise<ProfileDetail["favouriteTent"]> {
    // Paged for the same reason as the history: a truncated read would count
    // only the first page and could name the wrong tent as the favourite.
    const visitsByTent = new Map<string, number>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = this.supabase.from("tent_visits").select("tents(name)").eq("user_id", userId);

      if (festivalId) {
        query = query.eq("festival_id", festivalId);
      }

      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new DatabaseError(`Failed to list tent visits: ${error.message}`);
      }

      const rows = data ?? [];
      for (const row of rows) {
        if (!row.tents) {
          continue;
        }
        visitsByTent.set(row.tents.name, (visitsByTent.get(row.tents.name) ?? 0) + 1);
      }

      if (rows.length < PAGE_SIZE) {
        break;
      }
    }

    let favourite: { name: string; visits: number } | null = null;
    for (const [name, visits] of visitsByTent) {
      if (!favourite || visits > favourite.visits) {
        favourite = { name, visits };
      }
    }

    return favourite;
  }

  /**
   * One row per day the user attended this festival. Gated by the same RLS
   * policy as the history, so a stranger receives an empty array.
   *
   * Tent visits are timestamps but a festival day is a wall-clock day in the
   * festival's own timezone, so each visit is bucketed with
   * `formatDateForDatabase` rather than by slicing the ISO string.
   */
  async listProfileDays(userId: string, festivalId: string): Promise<ProfileDayRow[]> {
    const { data: attendanceRows, error } = await this.supabase
      .from("attendances")
      .select("id, date")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .order("date", { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to list profile days: ${error.message}`);
    }

    const attendances = (attendanceRows ?? []).flatMap((row) =>
      row.date ? [{ id: row.id, date: row.date }] : [],
    );
    if (attendances.length === 0) {
      return [];
    }

    const attendanceIds = attendances.map((attendance) => attendance.id);

    const [festivalResult, consumptionsResult, visitsResult] = await Promise.all([
      this.supabase.from("festivals").select("timezone").eq("id", festivalId).maybeSingle(),
      this.supabase.from("consumptions").select("attendance_id").in("attendance_id", attendanceIds),
      this.supabase
        .from("tent_visits")
        .select("visit_date, tents(name)")
        .eq("user_id", userId)
        .eq("festival_id", festivalId),
    ]);

    // All three are load-bearing: a discarded error here would report zero
    // drinks or no tents with a 200, making the expanded history quietly wrong.
    if (festivalResult.error) {
      throw new DatabaseError(`Failed to fetch festival: ${festivalResult.error.message}`);
    }
    if (consumptionsResult.error) {
      throw new DatabaseError(`Failed to list consumptions: ${consumptionsResult.error.message}`);
    }
    if (visitsResult.error) {
      throw new DatabaseError(`Failed to list tent visits: ${visitsResult.error.message}`);
    }

    const timezone = festivalResult.data?.timezone ?? undefined;

    const drinksByAttendance = new Map<string, number>();
    for (const row of consumptionsResult.data ?? []) {
      if (!row.attendance_id) {
        continue;
      }
      drinksByAttendance.set(
        row.attendance_id,
        (drinksByAttendance.get(row.attendance_id) ?? 0) + 1,
      );
    }

    const tentsByDate = new Map<string, Set<string>>();
    for (const row of visitsResult.data ?? []) {
      if (!row.tents || !row.visit_date) {
        continue;
      }
      const date = formatDateForDatabase(new Date(row.visit_date), timezone);
      const tents = tentsByDate.get(date) ?? new Set<string>();
      tents.add(row.tents.name);
      tentsByDate.set(date, tents);
    }

    return attendances.map((attendance) => ({
      date: attendance.date,
      totalDrinks: drinksByAttendance.get(attendance.id) ?? 0,
      tents: [...(tentsByDate.get(attendance.date) ?? [])],
    }));
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .update({
        username: input.username,
        full_name: input.full_name,
        preferred_language: input.preferred_language,
        tip_mode: input.tip_mode,
        tip_fixed_amount: input.tip_fixed_amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    // `profiles.username` is UNIQUE. Someone choosing a name another account
    // already holds is a fixable mistake, so it answers 409 with a code the
    // clients can translate rather than escaping as a 500.
    if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
      throw new ConflictError(ErrorCodes.USERNAME_TAKEN);
    }

    if (error || !data) {
      throw new Error(`Failed to update profile: ${error?.message}`);
    }

    return data as Profile;
  }

  async deleteProfile(userId: string): Promise<void> {
    // Delete user's data in order (respecting foreign keys).
    // consumptions cascade-delete via attendances (FK ON DELETE CASCADE).

    await this.supabase.from("beer_pictures").delete().eq("user_id", userId);

    await this.supabase.from("tent_visits").delete().eq("user_id", userId);

    await this.supabase.from("attendances").delete().eq("user_id", userId);

    await this.supabase.from("group_members").delete().eq("user_id", userId);

    await this.supabase.from("day_plans").delete().eq("user_id", userId);

    await this.supabase.from("user_achievements").delete().eq("user_id", userId);

    await this.supabase.from("user_notification_preferences").delete().eq("user_id", userId);

    await (this.supabase as any).from("user_locations").delete().eq("user_id", userId);
    await (this.supabase as any)
      .from("location_sharing_preferences")
      .delete()
      .eq("user_id", userId);

    const { data: deleted, error } = await this.supabase
      .from("profiles")
      .delete()
      .eq("id", userId)
      .select("id");

    if (error) {
      throw new Error(`Failed to delete profile: ${error.message}`);
    }

    if (!deleted || deleted.length === 0) {
      throw new Error(`Profile delete affected 0 rows for id=${userId}; likely RLS policy blocked`);
    }
  }

  async getTutorialStatus(userId: string): Promise<TutorialStatus> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("tutorial_completed, tutorial_completed_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to get tutorial status: ${error?.message || "No data returned"}`);
    }

    return {
      tutorial_completed: data.tutorial_completed ?? false,
      tutorial_completed_at: data.tutorial_completed_at ?? null,
    };
  }

  async completeTutorial(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("profiles")
      .update({
        tutorial_completed: true,
        tutorial_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to complete tutorial: ${error.message}`);
    }
  }

  async resetTutorial(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("profiles")
      .update({
        tutorial_completed: false,
        tutorial_completed_at: null,
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to reset tutorial: ${error.message}`);
    }
  }

  async getMissingProfileFields(userId: string): Promise<{
    missingFields: MissingProfileFields;
    hasMissingFields: boolean;
  }> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("username, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    const missingFields: MissingProfileFields = {
      username: !data.username,
      full_name: !data.full_name,
      avatar_url: !data.avatar_url,
    };

    return {
      missingFields,
      hasMissingFields: Object.values(missingFields).some(Boolean),
    };
  }

  async getHighlights(userId: string, festivalId: string): Promise<Highlights> {
    // Get user stats from the view
    const { data: stats, error: statsError } = await this.supabase.rpc(
      "get_user_festival_stats_with_positions",
      {
        p_user_id: userId,
        p_festival_id: festivalId,
      },
    );

    if (statsError) {
      throw new Error(`Failed to get highlights: ${statsError.message}`);
    }

    // Cast to any to handle varying RPC return types
    const userStats = (stats as any)?.[0];

    // Get spending stats from the spending view
    const { data: spendingStats } = await this.supabase
      .from("user_festival_spending_stats")
      .select("total_spent_cents, total_base_cents, total_tips_cents")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .maybeSingle();

    // Get favorite tent
    const { data: tentVisits } = await this.supabase
      .from("tent_visits")
      .select("tent_id, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    const tentCounts = new Map<string, { count: number; name: string }>();
    (tentVisits ?? []).forEach((tv) => {
      const tentId = tv.tent_id;
      const tentName = (tv.tents as any)?.name || "Unknown";
      const current = tentCounts.get(tentId) || { count: 0, name: tentName };
      tentCounts.set(tentId, { count: current.count + 1, name: tentName });
    });

    let favoriteTent: string | null = null;
    let maxCount = 0;
    tentCounts.forEach((value) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        favoriteTent = value.name;
      }
    });

    // Get group positions from top_positions field
    const groupPositions: Highlights["groupPositions"] = [];
    if (userStats?.top_positions) {
      const positions = userStats.top_positions as Array<{
        group_id: string;
        group_name: string;
        position: number;
        total_members: number;
      }>;
      positions.forEach((pos) => {
        groupPositions.push({
          groupId: pos.group_id,
          groupName: pos.group_name,
          position: pos.position,
          totalMembers: pos.total_members,
        });
      });
    }

    return {
      totalBeers: Number(userStats?.total_beers) || 0,
      totalDays: Number(userStats?.days_attended) || 0,
      totalSpent: Number(spendingStats?.total_spent_cents) || 0,
      totalBaseCents: Number(spendingStats?.total_base_cents) || 0,
      totalTipCents: Number(spendingStats?.total_tips_cents) || 0,
      avgBeersPerDay: Number(userStats?.avg_beers) || 0,
      favoriteDay: null, // Could be calculated if needed
      favoriteTent,
      groupPositions,
    };
  }

  async uploadAvatar(
    userId: string,
    fileName: string,
    fileBuffer: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    // Upload to storage
    const { error: uploadError } = await this.supabase.storage
      .from("avatars")
      .upload(fileName, fileBuffer, {
        contentType,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload avatar: ${uploadError.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from("avatars").getPublicUrl(fileName);

    // Update profile with new avatar URL
    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (updateError) {
      throw new Error(`Failed to update avatar URL: ${updateError.message}`);
    }

    return publicUrl;
  }

  async getAvatarUploadUrl(
    userId: string,
    _query: GetAvatarUploadUrlQuery,
  ): Promise<GetAvatarUploadUrlResponse> {
    // Generate unique file name (always use webp since mobile will compress to webp)
    const uniqueFileName = `${userId}_${Date.now()}.webp`;

    // Create signed upload URL
    const { data, error } = await this.supabase.storage
      .from("avatars")
      .createSignedUploadUrl(uniqueFileName);

    if (error || !data) {
      throw new Error(`Failed to create upload URL: ${error?.message}`);
    }

    // Replace localhost with actual network IP for mobile access (upload URLs only)
    const supabaseUrl =
      process.env.SUPABASE_PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const uploadUrl = replaceLocalhostInUrl(data.signedUrl, supabaseUrl);

    return {
      uploadUrl,
      fileName: uniqueFileName,
      expiresIn: 3600, // 1 hour
    };
  }

  async confirmAvatarUpload(userId: string, fileName: string): Promise<string> {
    // Update profile with just the filename (not full URL)
    // This matches the web behavior and allows clients to construct URLs
    const { error } = await this.supabase
      .from("profiles")
      .update({ avatar_url: fileName })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to update avatar: ${error.message}`);
    }

    return fileName;
  }
}
