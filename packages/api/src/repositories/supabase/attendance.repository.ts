import type { Database } from "@prostcounter/db";
import type {
  AttendanceByDate,
  AttendanceWithTotals,
  CreateAttendanceInput,
  CreateAttendanceResponse,
  ListAttendancesQuery,
  LogTentVisitInput,
  LogTentVisitResponse,
  TentVisitRow,
  UpdatePersonalAttendanceInput,
  UpdatePersonalAttendanceResponse,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
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
    const { data: tentVisits, error: tentVisitsError } = await this.supabase
      .from("tent_visits")
      .select("id, user_id, tent_id, festival_id, visit_date, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (tentVisitsError) {
      throw new DatabaseError(`Failed to fetch tent visits: ${tentVisitsError.message}`);
    }

    // Map attendances and enrich with tent visits
    const enrichedData = data.map((item) => {
      const attendance = this.mapToAttendanceWithTotals(item);
      const attendanceDate = new Date(attendance.date);

      // Filter tent visits for this attendance date (UTC to avoid timezone shift)
      const visitsForDate = (tentVisits || [])
        .filter((visit) => {
          if (!visit.visit_date) return false;
          const visitDate = new Date(visit.visit_date);
          return (
            visitDate.getUTCFullYear() === attendanceDate.getUTCFullYear() &&
            visitDate.getUTCMonth() === attendanceDate.getUTCMonth() &&
            visitDate.getUTCDate() === attendanceDate.getUTCDate()
          );
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
  ): Promise<CreateAttendanceResponse> {
    // Convert date string to ISO timestamp for the RPC function
    // Use setUTCHours to avoid timezone shifting the date
    // (new Date("YYYY-MM-DD") creates UTC midnight; setHours uses local time
    // and can shift the date back in Western Hemisphere timezones)
    const dateWithTime = new Date(input.date);
    const now = new Date();
    dateWithTime.setUTCHours(
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    );

    const { data, error } = await this.supabase.rpc("add_or_update_attendance_with_tents", {
      p_user_id: userId,
      p_beer_count: 0,
      p_tent_ids: input.tents,
      p_date: dateWithTime.toISOString(),
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
  ): Promise<UpdatePersonalAttendanceResponse> {
    // Convert date string to ISO timestamp for the RPC function
    // Use setUTCHours to avoid timezone shifting the date
    // (new Date("YYYY-MM-DD") creates UTC midnight; setHours uses local time
    // and can shift the date back in Western Hemisphere timezones)
    const dateWithTime = new Date(input.date);
    const now = new Date();
    dateWithTime.setUTCHours(
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    );

    const { data, error } = await this.supabase.rpc("update_personal_attendance_with_tents", {
      p_user_id: userId,
      p_date: dateWithTime.toISOString(),
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

  async logTentVisit(userId: string, input: LogTentVisitInput): Promise<LogTentVisitResponse> {
    const visitedAt = new Date(input.visitedAt);
    // The day the visit belongs to, in UTC, matching how
    // update_personal_attendance_with_tents buckets visit_date (visit_date::date)
    // and how the mobile pull derives its local day key.
    const date = visitedAt.toISOString().split("T")[0];
    const tentVisitId = input.tentVisitId ?? crypto.randomUUID();

    // A client-supplied id that already exists is a replayed push, not a new
    // visit. Return the stored row instead of falling through to the guard
    // below, which would reject the replay as "you are already in this tent"
    // and hide the fact that the original call had actually succeeded.
    if (input.tentVisitId) {
      const { data: replayed, error: replayedError } = await this.supabase
        .from("tent_visits")
        .select("id, visit_date")
        .eq("id", input.tentVisitId)
        .eq("user_id", userId)
        .maybeSingle();

      if (replayedError) {
        throw new DatabaseError(`Failed to look up tent visit: ${replayedError.message}`);
      }

      if (replayed?.visit_date) {
        const { attendanceId } = await this.updatePersonal(userId, {
          festivalId: input.festivalId,
          date,
          amount: 0,
        });
        return {
          tentVisitId: replayed.id,
          attendanceId,
          visitedAt: new Date(replayed.visit_date).toISOString(),
        };
      }
    }

    // The day's most recent visit. Logging the tent you are already in is a
    // stray tap, not a revisit, so it is rejected rather than silently stored -
    // two adjacent rows for one tent would read as leaving and coming back.
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const { data: latestVisit, error: latestVisitError } = await this.supabase
      .from("tent_visits")
      .select("tent_id")
      .eq("user_id", userId)
      .eq("festival_id", input.festivalId)
      .gte("visit_date", dayStart.toISOString())
      .lt("visit_date", dayEnd.toISOString())
      .order("visit_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVisitError) {
      throw new DatabaseError(`Failed to read the day's tent visits: ${latestVisitError.message}`);
    }

    if (latestVisit?.tent_id === input.tentId) {
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

    const attendanceDate = new Date(date);

    // Fetch tent visits for this date
    const { data: tentVisits, error: tentVisitsError } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (tentVisitsError) {
      throw new DatabaseError(`Failed to fetch tent visits: ${tentVisitsError.message}`);
    }

    // Filter tent visits for this specific date
    // Use UTC methods to avoid timezone shifting the date comparison
    // (new Date("YYYY-MM-DD") creates UTC midnight; getDate() uses local time)
    // Deduplicated: a day can hold several visits to the same tent (see
    // logTentVisit), but this field feeds the form's tent selector, which is a
    // set. Repeats there would render the same tent twice and, on save, ask the
    // RPC to reconcile to a list with duplicates.
    const tentIdsForDate = [
      ...new Set(
        (tentVisits || [])
          .filter((visit) => {
            if (!visit.visit_date) return false;
            const visitDate = new Date(visit.visit_date);
            return (
              visitDate.getUTCFullYear() === attendanceDate.getUTCFullYear() &&
              visitDate.getUTCMonth() === attendanceDate.getUTCMonth() &&
              visitDate.getUTCDate() === attendanceDate.getUTCDate()
            );
          })
          .map((visit) => visit.tent_id),
      ),
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

    // Build tent visits array for the schema (same UTC date comparison)
    const visitsForDate = (tentVisits || [])
      .filter((visit) => {
        if (!visit.visit_date) return false;
        const visitDate = new Date(visit.visit_date);
        return (
          visitDate.getUTCFullYear() === attendanceDate.getUTCFullYear() &&
          visitDate.getUTCMonth() === attendanceDate.getUTCMonth() &&
          visitDate.getUTCDate() === attendanceDate.getUTCDate()
        );
      })
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
