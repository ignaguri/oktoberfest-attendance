import type { IAttendanceRepository } from "../interfaces";
import type { Database } from "@prostcounter/db";
import type {
  AttendanceWithTotals,
  AttendanceByDate,
  ListAttendancesQuery,
  CreateAttendanceInput,
  CreateAttendanceResponse,
  UpdatePersonalAttendanceInput,
  UpdatePersonalAttendanceResponse,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError, NotFoundError } from "../../middleware/error";

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

    if (error) {
      throw new DatabaseError(`Failed to create attendance: ${error.message}`);
    }

    // Fetch the created attendance with totals
    const { data: withTotals, error: fetchError } = await this.supabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", data.id)
      .single();

    if (fetchError) {
      throw new DatabaseError(
        `Failed to fetch attendance totals: ${fetchError.message}`,
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
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new DatabaseError(`Failed to fetch attendance: ${error.message}`);
    }

    return this.mapToAttendanceWithTotals(data);
  }

  async list(
    userId: string,
    query: ListAttendancesQuery,
  ): Promise<{ data: AttendanceWithTotals[]; total: number }> {
    const { festivalId, limit, offset } = query;

    // Get total count
    const { count, error: countError } = await this.supabase
      .from("attendance_with_totals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (countError) {
      throw new DatabaseError(
        `Failed to count attendances: ${countError.message}`,
      );
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

    // Fetch all tent visits for this festival
    const { data: tentVisits, error: tentVisitsError } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (tentVisitsError) {
      throw new DatabaseError(
        `Failed to fetch tent visits: ${tentVisitsError.message}`,
      );
    }

    // Map attendances and enrich with tent visits
    const enrichedData = data.map((item) => {
      const attendance = this.mapToAttendanceWithTotals(item);
      const attendanceDate = new Date(attendance.date);

      // Filter tent visits for this attendance date
      const visitsForDate = (tentVisits || [])
        .filter((visit) => {
          if (!visit.visit_date) return false;
          const visitDate = new Date(visit.visit_date);
          return (
            visitDate.getFullYear() === attendanceDate.getFullYear() &&
            visitDate.getMonth() === attendanceDate.getMonth() &&
            visitDate.getDate() === attendanceDate.getDate()
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

    return {
      data: enrichedData,
      total: count || 0,
    };
  }

  async delete(id: string, userId: string): Promise<void> {
    // First verify the attendance belongs to the user
    const { data: attendance, error: fetchError } = await this.supabase
      .from("attendances")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new NotFoundError("Attendance not found");
      }
      throw new DatabaseError(
        `Failed to fetch attendance: ${fetchError.message}`,
      );
    }

    if (attendance.user_id !== userId) {
      throw new DatabaseError("Unauthorized to delete this attendance");
    }

    // Delete the attendance (consumptions will cascade delete)
    const { error } = await this.supabase
      .from("attendances")
      .delete()
      .eq("id", id);

    if (error) {
      throw new DatabaseError(`Failed to delete attendance: ${error.message}`);
    }
  }

  async createWithTents(
    userId: string,
    input: CreateAttendanceInput,
  ): Promise<CreateAttendanceResponse> {
    // Convert date string to ISO timestamp for the RPC function
    const dateWithTime = new Date(input.date);
    const now = new Date();
    dateWithTime.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    const { data, error } = await this.supabase.rpc(
      "add_or_update_attendance_with_tents",
      {
        p_user_id: userId,
        p_beer_count: input.amount,
        p_tent_ids: input.tents,
        p_date: dateWithTime.toISOString(),
        p_festival_id: input.festivalId,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to create/update attendance: ${error.message}`,
      );
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
    const dateWithTime = new Date(input.date);
    const now = new Date();
    dateWithTime.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    const { data, error } = await this.supabase.rpc(
      "update_personal_attendance_with_tents",
      {
        p_user_id: userId,
        p_date: dateWithTime.toISOString(),
        p_beer_count: input.amount,
        p_tent_ids: input.tents.length > 0 ? input.tents : [],
        p_festival_id: input.festivalId,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to update personal attendance: ${error.message}`,
      );
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

  async festivalExists(
    festivalId: string,
  ): Promise<{ id: string; timezone: string | null } | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("id, timezone")
      .eq("id", festivalId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new DatabaseError(`Failed to check festival: ${error.message}`);
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
      if (attendanceError.code === "PGRST116") {
        return null; // Not found
      }
      throw new DatabaseError(
        `Failed to fetch attendance: ${attendanceError.message}`,
      );
    }

    // Validate required fields from view
    if (
      !attendance.id ||
      !attendance.user_id ||
      !attendance.festival_id ||
      !attendance.date
    ) {
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
      throw new DatabaseError(
        `Failed to fetch tent visits: ${tentVisitsError.message}`,
      );
    }

    // Filter tent visits for this specific date
    const tentIdsForDate = (tentVisits || [])
      .filter((visit) => {
        if (!visit.visit_date) return false;
        const visitDate = new Date(visit.visit_date);
        return (
          visitDate.getFullYear() === attendanceDate.getFullYear() &&
          visitDate.getMonth() === attendanceDate.getMonth() &&
          visitDate.getDate() === attendanceDate.getDate()
        );
      })
      .map((visit) => visit.tent_id);

    // Fetch beer pictures for this attendance (including IDs for deletion)
    const { data: beerPictures, error: picturesError } = await this.supabase
      .from("beer_pictures")
      .select("id, picture_url")
      .eq("user_id", userId)
      .eq("attendance_id", attendance.id);

    if (picturesError) {
      throw new DatabaseError(
        `Failed to fetch beer pictures: ${picturesError.message}`,
      );
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

    // Build tent visits array for the schema
    const visitsForDate = (tentVisits || [])
      .filter((visit) => {
        if (!visit.visit_date) return false;
        const visitDate = new Date(visit.visit_date);
        return (
          visitDate.getFullYear() === attendanceDate.getFullYear() &&
          visitDate.getMonth() === attendanceDate.getMonth() &&
          visitDate.getDate() === attendanceDate.getDate()
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
      totalSpentCents: attendance.total_spent_cents || 0,
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
      totalSpentCents: data.total_spent_cents || 0,
      totalTipCents: data.total_tip_cents || 0,
      avgPriceCents: data.avg_price_cents || 0,
      tentVisits: [], // Will be enriched in list() method
    };
  }
}
