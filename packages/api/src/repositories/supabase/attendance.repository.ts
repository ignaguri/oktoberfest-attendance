import type { Database } from "@prostcounter/db";
import type {
  AttendanceByDate,
  AttendanceWithTotals,
  CreateAttendanceInput,
  CreateAttendanceResult,
  ListAttendancesQuery,
  LogTentVisitInput,
  LogTentVisitResponse,
  TentVisitRow,
  UpdatePersonalAttendanceInput,
  UpdatePersonalAttendanceResult,
} from "@prostcounter/shared";
import { DEFAULT_TIMEZONE } from "@prostcounter/shared/constants";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import { DatabaseError, ValidationError } from "../../middleware/error";
import type { IAttendanceRepository } from "../interfaces";

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findOrCreate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<AttendanceWithTotals> {
    // First try to find existing attendance
    const { data: existing } = await this.supabase
      .from("attendance_with_totals")
      .select("*")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("date", date)
      .single();

    if (existing) {
      return this.mapToAttendanceWithTotals(existing);
    }

    // Create new attendance record
    const { data, error } = await this.supabase
      .from("attendances")
      .insert({
        user_id: userId,
        festival_id: festivalId,
        date: date,
      })
      .select()
      .single();

    if (error || !data) {
      throw new DatabaseError(
        `Failed to create attendance: ${error?.message || "No data returned"}`,
      );
    }

    // Fetch the created attendance with totals
    const { data: withTotals, error: fetchError } = await this.supabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", data.id)
      .single();

    if (fetchError || !withTotals) {
      throw new DatabaseError(
        `Failed to fetch attendance totals: ${fetchError?.message || "No data returned"}`,
      );
    }

    return this.mapToAttendanceWithTotals(withTotals);
  }

  async findById(id: string): Promise<AttendanceWithTotals | null> {
    const { data, error } = await this.supabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === PgErrorCode.NO_ROWS) {
        return null; // Not found
      }
      throw new DatabaseError(`Failed to fetch attendance: ${error.message}`);
    }

    if (!data) {
      return null; // Not found
    }

    return this.mapToAttendanceWithTotals(data);
  }

  async list(
    userId: string,
    query: ListAttendancesQuery,
  ): Promise<{
    data: AttendanceWithTotals[];
    total: number;
    tentVisits?: TentVisitRow[];
  }> {
    const { festivalId, limit, offset, include } = query;

    // Get total count
    const { count, error: countError } = await this.supabase
      .from("attendance_with_totals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (countError) {
      throw new DatabaseError(`Failed to count attendances: ${countError.message}`);
    }

    // Get paginated data
    const { data, error } = await this.supabase
      .from("attendance_with_totals")
      .select("*")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`Failed to list attendances: ${error.message}`);
    }

    // Fetch all tent visits for this festival (also used for sync-grade
    // projection when include === "tent_visits").
    // Ordered because a day is a sequence of visits, not a set of tents: with
    // revisits, "Hofbräu 14:00, Paulaner 17:00, Hofbräu 20:00" only reads
    // correctly in time order, and Postgres gives no order without ORDER BY.
    // Callers render this list as-is.
    const { data: tentVisits, error: tentVisitsError } = await this.supabase
      .from("tent_visits")
      .select("id, user_id, tent_id, festival_id, visit_date, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .order("visit_date", { ascending: true });

    if (tentVisitsError) {
      throw new DatabaseError(`Failed to fetch tent visits: ${tentVisitsError.message}`);
    }

    const timezone = await this.getFestivalTimezone(festivalId);

    // Map attendances and enrich with tent visits
    const enrichedData = data.map((item) => {
      const attendance = this.mapToAttendanceWithTotals(item);

      // Which day a visit belongs to is read in the festival's timezone, the
      // same calendar the DB functions bucket by. Comparing UTC components
      // hid every visit in the first hours of a local day from that day, since
      // those instants belong to the previous UTC date.
      const visitsForDate = (tentVisits || [])
        .filter((visit) => {
          if (!visit.visit_date) return false;
          return formatDateForDatabase(new Date(visit.visit_date), timezone) === attendance.date;
        })
        .map((visit) => ({
          tentId: visit.tent_id,
          visitDate: visit.visit_date!,
          tentName: (visit.tents as any)?.name || null,
        }));

      return {
        ...attendance,
        tentVisits: visitsForDate,
      };
    });

    const result: {
      data: AttendanceWithTotals[];
      total: number;
      tentVisits?: TentVisitRow[];
    } = {
      data: enrichedData,
      total: count || 0,
    };

    if (include === "tent_visits") {
      result.tentVisits = (tentVisits || [])
        .filter((v) => v.visit_date !== null)
        .map((v) => ({
          id: v.id,
          userId: v.user_id,
          tentId: v.tent_id,
          festivalId: v.festival_id,
          visitDate: v.visit_date!,
          tentName: (v.tents as any)?.name ?? null,
        }));
    }

    return result;
  }

  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership only if the row exists. A missing row is treated as
    // idempotent success so retries from the offline queue (where the local
    // record may have never been pushed) don't loop on 500s/404s.
    const { data: attendance, error: fetchError } = await this.supabase
      .from("attendances")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new DatabaseError(`Failed to fetch attendance: ${fetchError.message}`);
    }

    if (!attendance) {
      return;
    }

    if (attendance.user_id !== userId) {
      throw new DatabaseError("Unauthorized to delete this attendance");
    }

    // Delete the attendance (consumptions will cascade delete).
    // Use .select() so the driver returns the affected rows; otherwise a
    // silent 0-row delete (RLS denial or blocking FK) is indistinguishable
    // from a real delete and the route handler would happily report success.
    const { data: deleted, error } = await this.supabase
      .from("attendances")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      throw new DatabaseError(`Failed to delete attendance: ${error.message}`);
    }

    if (!deleted || deleted.length === 0) {
      throw new DatabaseError(
        `Attendance delete affected 0 rows for id=${id}; likely RLS policy or FK constraint`,
      );
    }
  }

  async createWithTents(
    userId: string,
    input: CreateAttendanceInput,
  ): Promise<CreateAttendanceResult> {
    const { data, error } = await this.supabase.rpc("add_or_update_attendance_with_tents", {
      p_user_id: userId,
      p_beer_count: 0,
      p_tent_ids: input.tents,
      // A bare date, not a timestamp. The RPC only reads `p_date::date` and
      // stamps new visits at the festival's local midnight itself, so a
      // time-of-day here is ignored. It is also the only form that survives a
      // non-UTC session timezone: a bare date is parsed and cast back in the
      // same zone, while "...T23:30:00Z" casts to the next day east of UTC.
      p_date: input.date,
      p_festival_id: input.festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to create/update attendance: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new DatabaseError("No data returned from attendance creation");
    }

    return {
      attendanceId: data[0].attendance_id,
      tentsChanged: data[0].tents_changed || false,
    };
  }

  async updatePersonal(
    userId: string,
    input: UpdatePersonalAttendanceInput,
  ): Promise<UpdatePersonalAttendanceResult> {
    const { data, error } = await this.supabase.rpc("update_personal_attendance_with_tents", {
      p_user_id: userId,
      // A bare date, for the reasons given in createWithTents above.
      p_date: input.date,
      p_beer_count: 0,
      /*
       * null (not supplied) leaves tent visits untouched; [] clears them for the
       * date. The cast is needed because the generated Database types mirror the
       * SQL signature, which cannot mark an argument nullable without giving it a
       * DEFAULT — and p_tent_ids cannot take one while p_festival_id follows it.
       * Postgres accepts NULL here; see migration
       * 20260810120000_distinguish_omitted_from_empty_tent_ids.
       */
      p_tent_ids: (input.tents ?? null) as unknown as string[],
      p_festival_id: input.festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to update personal attendance: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new DatabaseError("No data returned from attendance update");
    }

    return {
      attendanceId: data[0].attendance_id,
      tentsAdded: data[0].tents_added || [],
      tentsRemoved: data[0].tents_removed || [],
    };
  }

  /**
   * The timezone whose calendar decides which day a festival's visits fall in.
   *
   * festivals.timezone is NOT NULL with a default, so a missing value means the
   * festival row itself is missing.
   *
   * `strict` separates writes from reads. A write has to know the real timezone -
   * stamping or bucketing a visit against a guess would put it on the wrong day -
   * so it fails loudly. A read for a festival that does not exist has nothing to
   * bucket anyway: it finds no attendances and no visits, and returning an empty
   * result is the behaviour those endpoints already had. Turning that into an
   * error would be a change of contract smuggled in with a timezone fix.
   */
  private async getFestivalTimezone(festivalId: string, strict = false): Promise<string> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("timezone")
      .eq("id", festivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to read festival timezone: ${error.message}`);
    }
    if (!data?.timezone) {
      if (strict) {
        throw new ValidationError(ErrorCodes.FESTIVAL_NOT_FOUND);
      }
      return DEFAULT_TIMEZONE;
    }

    return data.timezone;
  }

  /**
   * The user's visits on one festival day, oldest first.
   *
   * Reads a three-day UTC window and buckets in the festival's timezone in JS,
   * because the day boundary is `(visit_date AT TIME ZONE tz)::date` and the
   * query builder cannot express that. The window only has to be wide enough to
   * contain any instant that could bucket to this day, which no real timezone
   * offset comes close to exceeding, and it spans one user's visits over three
   * days - a handful of rows.
   */
  private async getVisitsForFestivalDay(
    userId: string,
    festivalId: string,
    date: string,
    timezone: string,
  ): Promise<{ tent_id: string; visit_date: string }[]> {
    const windowStart = new Date(`${date}T00:00:00.000Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - 1);
    const windowEnd = new Date(`${date}T00:00:00.000Z`);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

    const { data, error } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .gte("visit_date", windowStart.toISOString())
      .lt("visit_date", windowEnd.toISOString())
      .order("visit_date", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to read the day's tent visits: ${error.message}`);
    }

    return (data ?? []).filter(
      (visit): visit is { tent_id: string; visit_date: string } =>
        !!visit.visit_date && formatDateForDatabase(new Date(visit.visit_date), timezone) === date,
    );
  }

  async logTentVisit(userId: string, input: LogTentVisitInput): Promise<LogTentVisitResponse> {
    const visitedAt = new Date(input.visitedAt);
    const timezone = await this.getFestivalTimezone(input.festivalId, true);
    // The day the visit belongs to, read in the festival's timezone - the same
    // calendar the DB functions bucket by since
    // 20260811100000_bucket_tent_visits_by_festival_timezone. Deriving it in UTC
    // filed a visit logged just after local midnight under the previous day.
    const date = formatDateForDatabase(visitedAt, timezone);
    const tentVisitId = input.tentVisitId ?? crypto.randomUUID();

    // A client-supplied id that already exists is a replayed push, not a new
    // visit. Return the stored row instead of falling through to the guard
    // below, which would reject the replay as "you are already in this tent"
    // and hide the fact that the original call had actually succeeded.
    if (input.tentVisitId) {
      const { data: replayed, error: replayedError } = await this.supabase
        .from("tent_visits")
        .select("id, visit_date, tent_id, festival_id")
        .eq("id", input.tentVisitId)
        .eq("user_id", userId)
        .maybeSingle();

      if (replayedError) {
        throw new DatabaseError(`Failed to look up tent visit: ${replayedError.message}`);
      }

      if (replayed?.visit_date) {
        // The id has to point at the visit being described, not merely at some
        // visit of this user's. Trusting it alone let a client that reused an id
        // across days or festivals get a 201 describing a different row, and
        // created an attendance row for a day the response did not belong to.
        if (replayed.tent_id !== input.tentId || replayed.festival_id !== input.festivalId) {
          throw new ValidationError(ErrorCodes.TENT_VISIT_ID_MISMATCH);
        }

        // The stored row's own day, not the request's: they differ exactly when
        // the client is replaying with a different visitedAt, and the row that
        // exists is the one that decides which day gained a visit.
        const storedDate = formatDateForDatabase(new Date(replayed.visit_date), timezone);
        const { attendanceId } = await this.updatePersonal(userId, {
          festivalId: input.festivalId,
          date: storedDate,
          amount: 0,
        });
        return {
          tentVisitId: replayed.id,
          attendanceId,
          visitedAt: new Date(replayed.visit_date).toISOString(),
        };
      }
    }

    // Logging the tent you are already in is a stray tap, not a revisit: two
    // adjacent rows for one tent would read as leaving and coming back.
    //
    // Adjacency is the invariant, so this compares against the visits either
    // side of visitedAt rather than against the day's latest. Those only
    // coincide when visits arrive in time order, which the offline queue does
    // not guarantee: comparing against the latest both rejected a valid older
    // visit and, worse, accepted A@11:00 into A@10:00, B@12:00 - producing the
    // adjacent pair it exists to forbid.
    const dayVisits = await this.getVisitsForFestivalDay(
      userId,
      input.festivalId,
      date,
      timezone,
    );
    const visitedAtMs = visitedAt.getTime();
    const previous = dayVisits.filter((v) => new Date(v.visit_date).getTime() <= visitedAtMs).at(-1);
    const next = dayVisits.find((v) => new Date(v.visit_date).getTime() > visitedAtMs);

    if (previous?.tent_id === input.tentId || next?.tent_id === input.tentId) {
      throw new ValidationError(ErrorCodes.TENT_ALREADY_CURRENT_VISIT);
    }

    // Reuse the attendance upsert the form path goes through, so a visit logged
    // on a day with no attendance yet still produces one. Passing no tents
    // leaves existing visits untouched.
    const { attendanceId } = await this.updatePersonal(userId, {
      festivalId: input.festivalId,
      date,
      amount: 0,
    });

    const { data: tentVisit, error: insertError } = await this.supabase
      .from("tent_visits")
      .insert({
        id: tentVisitId,
        user_id: userId,
        festival_id: input.festivalId,
        tent_id: input.tentId,
        visit_date: visitedAt.toISOString(),
      })
      .select("id, visit_date")
      .single();

    if (insertError || !tentVisit?.visit_date) {
      // A primary-key collision here means the id belongs to another user's
      // visit: the replay lookup above is scoped to this user, so it found
      // nothing. Report it as a rejected id rather than letting the raw
      // constraint message out through the 500 handler.
      if (insertError?.code === PgErrorCode.UNIQUE_VIOLATION) {
        throw new ValidationError(ErrorCodes.TENT_VISIT_ID_MISMATCH);
      }
      throw new DatabaseError(`Failed to log tent visit: ${insertError?.message ?? "no row"}`);
    }

    return {
      tentVisitId: tentVisit.id,
      attendanceId,
      visitedAt: new Date(tentVisit.visit_date).toISOString(),
    };
  }

  async festivalExists(
    festivalId: string,
  ): Promise<{ id: string; timezone: string | null } | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("id, timezone")
      .eq("id", festivalId)
      .single();

    if (error) {
      if (error.code === PgErrorCode.NO_ROWS) {
        return null;
      }
      throw new DatabaseError(`Failed to check festival: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return data;
  }

  async getByDate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<AttendanceByDate | null> {
    // Fetch attendance for the specific date
    const { data: attendance, error: attendanceError } = await this.supabase
      .from("attendance_with_totals")
      .select("*")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("date", date)
      .single();

    if (attendanceError) {
      if (attendanceError.code === PgErrorCode.NO_ROWS) {
        return null; // Not found
      }
      throw new DatabaseError(`Failed to fetch attendance: ${attendanceError.message}`);
    }

    if (!attendance) {
      return null; // Not found
    }

    // Validate required fields from view
    if (!attendance.id || !attendance.user_id || !attendance.festival_id || !attendance.date) {
      throw new DatabaseError("Invalid attendance data from view");
    }

    const timezone = await this.getFestivalTimezone(festivalId);

    // Fetch tent visits for this date, in time order (see list() for why)
    const { data: tentVisits, error: tentVisitsError } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .order("visit_date", { ascending: true });

    if (tentVisitsError) {
      throw new DatabaseError(`Failed to fetch tent visits: ${tentVisitsError.message}`);
    }

    // Which day a visit belongs to is read in the festival's timezone, matching
    // the DB functions. A UTC comparison put the first hours of a local day on
    // the previous date, so a visit logged just after midnight vanished from the
    // day the user was looking at.
    const belongsToDate = (visit: { visit_date: string | null }): boolean =>
      !!visit.visit_date && formatDateForDatabase(new Date(visit.visit_date), timezone) === date;

    // Deduplicated: a day can hold several visits to the same tent (see
    // logTentVisit), but this field feeds the form's tent selector, which is a
    // set. Repeats there would render the same tent twice and, on save, ask the
    // RPC to reconcile to a list with duplicates.
    const tentIdsForDate = [
      ...new Set((tentVisits || []).filter(belongsToDate).map((visit) => visit.tent_id)),
    ];

    // Fetch beer pictures for this attendance (including IDs for deletion)
    const { data: beerPictures, error: picturesError } = await this.supabase
      .from("beer_pictures")
      .select("id, picture_url")
      .eq("user_id", userId)
      .eq("attendance_id", attendance.id);

    if (picturesError) {
      throw new DatabaseError(`Failed to fetch beer pictures: ${picturesError.message}`);
    }

    // Build pictures array with IDs for deletion support
    const pictures = (beerPictures || [])
      .filter((pic) => pic.picture_url !== null)
      .map((pic) => ({
        id: pic.id,
        pictureUrl: pic.picture_url!,
      }));

    // Keep pictureUrls for backward compatibility
    const pictureUrls = pictures.map((pic) => pic.pictureUrl);

    // Build tent visits array for the schema (same festival-day bucket)
    const visitsForDate = (tentVisits || [])
      .filter(belongsToDate)
      .map((visit) => ({
        tentId: visit.tent_id,
        visitDate: visit.visit_date!,
        tentName: (visit.tents as any)?.name || null,
      }));

    return {
      id: attendance.id,
      userId: attendance.user_id,
      festivalId: attendance.festival_id,
      date: attendance.date,
      createdAt: attendance.created_at || new Date().toISOString(),
      updatedAt: attendance.updated_at || new Date().toISOString(),
      drinkCount: attendance.drink_count || 0,
      beerCount: attendance.beer_count || 0,
      // Spending breakdown
      totalSpentCents: attendance.total_spent_cents || 0,
      totalBaseCents: attendance.total_base_cents || 0,
      totalTipCents: attendance.total_tip_cents || 0,
      avgPriceCents: attendance.avg_price_cents || 0,
      tentVisits: visitsForDate,
      tentIds: tentIdsForDate,
      pictureUrls: pictureUrls,
      pictures: pictures,
    };
  }

  private mapToAttendanceWithTotals(data: any): AttendanceWithTotals {
    return {
      id: data.id,
      userId: data.user_id,
      festivalId: data.festival_id,
      date: data.date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      drinkCount: data.drink_count || 0,
      beerCount: data.beer_count || 0,
      // Spending breakdown
      totalSpentCents: data.total_spent_cents || 0,
      totalBaseCents: data.total_base_cents || 0,
      totalTipCents: data.total_tip_cents || 0,
      avgPriceCents: data.avg_price_cents || 0,
      tentVisits: [], // Will be enriched in list() method
    };
  }
}
