import type { Database } from "@prostcounter/db";
import type {
  AdminAttendance,
  AdminFestival,
  AdminFestivalTent,
  AdminFestivalTentStats,
  AdminGroup,
  AdminGroupMember,
  AdminTent,
  AdminUser,
  AdminWrappedCacheEntry,
  CopyAdminFestivalTentsInput,
  ListAdminUsersResponse,
  CreateAdminFestivalInput,
  CreateAdminTentInput,
  UpdateAdminAttendanceInput,
  UpdateAdminFestivalInput,
  UpdateAdminGroupInput,
  UpdateAdminTentInput,
  UpdateAdminUserAuthInput,
  UpdateAdminUserProfileInput,
  TentCategory,
  WinningCriterion,
} from "@prostcounter/shared";
import { DEFAULT_TIMEZONE } from "@prostcounter/shared/constants";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { atZonedTime, formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger";
import { PgErrorCode } from "../../lib/postgres-errors";
import { ConflictError } from "../../middleware/error";
import { createAdminClient } from "../../utils/admin-client";

/**
 * How many auth users to request per page when building the email map.
 * GoTrue's own default is 50, which is what silently caps the web admin panel
 * at the first 50 accounts.
 */
const AUTH_PAGE_SIZE = 200;

/**
 * The UTC window that can contain any instant bucketing to `date`.
 *
 * `tent_visits.visit_date` is a timestamp, and the day it belongs to is
 * `(visit_date AT TIME ZONE tz)::date` since
 * 20260811100000_bucket_tent_visits_by_festival_timezone. The query builder
 * cannot express that, so callers read a day either side and bucket in JS, the
 * same shape attendance.repository.ts uses. No real offset comes near 24h.
 */
function dayWindowUtc(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Midday on `date`, on the festival's clock, as an instant.
 *
 * An admin setting a day's tents asserts a day, not a time, but the column is a
 * timestamp that everything else buckets by local day. Storing the bare date
 * string would write midnight UTC, which reads back as the previous day
 * anywhere west of Greenwich. Midday survives every real offset.
 */
function middayOn(date: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return atZonedTime(
    new Date(year, month - 1, day),
    new Date(2000, 0, 1, 12, 0),
    timezone,
  ).toISOString();
}

/**
 * Hard ceiling on auth pages scanned in one request. Emails live in
 * `auth.users`, which PostgREST does not expose, so they cannot be joined or
 * filtered in SQL -- the directory has to be walked. At this size the response
 * reports `truncated: true` rather than pretending the result is complete.
 */
const MAX_AUTH_PAGES = 25;

/** Strips PostgREST/SQL wildcards so a search term cannot alter the filter. */
function sanitizeSearchTerm(search: string, maxLength = 100): string {
  return search
    .trim()
    .replace(/[%_\\,().*]/g, "")
    .slice(0, maxLength);
}

interface AuthUserRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
}

/**
 * A `festival_tents` row joined to its tent, as `listFestivalTents` selects it.
 *
 * `category` is narrowed to the three `tents_category_check` allows. The
 * generated database types say `string | null` because they do not encode CHECK
 * constraints, so every read of this column needs the same narrowing; the
 * constraint is what makes it sound.
 */
interface FestivalTentRow {
  id: string;
  beer_price: number | null;
  tent: { id: string; name: string; category: TentCategory | null };
}

/**
 * A `wrapped_data_cache` row with its two embeds.
 *
 * `generated_by` is narrowed to the CHECK constraint's two values; the
 * generated DB types widen it to string, the same way they do tent categories.
 */
interface WrappedCacheRow {
  id: string;
  user_id: string;
  festival_id: string;
  generated_by: "system" | "admin";
  created_at: string;
  updated_at: string;
  user: { username: string | null; full_name: string | null };
  festival: { name: string };
}

/** Euros to cents, the unit `beer_price_cents` and `drink_type_prices` store. */
function toCents(beerPrice: number | null): number | null {
  return beerPrice === null ? null : Math.round(beerPrice * 100);
}

export class SupabaseAdminRepository {
  /**
   * @param supabase - the caller's own client. Used for everything RLS can
   *   authorize, so admin writes go through the "Super admins can do anything"
   *   policies rather than bypassing them.
   */
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Walks the auth directory. Separate from the caller's client because
   * `auth.admin` requires the service role.
   *
   * Returns the rows plus whether the ceiling cut the scan short.
   */
  private async listAuthUsers(): Promise<{ users: AuthUserRow[]; truncated: boolean }> {
    const adminClient = createAdminClient();
    const users: AuthUserRow[] = [];

    for (let page = 1; page <= MAX_AUTH_PAGES; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: AUTH_PAGE_SIZE,
      });

      if (error) {
        throw new Error(`Error fetching users: ${error.message}`);
      }

      for (const user of data.users) {
        users.push({
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at ?? null,
          last_sign_in_at: user.last_sign_in_at ?? null,
        });
      }

      // A short page means the directory is exhausted.
      if (data.users.length < AUTH_PAGE_SIZE) {
        return { users, truncated: false };
      }
    }

    logger.warn(
      { scanned: users.length, maxPages: MAX_AUTH_PAGES },
      "Auth directory exceeded the admin scan ceiling; user list is truncated",
    );
    return { users, truncated: true };
  }

  /**
   * Lists users with their profiles, optionally filtered by a search term that
   * matches email, username or full name.
   *
   * Pagination happens in memory because the two halves of a user live in
   * different places: `auth.users` (email, sign-in dates) cannot be joined to
   * `public.profiles` in a single query.
   */
  async listUsers(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<ListAdminUsersResponse> {
    const { users: authUsers, truncated } = await this.listAuthUsers();

    let matchingIds: string[];

    if (search) {
      const term = sanitizeSearchTerm(search);
      const lowered = term.toLowerCase();
      const pattern = `%${term}%`;

      // Two separate ilike queries rather than one .or() filter: the search
      // term would otherwise be interpolated into PostgREST filter syntax.
      const [nameResults, usernameResults] = await Promise.all([
        this.supabase.from("profiles").select("id").ilike("full_name", pattern),
        this.supabase.from("profiles").select("id").ilike("username", pattern),
      ]);

      if (nameResults.error) {
        throw new Error(`Error fetching profiles: ${nameResults.error.message}`);
      }
      if (usernameResults.error) {
        throw new Error(`Error fetching profiles: ${usernameResults.error.message}`);
      }

      const profileMatches = new Set([
        ...(nameResults.data ?? []).map((row) => row.id),
        ...(usernameResults.data ?? []).map((row) => row.id),
      ]);

      matchingIds = authUsers
        .filter(
          (user) =>
            profileMatches.has(user.id) || user.email?.toLowerCase().includes(lowered) === true,
        )
        .map((user) => user.id);
    } else {
      matchingIds = authUsers.map((user) => user.id);
    }

    const totalCount = matchingIds.length;
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 0;
    const startIndex = (page - 1) * limit;
    const pageIds = matchingIds.slice(startIndex, startIndex + limit);

    // Profiles only for the page being returned.
    const { data: profiles, error: profileError } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_super_admin")
      .in("id", pageIds);

    if (profileError) {
      throw new Error(`Error fetching user profiles: ${profileError.message}`);
    }

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const authById = new Map(authUsers.map((user) => [user.id, user]));

    const users: AdminUser[] = pageIds.map((id) => {
      const authUser = authById.get(id);
      return {
        id,
        email: authUser?.email ?? null,
        created_at: authUser?.created_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        profile: profileById.get(id) ?? null,
      };
    });

    return { users, totalCount, totalPages, currentPage: page, truncated };
  }

  /**
   * Fetches one user. Uses getUserById rather than the directory walk in
   * listUsers, so the detail screen costs a single auth lookup.
   */
  async getUser(userId: string): Promise<AdminUser | null> {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.getUserById(userId);

    if (error || !data?.user) {
      return null;
    }

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_super_admin")
      .eq("id", userId)
      .single();

    return {
      id: data.user.id,
      email: data.user.email ?? null,
      created_at: data.user.created_at ?? null,
      last_sign_in_at: data.user.last_sign_in_at ?? null,
      profile: profile ?? null,
    };
  }

  /**
   * Updates another user's profile. Runs on the caller's client: the
   * "Super admins can do anything" policy on `profiles` authorizes it, so a
   * caller who somehow reached here without the flag still writes nothing.
   */
  async updateUserProfile(userId: string, input: UpdateAdminUserProfileInput): Promise<void> {
    const { error } = await this.supabase.from("profiles").update(input).eq("id", userId);

    if (error) {
      throw new Error(`Error updating user profile: ${error.message}`);
    }
  }

  /** Changes a user's email or password. Requires the service role. */
  async updateUserAuth(userId: string, input: UpdateAdminUserAuthInput): Promise<void> {
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(userId, input);

    if (error) {
      throw new Error(`Error updating user auth: ${error.message}`);
    }
  }

  /** Deletes a user from auth; the profile row cascades. Service role only. */
  async deleteUser(userId: string): Promise<void> {
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  private async festivalTimezones(festivalIds: (string | null)[]): Promise<Map<string, string>> {
    const ids = [...new Set(festivalIds.filter((id): id is string => !!id))];
    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("festivals")
      .select("id, timezone")
      .in("id", ids);

    if (error) {
      throw new Error(`Error fetching festival timezones: ${error.message}`);
    }

    return new Map((data ?? []).map((f) => [f.id, f.timezone ?? DEFAULT_TIMEZONE]));
  }

  /**
   * The ids of a user's tent visits on one festival day.
   *
   * Windowed and bucketed rather than matched on equality: `visit_date` holds
   * the real visit time, so `.eq(visit_date, "2026-09-21")` compares against
   * midnight UTC and matches nothing a person actually logged.
   */
  private async visitIdsOnDay(
    userId: string,
    festivalId: string,
    date: string,
    timezone: string,
  ): Promise<string[]> {
    const window = dayWindowUtc(date);

    const { data, error } = await this.supabase
      .from("tent_visits")
      .select("id, visit_date")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .gte("visit_date", window.start)
      .lt("visit_date", window.end);

    if (error) {
      throw new Error(`Error reading the day's tent visits: ${error.message}`);
    }

    return (data ?? [])
      .filter(
        (v) => !!v.visit_date && formatDateForDatabase(new Date(v.visit_date), timezone) === date,
      )
      .map((v) => v.id);
  }

  /**
   * Lists a user's attendances with the tents visited on each day.
   *
   * Reads `attendance_with_totals`, not `attendances`: the RPCs stopped
   * writing `attendances.beer_count` in 20260317130000_stop_writing_beer_count,
   * so that column is 0 on every day created since and a panel reading it
   * reports "0 beers" for essentially all recent attendance. The view counts
   * `consumptions` and falls back to the column only for days that have none,
   * which is what every other read in the API uses.
   *
   * `drink_count` rides along for the editor's benefit. The view's LATERAL
   * carries `HAVING count(*) > 0`, so `attendances.beer_count` is only reached
   * on a day with no consumptions at all -- which is exactly the set of days
   * where writing it through `updateAttendance` changes what anyone sees. A
   * client cannot tell those days apart from the count alone, since a day with
   * three beers and a day whose dead column says three look identical.
   *
   * Tent visits are fetched in one query for the whole set and grouped in
   * memory; the web panel issues one query per attendance instead.
   */
  async listUserAttendances(userId: string): Promise<AdminAttendance[]> {
    const { data: attendances, error } = await this.supabase
      .from("attendance_with_totals")
      .select("id, user_id, festival_id, date, beer_count, drink_count")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      throw new Error(`Error fetching attendances: ${error.message}`);
    }

    if (!attendances || attendances.length === 0) {
      return [];
    }

    const { data: tentVisits, error: tentError } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date, festival_id")
      .eq("user_id", userId);

    if (tentError) {
      throw new Error(`Error fetching tent visits: ${tentError.message}`);
    }

    const timezones = await this.festivalTimezones([
      ...attendances.map((a) => a.festival_id),
      ...(tentVisits ?? []).map((v) => v.festival_id),
    ]);

    // visit_date is a timestamp; attendances.date is a calendar day. The day a
    // visit belongs to is its date on the *festival's* clock, not UTC: slicing
    // the timestamp files a 01:00 Munich visit under the previous day, which is
    // what 20260811100000_bucket_tent_visits_by_festival_timezone exists to
    // stop. Keyed by festival too, since one user's days can overlap across
    // festivals in different timezones.
    const tentsByDay = new Map<string, string[]>();
    for (const visit of tentVisits ?? []) {
      if (!visit.visit_date || !visit.tent_id || !visit.festival_id) continue;
      const timezone = timezones.get(visit.festival_id) ?? DEFAULT_TIMEZONE;
      const key = `${visit.festival_id}|${formatDateForDatabase(new Date(visit.visit_date), timezone)}`;
      const existing = tentsByDay.get(key);
      if (existing) {
        existing.push(visit.tent_id);
      } else {
        tentsByDay.set(key, [visit.tent_id]);
      }
    }

    // A view loses the base table's NOT NULL, so every column here is typed
    // nullable; id, festival_id and date cannot actually be null on
    // `attendances`. Skipped rather than coerced -- a row that did come back
    // that way is not a shape this panel can say anything true about.
    return attendances.flatMap((attendance) => {
      if (!attendance.id || !attendance.festival_id || !attendance.date) {
        return [];
      }

      return [
        {
          id: attendance.id,
          user_id: attendance.user_id,
          festival_id: attendance.festival_id,
          date: attendance.date,
          beer_count: attendance.beer_count ?? 0,
          drink_count: attendance.drink_count ?? 0,
          tent_ids: tentsByDay.get(`${attendance.festival_id}|${attendance.date}`) ?? [],
        },
      ];
    });
  }

  /**
   * Updates an attendance and, when tent_ids is supplied, replaces that day's
   * tent visits.
   *
   * The attendance is read first so the tent visits can be rewritten against
   * the row's real user/festival/date rather than values supplied by the
   * caller -- the web version trusts the client for all three, which lets a
   * malformed payload write visits onto the wrong day.
   *
   * `beer_count` still writes to `attendances.beer_count`, which the view only
   * reads for days that have no consumptions. On a day with drinks logged the
   * value is therefore inert; reconciling it would mean synthesising or
   * deleting consumption rows, which is a different feature from editing a day.
   */
  async updateAttendance(attendanceId: string, input: UpdateAdminAttendanceInput): Promise<void> {
    const { tent_ids, ...attendanceFields } = input;

    const { data: existing, error: fetchError } = await this.supabase
      .from("attendances")
      .select("id, user_id, festival_id, date")
      .eq("id", attendanceId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Attendance not found: ${fetchError?.message ?? attendanceId}`);
    }

    if (Object.keys(attendanceFields).length > 0) {
      const { error } = await this.supabase
        .from("attendances")
        .update(attendanceFields)
        .eq("id", attendanceId);

      // `attendances` carries UNIQUE(user_id, festival_id, date), so moving a
      // day onto one the user already has is the caller asking for something
      // impossible, not the server falling over. Raised as 409 rather than
      // escaping as a raw 500.
      if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
        throw new ConflictError(ErrorCodes.DUPLICATE_ATTENDANCE);
      }

      if (error) {
        throw new Error(`Error updating attendance: ${error.message}`);
      }
    }

    if (!tent_ids) {
      return;
    }

    // Tent visits are keyed by user, so an attendance with no owner has no
    // day to rewrite. Refuse rather than writing visits with a null user_id.
    // Captured to a local because the narrowing does not survive the awaits below.
    const visitUserId = existing.user_id;
    if (!visitUserId) {
      throw new Error(`Attendance ${attendanceId} has no user; cannot set tent visits`);
    }

    // The day the visits belong to, after any date change in this same call.
    const visitDate = attendanceFields.date ?? existing.date;
    const visitFestivalId = existing.festival_id;
    const timezone = (await this.festivalTimezones([visitFestivalId])).get(visitFestivalId ?? "");
    const visitTimezone = timezone ?? DEFAULT_TIMEZONE;

    // Both days when the attendance moved. Clearing only the new one leaves the
    // old day's visits behind with no attendance covering them: they still feed
    // leaderboards and achievements, but listUserAttendances groups by
    // festival|date and no longer surfaces them, so they are invisible to the
    // admin who just moved the day.
    const daysToClear = visitDate === existing.date ? [existing.date] : [existing.date, visitDate];

    // Cleared by id. Matching on `visit_date` equality compares a calendar day
    // against a timestamp, so it silently deletes nothing and this "replace"
    // becomes an append: edit a day twice and every tent is listed twice.
    const staleVisitIds: string[] = [];
    if (visitFestivalId) {
      for (const day of daysToClear) {
        staleVisitIds.push(
          ...(await this.visitIdsOnDay(visitUserId, visitFestivalId, day, visitTimezone)),
        );
      }
    }

    if (staleVisitIds.length > 0) {
      const { error: deleteError } = await this.supabase
        .from("tent_visits")
        .delete()
        .in("id", staleVisitIds);

      if (deleteError) {
        throw new Error(`Error clearing tent visits: ${deleteError.message}`);
      }
    }

    if (tent_ids.length === 0) {
      return;
    }

    const { error: insertError } = await this.supabase.from("tent_visits").insert(
      tent_ids.map((tentId) => ({
        // tent_visits.id has no database default, so it must be supplied.
        id: crypto.randomUUID(),
        user_id: visitUserId,
        festival_id: existing.festival_id,
        tent_id: tentId,
        visit_date: middayOn(visitDate, visitTimezone),
      })),
    );

    if (insertError) {
      throw new Error(`Error adding tent visits: ${insertError.message}`);
    }
  }

  /**
   * Lists every group with its member count.
   *
   * Columns are named explicitly rather than selected with "*": `groups` also
   * holds `password` and `invite_token`, and neither belongs in an API
   * response just because the caller is an admin.
   */
  async listGroups(): Promise<AdminGroup[]> {
    const { data, error } = await this.supabase
      .from("groups")
      .select(
        "id, name, description, winning_criteria_id, festival_id, created_at, created_by, group_members(count)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching groups: ${error.message}`);
    }

    return (data ?? []).map((group) => {
      const { group_members, ...rest } = group;
      return {
        ...rest,
        member_count: group_members?.[0]?.count ?? 0,
      };
    });
  }

  /**
   * Fetches one group, so the detail screen survives a reload or deep link.
   *
   * `maybeSingle` with the error rethrown, rather than collapsing both into
   * null: the route turns null into "Group not found", so swallowing a real
   * Supabase failure here tells the admin the group is gone when the database
   * is merely unreachable.
   */
  async getGroup(groupId: string): Promise<AdminGroup | null> {
    const { data, error } = await this.supabase
      .from("groups")
      .select(
        "id, name, description, winning_criteria_id, festival_id, created_at, created_by, group_members(count)",
      )
      .eq("id", groupId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching group: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const { group_members, ...rest } = data;
    return { ...rest, member_count: group_members?.[0]?.count ?? 0 };
  }

  /**
   * Updates a group. Returns false when no such group exists.
   *
   * PostgREST counts a write that matches no rows as a success, so without the
   * `select` this reports a saved rename for a group another admin has already
   * deleted -- and the detail screen leaves edit mode showing the new name.
   */
  async updateGroup(groupId: string, input: UpdateAdminGroupInput): Promise<boolean> {
    // Every field on UpdateAdminGroupSchema is optional, so an empty patch is a
    // valid request. PostgREST rejects an update with no columns, so read
    // instead of writing: the answer the caller wants is still "does it exist".
    const query =
      Object.keys(input).length > 0
        ? this.supabase.from("groups").update(input).eq("id", groupId).select("id")
        : this.supabase.from("groups").select("id").eq("id", groupId);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error updating group: ${error.message}`);
    }

    return (data ?? []).length > 0;
  }

  /** Deletes a group. Returns false when no such group exists. */
  async deleteGroup(groupId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("groups")
      .delete()
      .eq("id", groupId)
      .select("id");

    if (error) {
      throw new Error(`Error deleting group: ${error.message}`);
    }

    return (data ?? []).length > 0;
  }

  /**
   * Lists a group's members, flattened from the joined profile.
   *
   * A plain join rather than `!inner`: `group_members.user_id` is nullable, and
   * an inner join drops those rows silently. The detail screen shows
   * `member_count` (which counts every row) directly above this list, so the
   * two would disagree with nothing on screen explaining the gap. A member with
   * no profile comes back with null names instead, which the schema allows.
   */
  async listGroupMembers(groupId: string): Promise<AdminGroupMember[]> {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("id, user_id, joined_at, profiles(username, full_name, avatar_url)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching group members: ${error.message}`);
    }

    return (data ?? []).map((member) => {
      // The join yields an object, but the generated types model the
      // relationship as possibly-array; normalize before reading it.
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
      return {
        id: member.id,
        user_id: member.user_id,
        joined_at: member.joined_at,
        username: profile?.username ?? null,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      };
    });
  }

  // ===========================================================================
  // Festivals
  // ===========================================================================

  async listFestivals(): Promise<AdminFestival[]> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) {
      throw new Error(`Error fetching festivals: ${error.message}`);
    }

    return (data ?? []) as AdminFestival[];
  }

  /**
   * Fetches one festival. Null means no such row, not "the read failed" --
   * the route turns null into a 404, so a real error has to be rethrown or an
   * unreachable database reads as a missing festival.
   */
  async getFestival(festivalId: string): Promise<AdminFestival | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("*")
      .eq("id", festivalId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching festival: ${error.message}`);
    }

    return (data as AdminFestival) ?? null;
  }

  /**
   * Clears is_active on every other festival.
   *
   * `idx_festivals_single_active` is a unique partial index over
   * `is_active WHERE is_active = true`, so marking a second festival active
   * fails with a constraint violation unless the previous one is cleared first.
   * The web panel does not do this, so activating a festival there errors.
   */
  private async deactivateOtherFestivals(exceptFestivalId?: string): Promise<void> {
    let query = this.supabase.from("festivals").update({ is_active: false }).eq("is_active", true);

    if (exceptFestivalId) {
      query = query.neq("id", exceptFestivalId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Error deactivating current festival: ${error.message}`);
    }
  }

  /**
   * Creates a festival, activating it last.
   *
   * Inserted inactive and then activated, rather than sweeping first: none of
   * this is in a transaction, so a sweep followed by a rejected insert would
   * leave the app with no active festival at all. Every client keys off that
   * row, so the ordering here is what decides whether a bad request costs
   * nothing or takes the whole app's festival selection down.
   */
  async createFestival(input: CreateAdminFestivalInput): Promise<AdminFestival> {
    const { is_active, ...fields } = input;

    const { data, error } = await this.supabase
      .from("festivals")
      .insert({ ...fields, is_active: false })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error creating festival: ${error?.message}`);
    }

    if (!is_active) {
      return data as AdminFestival;
    }

    return this.setActiveFestival(data.id);
  }

  /**
   * Clears every other festival's flag, then sets this one's.
   *
   * Both halves are needed because `idx_festivals_single_active` is a unique
   * partial index: the set fails outright while another row is still active.
   */
  private async setActiveFestival(festivalId: string): Promise<AdminFestival> {
    await this.deactivateOtherFestivals(festivalId);

    const { data, error } = await this.supabase
      .from("festivals")
      .update({ is_active: true })
      .eq("id", festivalId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error activating festival: ${error?.message}`);
    }

    return data as AdminFestival;
  }

  /**
   * Updates a festival. Null means no such festival, so the route can 404.
   *
   * The plain fields are written before any is_active change, and the
   * deactivate sweep runs last. Sweeping first (the shape this replaces) meant
   * a PATCH naming a festival that no longer exists still cleared is_active on
   * the real active one, and then failed -- leaving the app with no active
   * festival and the admin told only that the update did not work.
   *
   * updated_at is not set here: `update_festivals_updated_at` is a BEFORE
   * UPDATE trigger, so the database keeps it on its own clock.
   */
  async updateFestival(
    festivalId: string,
    input: UpdateAdminFestivalInput,
  ): Promise<AdminFestival | null> {
    const { is_active, ...fields } = input;

    let current: AdminFestival | null;

    if (Object.keys(fields).length > 0) {
      const { data, error } = await this.supabase
        .from("festivals")
        .update(fields)
        .eq("id", festivalId)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Error updating festival: ${error.message}`);
      }

      current = (data as AdminFestival) ?? null;
    } else {
      current = await this.getFestival(festivalId);
    }

    if (!current) {
      return null;
    }

    if (is_active === undefined || is_active === current.is_active) {
      return current;
    }

    if (is_active) {
      return this.setActiveFestival(festivalId);
    }

    const { data, error } = await this.supabase
      .from("festivals")
      .update({ is_active: false })
      .eq("id", festivalId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error deactivating festival: ${error?.message}`);
    }

    return data as AdminFestival;
  }

  /**
   * Deletes a festival, refusing when dependent data exists.
   *
   * The three tables checked here are exactly the ones whose foreign key to
   * `festivals` has no ON DELETE CASCADE, so the delete would fail on the
   * constraint and surface a raw Postgres message as a 500. Everything else
   * (achievements, festival_tents, reservations, location_sessions, the
   * wrapped cache) cascades and is destroyed silently, which is why the
   * confirmation copy says so.
   *
   * Returns a reason string instead of throwing so the route can answer 409.
   */
  async deleteFestival(
    festivalId: string,
  ): Promise<{ deleted: true } | { blockedBy: "attendances" | "groups" | "tent_visits" }> {
    const [attendances, groups, tentVisits] = await Promise.all([
      this.supabase.from("attendances").select("id").eq("festival_id", festivalId).limit(1),
      this.supabase.from("groups").select("id").eq("festival_id", festivalId).limit(1),
      this.supabase.from("tent_visits").select("id").eq("festival_id", festivalId).limit(1),
    ]);

    if (attendances.error) {
      throw new Error(`Error checking festival attendances: ${attendances.error.message}`);
    }
    if (groups.error) {
      throw new Error(`Error checking festival groups: ${groups.error.message}`);
    }
    if (tentVisits.error) {
      throw new Error(`Error checking festival tent visits: ${tentVisits.error.message}`);
    }

    if (attendances.data && attendances.data.length > 0) {
      return { blockedBy: "attendances" };
    }
    if (groups.data && groups.data.length > 0) {
      return { blockedBy: "groups" };
    }
    if (tentVisits.data && tentVisits.data.length > 0) {
      return { blockedBy: "tent_visits" };
    }

    const { error } = await this.supabase.from("festivals").delete().eq("id", festivalId);

    if (error) {
      throw new Error(`Error deleting festival: ${error.message}`);
    }

    return { deleted: true };
  }

  async listWinningCriteria(): Promise<WinningCriterion[]> {
    const { data, error } = await this.supabase
      .from("winning_criteria")
      .select("id, name")
      .order("id");

    if (error) {
      throw new Error(`Error fetching winning criteria: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Deletes an attendance and that day's tent visits.
   *
   * The visits go too because nothing else removes them: `tent_visits` has no
   * FK to `attendances` (they are keyed by user, festival and day), so dropping
   * the attendance alone leaves them readable by the user's own app, and the
   * next edit to that day resurrects an attendance with ghost tents attached.
   */
  async deleteAttendance(attendanceId: string): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase
      .from("attendances")
      .select("id, user_id, festival_id, date")
      .eq("id", attendanceId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Error reading attendance: ${fetchError.message}`);
    }

    if (existing?.user_id && existing.festival_id) {
      const timezone =
        (await this.festivalTimezones([existing.festival_id])).get(existing.festival_id) ??
        DEFAULT_TIMEZONE;
      const visitIds = await this.visitIdsOnDay(
        existing.user_id,
        existing.festival_id,
        existing.date,
        timezone,
      );

      if (visitIds.length > 0) {
        const { error: visitError } = await this.supabase
          .from("tent_visits")
          .delete()
          .in("id", visitIds);

        if (visitError) {
          throw new Error(`Error deleting tent visits: ${visitError.message}`);
        }
      }
    }

    const { error } = await this.supabase.from("attendances").delete().eq("id", attendanceId);

    if (error) {
      throw new Error(`Error deleting attendance: ${error.message}`);
    }
  }

  // ===========================================================================
  // Tents
  // ===========================================================================

  /**
   * Keeps `drink_type_prices` in step with a tent's beer price.
   *
   * Three places hold this one number: `festival_tents.beer_price` in euros,
   * which `tent.repository` reads; `beer_price_cents`, added by the pricing
   * overhaul; and a `drink_type_prices` row, which is the canonical source that
   * overhaul moved to and which `pricing.repository` reads. Callers write the
   * two columns, this writes the canonical row, and they always move together --
   * updating one alone leaves a reader showing a stale price.
   *
   * Only `drink_type` "beer" is touched. The web panel's per-tent price has
   * always been a beer price; the other drink types fall back to the festival
   * default.
   */
  private async syncTentBeerPrices(
    entries: { festivalTentId: string; priceCents: number | null }[],
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const toClear = entries.filter((e) => e.priceCents === null).map((e) => e.festivalTentId);
    const toSet = entries.filter(
      (e): e is { festivalTentId: string; priceCents: number } => e.priceCents !== null,
    );

    if (toClear.length > 0) {
      // No zero row: `drink_type_prices_positive_price` rejects <= 0, so an
      // absent price is an absent row.
      const { error } = await this.supabase
        .from("drink_type_prices")
        .delete()
        .in("festival_tent_id", toClear)
        .eq("drink_type", "beer");

      if (error) {
        throw new Error(`Error clearing tent beer price: ${error.message}`);
      }
    }

    if (toSet.length === 0) {
      return;
    }

    // Read first rather than upsert. The uniqueness that would drive ON CONFLICT
    // is a *partial* index (`drink_type_prices_tent_unique ... WHERE
    // festival_tent_id IS NOT NULL`), and PostgREST's on_conflict cannot supply
    // the predicate Postgres needs to infer one.
    const { data: existing, error: existingError } = await this.supabase
      .from("drink_type_prices")
      .select("id, festival_tent_id")
      .in(
        "festival_tent_id",
        toSet.map((e) => e.festivalTentId),
      )
      .eq("drink_type", "beer");

    if (existingError) {
      throw new Error(`Error reading tent beer prices: ${existingError.message}`);
    }

    const existingIdByTent = new Map(
      (existing ?? []).map((row) => [row.festival_tent_id as string, row.id]),
    );

    const inserts = toSet
      .filter((e) => !existingIdByTent.has(e.festivalTentId))
      .map((e) => ({
        festival_tent_id: e.festivalTentId,
        drink_type: "beer" as const,
        price_cents: e.priceCents,
      }));

    if (inserts.length > 0) {
      const { error } = await this.supabase.from("drink_type_prices").insert(inserts);

      if (error) {
        throw new Error(`Error creating tent beer price: ${error.message}`);
      }
    }

    for (const entry of toSet) {
      const rowId = existingIdByTent.get(entry.festivalTentId);
      if (!rowId) {
        continue;
      }

      const { error } = await this.supabase
        .from("drink_type_prices")
        .update({ price_cents: entry.priceCents, updated_at: new Date().toISOString() })
        .eq("id", rowId);

      if (error) {
        throw new Error(`Error updating tent beer price: ${error.message}`);
      }
    }
  }

  async listTents(): Promise<AdminTent[]> {
    const { data, error } = await this.supabase
      .from("tents")
      .select("id, name, category")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Error fetching tents: ${error.message}`);
    }

    return (data ?? []) as AdminTent[];
  }

  async createTent(input: CreateAdminTentInput): Promise<AdminTent> {
    const { data, error } = await this.supabase
      .from("tents")
      // `tents.id` has no database default, so it is generated here.
      .insert({ id: crypto.randomUUID(), name: input.name, category: input.category ?? null })
      .select("id, name, category")
      .single();

    if (error || !data) {
      throw new Error(`Error creating tent: ${error?.message}`);
    }

    return data as AdminTent;
  }

  /**
   * Renames or recategorises a catalogue tent. Null means no such tent.
   *
   * Every field on UpdateAdminTentSchema is optional, so an empty patch is a
   * valid request. PostgREST rejects an update with no columns, so read
   * instead of writing: the answer the caller wants is still "does it exist".
   * Same shape as updateGroup.
   */
  async updateTent(tentId: string, input: UpdateAdminTentInput): Promise<AdminTent | null> {
    const columns = "id, name, category";
    const query =
      Object.keys(input).length > 0
        ? this.supabase.from("tents").update(input).eq("id", tentId).select(columns)
        : this.supabase.from("tents").select(columns).eq("id", tentId);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Error updating tent: ${error.message}`);
    }

    return (data as AdminTent | null) ?? null;
  }

  async listFestivalTents(festivalId: string): Promise<AdminFestivalTent[]> {
    const { data, error } = await this.supabase
      .from("festival_tents")
      .select("id, beer_price, tent:tents!inner(id, name, category)")
      .eq("festival_id", festivalId)
      .order("tent(name)", { ascending: true });

    if (error) {
      throw new Error(`Error fetching festival tents: ${error.message}`);
    }

    return ((data ?? []) as unknown as FestivalTentRow[]).map((row) => ({
      festival_tent_id: row.id,
      tent_id: row.tent.id,
      name: row.tent.name,
      category: row.tent.category,
      beer_price: row.beer_price,
    }));
  }

  /** Tents in the catalogue that this festival has not been given yet. */
  async listAvailableTents(festivalId: string): Promise<AdminTent[]> {
    const { data: assigned, error: assignedError } = await this.supabase
      .from("festival_tents")
      .select("tent_id")
      .eq("festival_id", festivalId);

    if (assignedError) {
      throw new Error(`Error fetching festival tents: ${assignedError.message}`);
    }

    const assignedIds = (assigned ?? []).map((row) => row.tent_id);

    let query = this.supabase.from("tents").select("id, name, category");

    if (assignedIds.length > 0) {
      query = query.not("id", "in", `(${assignedIds.join(",")})`);
    }

    const { data, error } = await query.order("name", { ascending: true });

    if (error) {
      throw new Error(`Error fetching available tents: ${error.message}`);
    }

    return (data ?? []) as AdminTent[];
  }

  /**
   * Adds one catalogue tent to a festival, idempotently.
   *
   * `unique_festival_tent` covers (festival_id, tent_id), so a second add of
   * the same tent raises 23505. That is not a bug worth a 500: the tent is
   * already served, which is the state the caller asked for. The picker rows
   * are tappable while a write is in flight, so the realistic source of a
   * duplicate is one admin's double tap, and reporting a failure for an add
   * that worked is worse than saying nothing.
   *
   * A price sent with the duplicate is still applied. Swallowing the conflict
   * and returning early would answer "added" for a request that wrote nothing,
   * which is the same lie in the other direction.
   */
  async addFestivalTent(
    festivalId: string,
    tentId: string,
    beerPrice: number | null,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("festival_tents")
      .insert({
        festival_id: festivalId,
        tent_id: tentId,
        beer_price: beerPrice,
        beer_price_cents: toCents(beerPrice),
      })
      .select("id")
      .single();

    if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
      if (beerPrice !== null) {
        await this.updateFestivalTentPrice(festivalId, tentId, beerPrice);
      }
      return;
    }

    if (error || !data) {
      throw new Error(`Error adding tent to festival: ${error?.message}`);
    }

    await this.syncTentBeerPrices([{ festivalTentId: data.id, priceCents: toCents(beerPrice) }]);
  }

  /**
   * Adds every catalogue tent this festival does not serve yet, at one price.
   *
   * The read of what is missing and the insert are two statements, so another
   * admin adding a single tent in between would make one row of the batch a
   * duplicate. A plain insert fails the whole batch on that one row and adds
   * none of the other thirty, so the conflict is ignored instead: the returned
   * rows are the ones actually inserted, which is both the count to report and
   * the set to price.
   */
  async addAllAvailableTents(festivalId: string, beerPrice: number | null): Promise<number> {
    const available = await this.listAvailableTents(festivalId);

    if (available.length === 0) {
      return 0;
    }

    const priceCents = toCents(beerPrice);
    const { data, error } = await this.supabase
      .from("festival_tents")
      .upsert(
        available.map((tent) => ({
          festival_id: festivalId,
          tent_id: tent.id,
          beer_price: beerPrice,
          beer_price_cents: priceCents,
        })),
        { onConflict: "festival_id,tent_id", ignoreDuplicates: true },
      )
      .select("id");

    if (error || !data) {
      throw new Error(`Error adding tents to festival: ${error?.message}`);
    }

    await this.syncTentBeerPrices(data.map((row) => ({ festivalTentId: row.id, priceCents })));

    return data.length;
  }

  /**
   * Removes a tent from a festival, refusing when people have visited it.
   *
   * Ported from the web panel: `tent_visits` rows reference the pair, and
   * dropping the assignment would orphan a visitor's history. Returns a reason
   * instead of throwing so the route can answer 409.
   */
  async removeFestivalTent(
    festivalId: string,
    tentId: string,
  ): Promise<{ deleted: true } | { blockedBy: "visits" }> {
    const { data: visits, error: visitsError } = await this.supabase
      .from("tent_visits")
      .select("id")
      .eq("festival_id", festivalId)
      .eq("tent_id", tentId)
      .limit(1);

    if (visitsError) {
      throw new Error(`Error checking tent visits: ${visitsError.message}`);
    }

    if (visits && visits.length > 0) {
      return { blockedBy: "visits" };
    }

    // The drink_type_prices row goes with it via ON DELETE CASCADE on
    // festival_tent_id, so there is nothing to clean up here.
    const { error } = await this.supabase
      .from("festival_tents")
      .delete()
      .eq("festival_id", festivalId)
      .eq("tent_id", tentId);

    if (error) {
      throw new Error(`Error removing tent from festival: ${error.message}`);
    }

    return { deleted: true };
  }

  async updateFestivalTentPrice(
    festivalId: string,
    tentId: string,
    beerPrice: number | null,
  ): Promise<AdminFestivalTent | null> {
    const priceCents = toCents(beerPrice);

    const { data, error } = await this.supabase
      .from("festival_tents")
      .update({ beer_price: beerPrice, beer_price_cents: priceCents })
      .eq("festival_id", festivalId)
      .eq("tent_id", tentId)
      .select("id, beer_price, tent:tents!inner(id, name, category)")
      .maybeSingle();

    if (error) {
      throw new Error(`Error updating tent price: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const row = data as unknown as FestivalTentRow;
    await this.syncTentBeerPrices([{ festivalTentId: row.id, priceCents }]);

    return {
      festival_tent_id: row.id,
      tent_id: row.tent.id,
      name: row.tent.name,
      category: row.tent.category,
      beer_price: row.beer_price,
    };
  }

  /**
   * Copies tent assignments from one festival to another.
   *
   * Tents already present in the target are skipped rather than overwritten, so
   * running this twice is harmless and an existing price is never clobbered.
   */
  async copyFestivalTents(
    targetFestivalId: string,
    input: CopyAdminFestivalTentsInput,
  ): Promise<number> {
    const { data: source, error: sourceError } = await this.supabase
      .from("festival_tents")
      .select("tent_id, beer_price")
      .eq("festival_id", input.source_festival_id)
      .in("tent_id", input.tent_ids);

    if (sourceError) {
      throw new Error(`Error fetching source tents: ${sourceError.message}`);
    }

    if (!source || source.length === 0) {
      return 0;
    }

    const { data: alreadyThere, error: targetError } = await this.supabase
      .from("festival_tents")
      .select("tent_id")
      .eq("festival_id", targetFestivalId)
      .in(
        "tent_id",
        source.map((row) => row.tent_id),
      );

    if (targetError) {
      throw new Error(`Error fetching target tents: ${targetError.message}`);
    }

    const present = new Set((alreadyThere ?? []).map((row) => row.tent_id));
    const toCopy = source.filter((row) => !present.has(row.tent_id));

    if (toCopy.length === 0) {
      return 0;
    }

    // An explicit `override_price: null` means "copy the tents, price none of
    // them", and outranks copy_prices. Omitting the field is what leaves the
    // source's prices in play; the two are not interchangeable.
    const priceFor = (sourcePrice: number | null): number | null => {
      if (input.override_price !== undefined) {
        return input.override_price;
      }
      return input.copy_prices ? sourcePrice : null;
    };

    // Ignoring the conflict rather than failing the batch, for the same reason
    // as addAllAvailableTents: the "already there" read above is a separate
    // statement, and one tent arriving in between should not cost the copy.
    const { data, error } = await this.supabase
      .from("festival_tents")
      .upsert(
        toCopy.map((row) => ({
          festival_id: targetFestivalId,
          tent_id: row.tent_id,
          beer_price: priceFor(row.beer_price),
          beer_price_cents: toCents(priceFor(row.beer_price)),
        })),
        { onConflict: "festival_id,tent_id", ignoreDuplicates: true },
      )
      .select("id, tent_id");

    if (error || !data) {
      throw new Error(`Error copying tents: ${error?.message}`);
    }

    const sourcePriceByTent = new Map(toCopy.map((row) => [row.tent_id, row.beer_price]));
    await this.syncTentBeerPrices(
      data.map((row) => ({
        festivalTentId: row.id,
        priceCents: toCents(priceFor(sourcePriceByTent.get(row.tent_id) ?? null)),
      })),
    );

    return data.length;
  }

  /**
   * Counts a festival's tents.
   *
   * Takes the list rather than fetching it: the one caller has already read it
   * to return alongside these numbers, and deriving them here cost a second
   * identical query on every load of the screen.
   */
  getFestivalTentStats(tents: AdminFestivalTent[]): AdminFestivalTentStats {
    const categories: Record<string, number> = {};
    const prices: number[] = [];

    for (const tent of tents) {
      const category = tent.category ?? "Uncategorized";
      categories[category] = (categories[category] ?? 0) + 1;

      if (tent.beer_price !== null) {
        prices.push(tent.beer_price);
      }
    }

    return {
      total_tents: tents.length,
      categories,
      with_custom_pricing: prices.length,
      avg_price:
        prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
    };
  }

  // =========================================================================
  // Wrapped cache
  // =========================================================================

  /**
   * Every cached Wrapped payload, most recently regenerated first.
   *
   * Read on the caller's own token: "Admins can manage wrapped cache" is an
   * ALL policy over the whole table, so a super admin sees every row while
   * everyone else sees only their own.
   */
  async listWrappedCache(): Promise<AdminWrappedCacheEntry[]> {
    const { data, error } = await this.supabase
      .from("wrapped_data_cache")
      .select(
        "id, user_id, festival_id, generated_by, created_at, updated_at, user:profiles!inner(username, full_name), festival:festivals!inner(name)",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching wrapped cache: ${error.message}`);
    }

    return ((data ?? []) as unknown as WrappedCacheRow[]).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      username: row.user.username,
      full_name: row.user.full_name,
      festival_id: row.festival_id,
      festival_name: row.festival.name,
      generated_by: row.generated_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }
}
