import type { Database } from "@prostcounter/db";
import type {
  AdminAttendance,
  AdminUser,
  ListAdminUsersResponse,
  UpdateAdminAttendanceInput,
  UpdateAdminUserAuthInput,
  UpdateAdminUserProfileInput,
} from "@prostcounter/shared";
import { DEFAULT_TIMEZONE } from "@prostcounter/shared/constants";
import { atZonedTime, formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger";
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

  /**
   * Lists a user's attendances with the tents visited on each day.
   *
   * Tent visits are fetched in one query for the whole set and grouped in
   * memory; the web panel issues one query per attendance instead.
   */
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

  async listUserAttendances(userId: string): Promise<AdminAttendance[]> {
    const { data: attendances, error } = await this.supabase
      .from("attendances")
      .select("id, user_id, festival_id, date, beer_count")
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

    return attendances.map((attendance) => ({
      ...attendance,
      tent_ids: tentsByDay.get(`${attendance.festival_id}|${attendance.date}`) ?? [],
    }));
  }

  /**
   * Updates an attendance and, when tent_ids is supplied, replaces that day's
   * tent visits.
   *
   * The attendance is read first so the tent visits can be rewritten against
   * the row's real user/festival/date rather than values supplied by the
   * caller -- the web version trusts the client for all three, which lets a
   * malformed payload write visits onto the wrong day.
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
    const timezone = (await this.festivalTimezones([existing.festival_id])).get(
      existing.festival_id ?? "",
    );
    const visitTimezone = timezone ?? DEFAULT_TIMEZONE;

    // Cleared by id. Matching on `visit_date` equality compares a calendar day
    // against a timestamp, so it silently deletes nothing and this "replace"
    // becomes an append: edit a day twice and every tent is listed twice.
    const staleVisitIds = existing.festival_id
      ? await this.visitIdsOnDay(visitUserId, existing.festival_id, visitDate, visitTimezone)
      : [];

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
}
