import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";
import type {
  AttendanceWithTotals,
  ListAttendancesQuery,
} from "@prostcounter/shared";
import type { IAttendanceRepository } from "../interfaces";
import { DatabaseError, NotFoundError } from "../../middleware/error";

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findOrCreate(
    userId: string,
    festivalId: string,
    date: string
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
      throw new DatabaseError(`Failed to fetch attendance totals: ${fetchError.message}`);
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
    query: ListAttendancesQuery
  ): Promise<{ data: AttendanceWithTotals[]; total: number }> {
    const { festivalId, limit, offset } = query;

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

    return {
      data: data.map((item) => this.mapToAttendanceWithTotals(item)),
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
      throw new DatabaseError(`Failed to fetch attendance: ${fetchError.message}`);
    }

    if (attendance.user_id !== userId) {
      throw new DatabaseError("Unauthorized to delete this attendance");
    }

    // Delete the attendance (consumptions will cascade delete)
    const { error } = await this.supabase.from("attendances").delete().eq("id", id);

    if (error) {
      throw new DatabaseError(`Failed to delete attendance: ${error.message}`);
    }
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
    };
  }
}
